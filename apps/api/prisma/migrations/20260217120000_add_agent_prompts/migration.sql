-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('INTAKE', 'EXTRACTION', 'MATCHING');

-- CreateTable
CREATE TABLE "agent_prompts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "prompt_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt_text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_prompts_company_id_agent_type_prompt_key_key" ON "agent_prompts"("company_id", "agent_type", "prompt_key");

-- AddForeignKey
ALTER TABLE "agent_prompts" ADD CONSTRAINT "agent_prompts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
