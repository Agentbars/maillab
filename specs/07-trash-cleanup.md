# Spec: Trash & Cleanup Job

## Trash rules
- Moving a file to the Trash folder sets `deletedAt = now()`.
- File remains in DB and on disk for 48 hours after `deletedAt`.
- After 48 hours the file is hard-deleted: DB row removed, physical file deleted.
- A file in Trash can be restored any time before hard-deletion (see spec 06).

## Cleanup job

### Trigger
- Runs as a background job every hour.
- Implemented as a Next.js Route Handler at POST /api/internal/cleanup.
- Protected by a shared secret header: `X-Internal-Secret: <CLEANUP_SECRET env var>`.
- In development, triggered manually or via a script.
- In production, called by an external cron (e.g. cURL from system cron or hosting cron).

### POST /api/internal/cleanup
Auth: `X-Internal-Secret` header must match `process.env.CLEANUP_SECRET`.
Returns 401 if secret missing or wrong.
Body: none.

Behavior:
1. Find all DiskFile rows where `deletedAt != null` AND `deletedAt < now() - 48h`.
2. For each file:
   a. Delete physical file at `storagePath`. Ignore errors if file already missing.
   b. Delete DiskFile row.
3. Return 200 with `{deleted: <count>}`.

## Environment variable
```
CLEANUP_SECRET=<random string, min 32 chars>
```
Must be set in `.env`. Never committed.

## Tests (write first)
- 401 on POST /api/internal/cleanup with missing secret.
- 401 on POST /api/internal/cleanup with wrong secret.
- 200 with `{deleted: 0}` when no files qualify.
- File with `deletedAt` exactly 48h ago is NOT yet deleted (boundary: strict >48h).
- File with `deletedAt` 48h+1s ago IS deleted: DB row gone, physical file gone.
- Files with `deletedAt = null` (not in trash) are never touched.
- Files of other users are not affected by another user's cleanup run (job is global,
  but verify correct scoping — all expired trash regardless of user).
- Returns correct count when multiple files are cleaned up.

## Out of scope
- Cleanup of orphaned message attachments (./storage/messages/).
- Per-user configurable retention period.
- Notification to user before hard-deletion.
