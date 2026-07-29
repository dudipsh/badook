#!/bin/bash
# Gemini Fine-Tuning via Vertex AI — one-command wrapper
# Prerequisites: GCP_PROJECT_ID, GCS_BUCKET set in environment
# Usage: bash finetune.sh gs://bucket/training/vertex-XXXXX/train.jsonl
set -e

if [ -z "$1" ]; then
  echo "Usage: bash finetune.sh <GCS_URI_TO_TRAINING_JSONL>"
  echo "  e.g.: bash finetune.sh gs://<your-bucket>/training/vertex-2026-04-15/train.jsonl"
  exit 1
fi

pip install google-cloud-aiplatform -q

python3 "$(dirname "$0")/finetune_vertex.py" \
  --project="${GCP_PROJECT_ID}" \
  --location="${GCP_LOCATION:-us-central1}" \
  --training-data="$1" \
  --display-name="budapest-$(date +%Y%m%d-%H%M)"
