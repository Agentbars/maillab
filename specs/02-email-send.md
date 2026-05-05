# Spec: Email Send

## API
POST /api/messages
Auth: required.
Body (multipart/form-data):
  - to: string (must match /^[a-z0-9._-]+@maillab\.local$/i)
  - subject: string (1..200)
  - body: string (0..10000)
  - attachment?: File (max 5 MB)

## Behavior
1. Validate inputs. 400 on failure with `{error, field}`.
2. Verify `to` user exists. 404 with `{error: "recipient_not_found"}` if not.
3. If attachment present: save to ./storage/messages/<messageId>/<filename>.
4. Create Message row. If `to == from`, write only one row (delivered to self).
5. Return 201 with `{id, createdAt}`.

## Tests (write first)
- 401 when unauthenticated.
- 400 on missing subject.
- 400 on too-large attachment.
- 404 on unknown recipient.
- 201 on valid send to self → row exists in DB → file exists on disk.
- 201 on send to another user → recipient sees it in their inbox.

## Out of scope
- Multiple attachments.
- Drafts.
- Reply threading.
