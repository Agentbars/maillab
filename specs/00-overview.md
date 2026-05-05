# Overview

## Users
Students register with email + password. Email used as login AND
as their in-platform mail address (e.g. ivan@maillab.local — domain
is fixed in env: MAIL_DOMAIN).

## Mail module
- Compose: to (string), subject, body, optional attachment (one file).
- Send: creates a Message row; if to == own address, also delivers
  to own inbox immediately (no queue, sync write).
- Inbox: list of messages where to == current user, newest first.
- Refresh button + polling endpoint (GET /api/inbox?since=ts).
- Open message: shows subject, body, attachment download link.
- Save attachment to Disk: copies file to user's Disk under a folder.

## Disk module
- Fixed root folders per user (created on signup):
  - "Inbox attachments"  (auto-target when saving from mail)
  - "Long-term"
  - "Other"
  - "Trash"
- Inside each, user can create subfolders.
- Move file between folders.
- Move to Trash = soft delete with deletedAt set.
- Files in Trash for >48h are hard-deleted by background job.
- Restore from Trash = clear deletedAt, return to previous folder.

## Non-goals
See CLAUDE.md.
