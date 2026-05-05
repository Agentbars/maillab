# Spec: Disk — Folders

## Data model
Folder:
  - id, name, userId
  - parentId?: string (null = root folder)
  - isRoot: boolean (true for the 4 system folders created on signup)
  - createdAt

Root folders per user (created automatically on registration, cannot be deleted or renamed):
  1. "Inbox attachments" — default target for save-to-disk from mail.
  2. "Long-term"
  3. "Other"
  4. "Trash" — soft-delete destination (see spec 07).

## API

### GET /api/disk/folders
Auth: required.
Returns 200 with folder tree for current user:
```json
[
  {
    "id": "string",
    "name": "string",
    "isRoot": true,
    "parentId": null,
    "children": [
      { "id": "string", "name": "string", "isRoot": false, "parentId": "string", "children": [] }
    ]
  }
]
```
Top level = 4 root folders. Each may have nested children.

### POST /api/disk/folders
Auth: required.
Body (JSON):
  - name: string (1..100, no leading/trailing whitespace)
  - parentId: string — must belong to current user and must NOT be "Trash"

Behavior:
1. Validate name. 400 with `{error, field}` on failure.
2. Verify parentId ownership. 404 if not found or not owned.
3. Disallow parentId == Trash folder. 400 with `{error: "cannot_nest_in_trash"}`.
4. Create Folder row (isRoot = false).
5. Return 201 with `{id, name, parentId}`.

### DELETE /api/disk/folders/:id
Auth: required.
Behavior:
1. 400 with `{error: "cannot_delete_root"}` if isRoot == true.
2. Folder must be empty (no files, no subfolders). 400 with `{error: "folder_not_empty"}` if not.
3. Delete folder. Return 204.

## Tests (write first)
- 401 on all endpoints without auth.
- GET returns 4 root folders after registration, no children initially.
- 400 on create with blank name.
- 404 on create with parentId belonging to another user.
- 400 on create with parentId == Trash.
- 201 on valid subfolder creation → appears nested under correct parent in GET response.
- 400 on delete of root folder.
- 400 on delete of non-empty folder.
- 204 on delete of empty subfolder → no longer appears in GET.

## Out of scope
- Renaming folders.
- Moving folders.
- Folder-level permissions.
