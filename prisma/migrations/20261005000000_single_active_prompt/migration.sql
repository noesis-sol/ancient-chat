-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep a single active prompt before enforcing it. There is no timestamp for
-- existing rows, so keep the most recently created one: cuid ids sort by
-- creation time.
UPDATE "Prompt" SET "is_active" = false
WHERE "is_active"
  AND "id" <> (SELECT max("id") FROM "Prompt" WHERE "is_active");

-- CreateIndex
-- Partial unique index: at most one row can have is_active = true. Not
-- expressible in schema.prisma, so it is maintained here by hand.
CREATE UNIQUE INDEX "Prompt_single_active_key" ON "Prompt" ("is_active") WHERE "is_active";
