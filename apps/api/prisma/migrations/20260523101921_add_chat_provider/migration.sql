-- CreateEnum
CREATE TYPE "ChatProvider" AS ENUM ('OPENAI', 'GEMINI');

-- AlterTable
ALTER TABLE "chat_agents" ADD COLUMN "provider" "ChatProvider" NOT NULL DEFAULT 'GEMINI';

-- AlterTable
ALTER TABLE "chat_agents" ALTER COLUMN "model" SET DEFAULT 'gemini-2.5-flash';
