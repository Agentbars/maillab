# MailLab Profile Feature — Implementation Spec

**Date:** 2026-05-26
**Status:** Design approved, ready for implementation
**Audience:** MailLab developer(s) (Pavel and anyone he hands this to)
**Purpose:** Build a Profile page in MailLab that serves as the test substrate for the AQA Course "DDT, foreach for tests" task. Three real-feeling bugs are deliberately included as teaching artifacts.

> ⚠️ **This document contains the intentional bugs.** A separate sibling document, [`2026-05-26-maillab-profile-customer-requirements.md`](./2026-05-26-maillab-profile-customer-requirements.md), describes the *expected* behavior with no mention of bugs. That sibling is the student-facing "source of truth" attached to the course task. Do not leak this document to students.

---

## 1. Feature overview

A logged-in MailLab user opens `/profile` and edits a small set of account preferences. The page presents one form with six fields, a single **Save changes** button, and inline per-field validation messages on save failure.

This is intentionally a *small* feature — its job is to give the AQA Course students a richly-validatable form to practice Data-Driven Testing against.

## 2. Page

| Property | Value |
|---|---|
| Route | `GET /profile` (the page itself, server-rendered or SPA route — pick whichever fits MailLab's existing stack) |
| Access | Authenticated users only. Anonymous → redirect to `/login`. |
| Layout | Single form with the six fields below; one `Save changes` button. |
| Validation UX | On submit, the server validates. On 200 → show a success toast / banner. On 400 → render error messages inline under each offending field. |

## 3. API

### `GET /api/profile`

- **Auth:** required (same session cookie that protects the rest of the app).
- **Response 200:**
  ```json
  {
    "displayName": "John Smith",
    "email": "john@example.com",
    "phone": "+15551234567",
    "signature": "Sent from MailLab",
    "timeZone": "Europe/Moscow",
    "notifications": "important_only"
  }
  ```
- **Response 401:** `{ "error": "Unauthorized" }` if no session.

### `PUT /api/profile`

- **Auth:** required.
- **Request body:** same shape as the GET response, minus `email` (read-only).
- **Response 200:** the updated profile (same shape as GET).
- **Response 400:** validation errors:
  ```json
  {
    "errors": {
      "displayName": "must not be empty",
      "phone": "must start with + and a country code"
    }
  }
  ```
  Only fields with errors appear in the `errors` map.

## 4. Fields

### 4.1 `displayName` — text, required — **HAS BUG**

| Aspect | Rule |
|---|---|
| Required | Yes (non-empty after trim) |
| Max length | 50 characters |
| Whitespace | Both leading and trailing whitespace are trimmed at save time |
| Error on empty | `"must not be empty"` |
| Error on too long | `"max 50 characters"` |

#### 🐞 Intentional Bug #1 — asymmetric whitespace trim

Implement the save-time normalization as `value.trimEnd()` instead of `value.trim()`.

- Input `"  John  "` → stored `"  John"` (leading whitespace preserved — wrong)
- Input `"  Alice"`  → stored `"  Alice"` (wrong)
- Input `"Bob   "`   → stored `"Bob"` (correct — only the easy case)

The bug surfaces when the test asserts the stored value (via `GET /api/profile`) after submitting an input with leading whitespace.

### 4.2 `email` — text, read-only

| Aspect | Rule |
|---|---|
| Editable | No — displayed only |
| Source | The user's login email (already in MailLab's user record) |

Not a target for DDT. Included so the form feels complete.

### 4.3 `phone` — text, optional — **HAS BUG**

| Aspect | Rule |
|---|---|
| Required | No |
| Empty value | Stored as `null` (or empty string — be consistent) |
| Accepted input | `+` followed by a country code (1–3 digits) and the rest of the number; spaces, dashes, dots, and parentheses are accepted in input |
| Normalization at save | Strip all characters that are **not** a digit and not `+`. The `+` must be preserved. |
| Validation | Stored value must match `/^\+\d{7,15}$/`. Otherwise: `"must start with + and a country code"` |

#### 🐞 Intentional Bug #2 — `+` lost during normalization

Implement the normalization regex as `phone.replace(/[^\d]/g, '')` instead of `phone.replace(/[^\d+]/g, '')`.

- Input `"+1-555-123-4567"` → stored `"15551234567"` (no `+` — wrong; will also fail the validation regex if validation runs *after* normalization — see below)
- Input `"+44 20 7946 0958"` → stored `"442079460958"` (wrong)
- Input `"+15551234567"` → stored `"15551234567"` (wrong, even without separators)

**Important:** make the bug observable. There are two reasonable implementations:
- (a) Validate *before* normalization, then normalize. The validation passes; the stored value lacks `+`. The test asserts the stored value and fails. ✅ Bug observable.
- (b) Normalize *first*, then validate. The validation fails because the normalized value doesn't start with `+`. The user sees an unexpected validation error. ✅ Bug also observable, just in a different way.

Pick (a) — it produces a quieter, more interesting bug (the save *succeeds* but the data is wrong). The student catches it by asserting on the stored value, not just on the response status.

### 4.4 `signature` — textarea, optional — **HAS BUG**

| Aspect | Rule |
|---|---|
| Required | No |
| Empty value | Stored as `null` (or empty string — be consistent) |
| Max length | 500 characters |
| Newlines | Preserved as-is |
| Error on too long | `"max 500 characters"` |

#### 🐞 Intentional Bug #3 — off-by-one in max length

Implement the length check as `if (value.length > 501) reject(...)` instead of `> 500`. (Equivalent: `>= 502`.)

- Input `"A".repeat(500)` → accepted ✅ correct
- Input `"A".repeat(501)` → accepted ✗ wrong, should be rejected
- Input `"A".repeat(502)` → rejected ✅ correct (the bug's window is exactly one character wide)

The bug surfaces when the test parametrises over `[499, 500, 501, 502]` length values and asserts both the response status and the resulting stored value.

### 4.5 `timeZone` — select, required

| Aspect | Rule |
|---|---|
| Required | Yes |
| Options | A fixed list of IANA time zones — at minimum: `UTC`, `Europe/Moscow`, `Europe/London`, `America/New_York`, `America/Los_Angeles`, `Asia/Tokyo`, `Asia/Dubai` |
| Validation | Stored value must be one of the option set. Unknown → `"unknown time zone"` |

No bug. Clean.

### 4.6 `notifications` — select, required

| Aspect | Rule |
|---|---|
| Required | Yes |
| Options | `all` / `important_only` / `off` |
| Validation | Stored value must be one of these three. Unknown → `"invalid notification preference"` |

No bug. Clean.

## 5. Database

Add the columns to the existing `users` table (or whatever MailLab calls it), with sensible defaults so existing accounts keep working:

| Column | Type | Default |
|---|---|---|
| `display_name` | `varchar(255)` | the user's email local-part, or empty if you want them to fill it |
| `phone` | `varchar(20)`, nullable | `null` |
| `signature` | `text`, nullable | `null` |
| `time_zone` | `varchar(50)` | `"UTC"` |
| `notifications` | `varchar(20)` | `"all"` |

## 6. Test acceptance for the MailLab dev

Before considering this feature "done":

1. **Manual happy-path:** open `/profile`, edit each field with valid values, save, reload — values persist.
2. **The three intentional bugs are present and observable** via the API alone (the student tests `PUT` then `GET` and compares):
   - Bug #1: `PUT { displayName: "  John  " }` → `200` → `GET` shows `displayName: "  John"`.
   - Bug #2: `PUT { phone: "+1-555-1234567" }` → `200` → `GET` shows `phone: "15551234567"`.
   - Bug #3: `PUT { signature: "A".repeat(501) }` → `200`. `PUT { signature: "A".repeat(502) }` → `400`.
3. The clean fields (`timeZone`, `notifications`) reject unknown values with the spec'd error messages.
4. `GET /api/profile` and `PUT /api/profile` correctly require auth (401 otherwise).

## 7. Out of scope

- Email change flow (covered elsewhere in the app).
- Password change (separate page).
- Avatar / profile picture.
- Audit log of profile changes.
- Localised error messages — English only is fine.

## 8. Related course artifacts

- **Student-facing requirements:** [`2026-05-26-maillab-profile-customer-requirements.md`](./2026-05-26-maillab-profile-customer-requirements.md) — describes the *expected* behavior of each field, no mention of bugs. Attached to the AQA Course "DDT, foreach for tests" task.
- **DDT task description** (in LabsTracker): updated separately to point students at this Profile page as their test target.
- **Bug discovery is deferred to TestResults analyzation task** later in the course progression — the student's own DDT failures against this Profile feature become the input data for that task.
