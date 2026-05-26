# MailLab File Download Feature — Implementation Spec

**Date:** 2026-05-26
**Status:** Design approved, ready for implementation
**Audience:** MailLab developer(s)
**Purpose:** Add a file-download action with multi-status error handling on the Documents page. Substrate for the AQA Course "Intercepting Network Requests in Playwright" task — students mock the download endpoint with different HTTP statuses and verify that the frontend shows the right error UI for each.

---

## 1. Feature overview

Each file row on the Documents page gets a `Download` button. Clicking it triggers a download request to a new endpoint. The frontend handles the success case (browser downloads the file), four error statuses (each with its own toast message), and the network-error case.

This is intentionally a *small* feature — its job is to give students a focused surface for practicing `page.route()` interception in Playwright. **There are no intentional bugs** in this feature (unlike the Profile feature).

## 2. Page

| Property | Value |
|---|---|
| Page | `/documents` (already exists) |
| Access | Authenticated users only |
| New UI element 1 | `Download` button (or icon button) per file row |
| New UI element 2 | Toast container, positioned in a corner of the page |

The toast appears after a failed download attempt, displays for 3–5 seconds, then auto-dismisses. A close (×) icon allows manual dismiss earlier.

> **MailLab note:** In MailLab there is no `/documents` route — the user-facing page is `/disk`. The new download endpoint lives at `/api/documents/[id]/download` as the spec dictates (course materials reference this URL), and the toast UX is wired into the existing `/disk` page.

## 3. API

### `GET /api/documents/:id/download`

- **Auth:** required.
- **Success (200):** returns the file content with:
  - `Content-Type: <the file's MIME>`
  - `Content-Disposition: attachment; filename="<original name>"`
- **Error responses:**
  - `404` if the document with that id does not exist
  - `403` if the document exists but does not belong to the current user
  - `500` for unexpected server failures
  - `503` if the underlying storage backend is unreachable / circuit-breaker open

Error responses can use the existing error JSON shape (e.g. `{ "error": "..." }`); the frontend does not consume the body, only the status.

## 4. Frontend behavior

When the user clicks `Download`:

1. The frontend issues `GET /api/documents/:id/download`.
2. On `200`, the browser handles the download naturally (the response carries `Content-Disposition: attachment`). No toast.
3. On `4xx` / `5xx`, the frontend shows the **error toast** with the message that matches the status:

| Status | Toast message |
|---|---|
| `404` | `File not found` |
| `403` | `You don't have access to this file` |
| `500` | `Server error — please try again later` |
| `503` | `Service temporarily unavailable` |

4. On **network error** (request aborted, connection failed, no response at all): toast with **`Download failed — check your connection`**.

5. On any **other** status not in the table above (e.g. `418`, `429`): fall back to a **generic** toast — `Download failed (HTTP <status>)`. Do not crash, do not silently swallow. The discussion question in the course task probes this branch deliberately, so it must exist.

### Toast DOM contract

The toast is what Playwright tests assert on. It MUST have this shape:

```html
<div data-testid="download-error-toast" data-status="<HTTP_STATUS_OR_'network'>">
  <span class="message"><message text></span>
  <button class="close" aria-label="Close">×</button>
</div>
```

- `data-testid="download-error-toast"` — unique across the page; tests locate via this.
- `data-status` — the HTTP status as a string (`"404"`, `"500"`, etc.), or the literal string `"network"` for the no-response case.
- The message text is the user-facing string from the table above.
- Only **one** toast visible at a time. A new failed download replaces the previous toast.

## 5. Out of scope

- Authorization checks for `403` (the backend can either implement them properly or always return another status; the test substrate works either way because students *mock* the response — they don't need the backend to genuinely produce 403).
- Rate limiting (`429`) as a first-class case — covered by the generic fallback toast.
- Cancel-in-progress download.
- Download progress indicator.
- Storing download history.

## 6. Test acceptance for the MailLab dev

Before considering this feature "done":

1. **Manual happy path:** open Documents, click Download on a file → browser starts downloading. No toast appears.
2. **The four error toasts are reachable** by directly serving each status from the endpoint (you can patch the controller temporarily, or stub the storage layer):
   - `404` → toast `File not found`, `data-status="404"`.
   - `403` → toast `You don't have access to this file`, `data-status="403"`.
   - `500` → toast `Server error — please try again later`, `data-status="500"`.
   - `503` → toast `Service temporarily unavailable`, `data-status="503"`.
3. **Network error path:** kill the backend mid-request (or use `chrome://network-conditions` to set offline) → toast `Download failed — check your connection`, `data-status="network"`.
4. **Generic fallback:** force the endpoint to return `418` → toast `Download failed (HTTP 418)`.
5. The error toast carries `data-testid="download-error-toast"` and the `data-status` attribute on the outer container — not on a child element.
6. Only one toast visible at a time.

## 7. Related course artifacts

- **Course task:** "Intercepting Network Requests in Playwright" (template id `cmos7t3t900175zhnlp7msle6`). The student-facing task description already describes the toast contract and the five core cases; this implementation spec is the developer-side counterpart.
- **No customer-requirements attachment** is needed for this task — the task description itself is concrete enough, and there are no intentional bugs to hide from the student.
