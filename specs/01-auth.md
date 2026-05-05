# Spec: Authentication

## API

### POST /api/auth/register
Auth: none.
Body (JSON):
  - email: string — must match /^[a-z0-9._-]+@maillab\.local$/i
  - password: string (8..72 chars)

Behavior:
1. Validate format. 400 with `{error, field}` on failure.
2. Check email uniqueness. 409 with `{error: "email_taken"}` if exists.
3. Hash password (bcrypt, cost 12).
4. Create User row.
5. Create 4 root Folder rows for the user: "Inbox attachments", "Long-term", "Other", "Trash".
6. Return 201 with `{id, email}`.

### POST /api/auth/login
Auth: none.
Body (JSON):
  - email, password

Behavior:
1. Find user by email. 401 with `{error: "invalid_credentials"}` if not found.
2. Verify password. 401 same error if wrong.
3. Create session (NextAuth credentials provider).
4. Return 200 with `{id, email}`.

### POST /api/auth/logout
Auth: required.
Invalidates session. Returns 200.

### GET /api/auth/me
Auth: required.
Returns 200 with `{id, email}`.
Returns 401 if unauthenticated.

## Tests (write first)
- 400 on invalid email format (missing @maillab.local).
- 400 on password too short.
- 409 on duplicate email.
- 201 on valid registration → 4 root folders exist in DB.
- 401 on login with wrong password.
- 200 on login with correct credentials → session cookie set.
- 401 on GET /api/auth/me without session.
- 200 on GET /api/auth/me with valid session.

## Out of scope
- Password reset / email verification.
- OAuth.
- Remember-me / token refresh.
