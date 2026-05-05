# Spec: Attachments

## API

### GET /api/messages/:id/attachment
Auth: required. Current user must be the recipient.

Behavior:
1. Locate file at `./storage/messages/<messageId>/<filename>`.
2. Stream file with correct `Content-Type` and
   `Content-Disposition: attachment; filename="<filename>"`.
3. 404 if message not found, not addressed to current user, or has no attachment.

### POST /api/messages/:id/save-to-disk
Auth: required. Current user must be the recipient.
Body (JSON):
  - folderId: string — target Disk folder (must belong to current user).

Behavior:
1. Verify message exists and belongs to current user. 404 if not.
2. Verify message has an attachment. 400 with `{error: "no_attachment"}` if not.
3. Verify folderId belongs to current user. 404 if not.
4. Copy file from `./storage/messages/<messageId>/<filename>`
   to `./storage/disk/<userId>/<folderId>/<filename>`.
   If filename collides, append `_1`, `_2`, … before extension.
5. Create DiskFile row: name, sizeBytes, folderId, userId, storagePath.
6. Return 201 with `{fileId, name, folderId}`.

## File storage layout
```
storage/
  messages/
    <messageId>/
      <originalFilename>     # written once on send, never modified
  disk/
    <userId>/
      <folderId>/
        <filename>           # copied from messages/ on save-to-disk
```

## Tests (write first)
- 401 on download without auth.
- 404 on download for message without attachment.
- 404 on download for message belonging to another user.
- 200 download streams correct bytes and filename header.
- 401 on save-to-disk without auth.
- 404 on save-to-disk for unknown message.
- 400 on save-to-disk when message has no attachment.
- 404 on save-to-disk when folderId belongs to another user.
- 201 on valid save → DiskFile row created → file exists on disk.
- Filename collision → deduplicated name saved correctly.

## Out of scope
- Multiple attachments per message.
- Virus scanning.
- Thumbnail generation.
