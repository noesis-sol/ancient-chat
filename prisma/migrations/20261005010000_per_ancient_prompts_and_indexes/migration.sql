-- Prompts and indexes belong to an ancient (a slug from src/data/ancients.ts).
-- Until now everything served Aristotle, so existing rows are assigned to him.

-- AlterTable
ALTER TABLE "Prompt" ADD COLUMN "ancient" TEXT NOT NULL DEFAULT 'aristotle';
ALTER TABLE "Prompt" ALTER COLUMN "ancient" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Index" ADD COLUMN "ancient" TEXT;
UPDATE "Index" SET "ancient" = 'aristotle';

-- DropIndex
DROP INDEX "Prompt_single_active_key";

-- CreateIndex
-- Partial unique index: at most one active prompt per ancient. Not expressible
-- in schema.prisma, so it is maintained here by hand.
CREATE UNIQUE INDEX "Prompt_single_active_per_ancient_key" ON "Prompt" ("ancient") WHERE "is_active";
