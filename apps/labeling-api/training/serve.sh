#!/bin/bash
set -e

##############################################################
# Badook — vLLM Serve (Turnkey)
#
# USAGE:
#   1. Create a RunPod GPU Pod — RTX 4090 (24GB) or better
#      Template: runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
#      Container Disk: 30GB | Volume Disk: 50GB
#   2. Upload this script to /workspace/
#   3. Run:  bash serve.sh
#
# The server will be available on port 8000 (OpenAI-compatible).
# Test: curl http://localhost:8000/v1/models
##############################################################

HF_MODEL="${1:-Dudipsh/badook-v2}"
PORT=8000
MAX_MODEL_LEN=2048
GPU_MEM_UTIL=0.90

echo "============================================"
echo "  Badook — vLLM Serve"
echo "  Model: $HF_MODEL"
echo "  Port: $PORT"
echo "  Max context: $MAX_MODEL_LEN"
echo "============================================"
echo ""

# ---- Step 1: Install vLLM ----
echo "[1/3] Installing vLLM..."
pip install vllm -q 2>&1 | tail -3
echo "  Done."

# ---- Step 2: Login to HuggingFace (for private models) ----
echo ""
echo "[2/3] HuggingFace login..."
if [ -n "$HF_TOKEN" ]; then
  huggingface-cli login --token "$HF_TOKEN" 2>/dev/null
  echo "  Logged in with HF_TOKEN."
else
  echo "  No HF_TOKEN set. If the model is private, set: export HF_TOKEN=hf_xxx"
  echo "  Continuing anyway (will fail if model is private)..."
fi

# ---- Step 3: Start vLLM server ----
echo ""
echo "[3/3] Starting vLLM server..."
echo "  URL: http://0.0.0.0:$PORT"
echo "  Test: curl http://localhost:$PORT/v1/models"
echo ""

vllm serve "$HF_MODEL" \
  --host 0.0.0.0 \
  --port "$PORT" \
  --max-model-len "$MAX_MODEL_LEN" \
  --trust-remote-code \
  --gpu-memory-utilization "$GPU_MEM_UTIL" \
  --dtype auto \
  --default-chat-template-kwargs '{"enable_thinking": false}'
