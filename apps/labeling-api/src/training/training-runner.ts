/**
 * Training Runner — long-lived background process spawned by TrainingService.
 *
 * Pipeline:
 *   1. status = EXPORTING  → run training/export-to-gcs.ts → capture gcsTrainUri
 *   2. status = TRAINING   → run training/finetune_vertex.py → capture tunedModelEndpoint
 *   3. status = SUCCEEDED  (or FAILED with error)
 *
 * Survives parent server restart because it's spawned detached/unref'd.
 */
import { spawn } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '../generated/prisma-client';

const jobId = process.argv[2] || process.env.TRAINING_JOB_ID;
if (!jobId) {
  console.error('TRAINING_JOB_ID required');
  process.exit(1);
}

const prisma = new PrismaClient();

// labeling-api root: when compiled, __dirname = .../dist/training
// project root sits two levels up
const projectRoot = path.resolve(__dirname, '..', '..');
const exportScript = path.join(projectRoot, 'training', 'export-to-gcs.ts');
const finetuneScript = path.join(projectRoot, 'training', 'finetune_vertex.py');

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';
const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';

function runCommand(
  cmd: string,
  args: string[],
  onLine?: (line: string) => void,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: projectRoot, env: process.env });
    let stdout = '';
    let stderr = '';
    let buf = '';

    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      buf += s;
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        process.stdout.write(`[runner] ${line}\n`);
        if (onLine) onLine(line);
      }
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      process.stderr.write(`[runner-err] ${s}`);
    });
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

async function fail(reason: string) {
  console.error(`[runner] FAIL: ${reason}`);
  await prisma.trainingJob.update({
    where: { id: jobId! },
    data: { status: 'FAILED', error: reason.slice(0, 4000), completedAt: new Date() },
  });
  await prisma.$disconnect();
  process.exit(1);
}

async function main() {
  console.log(`[runner] starting job ${jobId}`);

  // ─── Phase 1: export ───────────────────────────────────────────
  await prisma.trainingJob.update({
    where: { id: jobId! },
    data: { status: 'EXPORTING' },
  });

  let capturedGcsUri: string | null = null;
  let capturedSamples: number | null = null;

  const exportRes = await runCommand('npx', ['tsx', exportScript], (line) => {
    // export-to-gcs.ts logs:  "JSONL: gs://bucket/training/.../train.jsonl"
    const m1 = line.match(/JSONL:\s+(gs:\/\/\S+)/);
    if (m1) capturedGcsUri = m1[1];
    // and: "Samples: 12 exported, 0 failed"
    const m2 = line.match(/Samples:\s+(\d+)\s+exported/);
    if (m2) capturedSamples = parseInt(m2[1], 10);
  });

  if (exportRes.code !== 0 || !capturedGcsUri) {
    return fail(`export failed (code=${exportRes.code}): ${exportRes.stderr.slice(-500)}`);
  }

  await prisma.trainingJob.update({
    where: { id: jobId! },
    data: {
      gcsTrainUri: capturedGcsUri,
      sampleCount: capturedSamples ?? undefined,
      status: 'TRAINING',
    },
  });

  // ─── Phase 2: fine-tune via Vertex AI ───────────────────────────
  const job = await prisma.trainingJob.findUnique({ where: { id: jobId! } });
  if (!job) return fail('job vanished from DB');

  let capturedVertexJobName: string | null = null;
  let capturedTunedModel: string | null = null;
  let capturedEndpoint: string | null = null;

  const tuneRes = await runCommand(
    'python3',
    [
      finetuneScript,
      `--project=${GCP_PROJECT_ID}`,
      `--location=${GCP_LOCATION}`,
      `--training-data=${capturedGcsUri}`,
      `--base-model=${job.baseModel}`,
      `--epochs=${job.epochs}`,
      `--display-name=budapest-${jobId!.slice(0, 8)}`,
    ],
    (line) => {
      // finetune_vertex.py logs:
      //   "Job name: projects/.../tuningJobs/123"
      //   "  Tuned model:    ..."
      //   "  Endpoint:       ..."
      const jm = line.match(/Job name:\s+(\S+)/);
      if (jm) capturedVertexJobName = jm[1];
      const tm = line.match(/Tuned model:\s+(\S+)/);
      if (tm) capturedTunedModel = tm[1];
      const em = line.match(/Endpoint:\s+(\S+)/);
      if (em) capturedEndpoint = em[1];

      // Persist vertex job name as soon as we see it
      if (jm && jobId) {
        prisma.trainingJob
          .update({
            where: { id: jobId },
            data: { vertexJobName: capturedVertexJobName! },
          })
          .catch((e) => console.error('[runner] vertex name persist failed:', e));
      }
    },
  );

  if (tuneRes.code !== 0) {
    return fail(`finetune failed (code=${tuneRes.code}): ${tuneRes.stderr.slice(-500)}`);
  }

  await prisma.trainingJob.update({
    where: { id: jobId! },
    data: {
      status: 'SUCCEEDED',
      tunedModelName: capturedTunedModel ?? undefined,
      tunedModelEndpoint: capturedEndpoint ?? undefined,
      completedAt: new Date(),
    },
  });

  console.log(`[runner] job ${jobId} succeeded`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  await fail(err?.message || String(err));
});
