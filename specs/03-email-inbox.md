# Spec: Email Inbox

## API

### GET /api/inbox
Auth: required.
Query params:
  - since?: ISO-8601 timestamp — if provided, return only messages with createdAt > since.

Returns 200 with array (newest first):
```json
[
  {
    "id": "string",
    "from": "string",
    "subject": "string",
    "createdAt": "ISO-8601",
    "hasAttachment": true
  }
]
```
Empty array if no messages. Never 404.

### GET /api/messages/:id
Auth: required.
Returns full message only if current user is the recipient.

Returns 200:
```json
{
  "id": "string",
  "from": "string",
  "to": "string",
  "subject": "string",
  "body": "string",
  "createdAt": "ISO-8601",
  "attachment": {
    "filename": "string",
    "sizeBytes": 0
  } | null
}
```

Returns 404 if not found or not addressed to current user.

## Behavior
- Inbox = messages where `to` == current user email.
- `since` param enables polling: client stores last-known timestamp and polls
  GET /api/inbox?since=<ts> to detect new arrivals without full reload.
- Opening a message does NOT mark it as read (out of scope).

## Tests (write first)
- 401 on GET /api/inbox without auth.
- 200 with empty array when inbox is empty.
- 200 with correct messages after send (ordered newest first).
- `since` filter returns only messages newer than the given timestamp.
- 401 on GET /api/messages/:id without auth.
- 404 on message belonging to another user.
- 200 with full message fields including attachment metadata.
- Message without attachment has `attachment: null`.

## Out of scope
- Read/unread state.
- Pagination (return all messages).
- Search / filtering by sender or subject.
- Sent folder.
