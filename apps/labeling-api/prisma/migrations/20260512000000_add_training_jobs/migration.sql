-- CreateEnum
CREATE TYPE "TrainingJobStatus" AS ENUM ('PENDING', 'EXPORTING', 'TRAINING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "training_jobs" (
    "id" TEXT NOT NULL,
    "status" "TrainingJobStatus" NOT NULL DEFAULT 'PENDING',
    "base_model" TEXT NOT NULL DEFAULT 'gemini-2.0-flash-001',
    "epochs" INTEGER NOT NULL DEFAULT 3,
    "sample_count" INTEGER,
    "gcs_train_uri" TEXT,
    "vertex_job_name" TEXT,
    "tuned_model_name" TEXT,
    "tuned_model_endpoint" TEXT,
    "error" TEXT,
    "started_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "training_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_jobs_status_idx" ON "training_jobs"("status");

-- CreateIndex
CREATE INDEX "training_jobs_created_at_idx" ON "training_jobs"("created_at");
