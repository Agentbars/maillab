# Spec: Disk — Files

## Data model
DiskFile:
  - id, name, userId, folderId
  - storagePath: string (relative path under ./storage/disk/)
  - sizeBytes: number
  - deletedAt?: DateTime (null = not in trash)
  - previousFolderId?: string (set when moved to Trash, used for restore)
  - createdAt

## API

### GET /api/disk/folders/:folderId/files
Auth: required. Folder must belong to current user.
Returns 200 with array:
```json
[
  {
    "id": "string",
    "name": "string",
    "sizeBytes": 0,
    "createdAt": "ISO-8601",
    "deletedAt": null
  }
]
```
- If folderId is Trash: includes all files with deletedAt != null.
- Otherwise: only files with deletedAt == null.
- 404 if folder not found or not owned.

### POST /api/disk/files/:id/move
Auth: required. File must belong to current user.
Body (JSON):
  - targetFolderId: string

Behavior:
1. Verify file ownership. 404 if not found or not owned.
2. Verify targetFolderId belongs to current user. 404 if not.
3. If targetFolderId == Trash folder:
   - Set deletedAt = now(), previousFolderId = current folderId.
4. Else:
   - Ensure file is not currently in Trash (deletedAt != null). If it is,
     this endpoint cannot be used — use /restore instead. 400 with
     `{error: "use_restore_endpoint"}`.
   - Update folderId, clear deletedAt and previousFolderId if any.
5. Physical file on disk is NOT moved (storagePath unchanged).
6. Return 200 with `{id, folderId, deletedAt}`.

### POST /api/disk/files/:id/restore
Auth: required. File must belong to current user and be in Trash.
Body: none.

Behavior:
1. 404 if file not found or not owned.
2. 400 with `{error: "not_in_trash"}` if deletedAt == null.
3. Move file back to previousFolderId. If previousFolderId no longer exists,
   fall back to "Other" root folder.
4. Clear deletedAt and previousFolderId.
5. Return 200 with `{id, folderId}`.

### GET /api/disk/files/:id/download
Auth: required. File must belong to current user and not be in Trash.
Streams file from storagePath with correct headers.
404 if not found, not owned, or in Trash.

## Tests (write first)
- 401 on all endpoints without auth.
- 404 on list files in folder belonging to another user.
- 200 with empty array for new empty folder.
- Files saved via save-to-disk appear in correct folder listing.
- Trash folder listing shows only deleted files.
- Non-trash folder listing excludes deleted files.
- 404 on move with unknown file or targetFolderId.
- Move to Trash sets deletedAt and previousFolderId.
- Move to non-Trash from non-Trash updates folderId, deletedAt stays null.
- 400 on move when file is already in Trash (use restore instead).
- 400 on restore when file is not in Trash.
- 200 on restore → folderId = previousFolderId, deletedAt null.
- Restore to deleted previousFolder falls back to "Other".
- 404 on download of trashed file.
- 200 download streams correct bytes.

## Out of scope
- Rename file.
- Copy file within disk.
- Upload file directly to disk (files arrive only via save-to-disk).
