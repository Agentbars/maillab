-- Backfill existing rows as already delivered (deliveredAt = createdAt)
ALTER TABLE "messages" ADD COLUMN "deliveredAt" TIMESTAMPTZ;
UPDATE "messages" SET "deliveredAt" = "createdAt";
ALTER TABLE "messages" ALTER COLUMN "deliveredAt" SET NOT NULL;
