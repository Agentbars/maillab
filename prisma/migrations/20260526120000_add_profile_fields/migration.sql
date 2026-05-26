-- Profile fields on users: display_name, phone, signature, time_zone, notifications
ALTER TABLE "users" ADD COLUMN "display_name"  VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "phone"         VARCHAR(20);
ALTER TABLE "users" ADD COLUMN "signature"     TEXT;
ALTER TABLE "users" ADD COLUMN "time_zone"     VARCHAR(50)  NOT NULL DEFAULT 'UTC';
ALTER TABLE "users" ADD COLUMN "notifications" VARCHAR(20)  NOT NULL DEFAULT 'all';

-- Backfill display_name with email local-part for existing accounts so the
-- form is not empty on first visit. New users keep the empty-string default.
UPDATE "users" SET "display_name" = split_part("email", '@', 1) WHERE "display_name" = '';
