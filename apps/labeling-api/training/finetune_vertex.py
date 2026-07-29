#!/usr/bin/env python3
"""
Gemini Fine-Tuning via Vertex AI
Usage:
  python finetune_vertex.py --project=PROJECT_ID --training-data=gs://bucket/path/train.jsonl
"""

import argparse
import time
import sys

def main():
    parser = argparse.ArgumentParser(description='Fine-tune Gemini via Vertex AI')
    parser.add_argument('--project', required=True, help='GCP project ID')
    parser.add_argument('--location', default='us-central1', help='GCP region')
    parser.add_argument('--training-data', required=True, help='GCS URI to training JSONL')
    parser.add_argument('--validation-data', help='GCS URI to validation JSONL (optional)')
    parser.add_argument('--base-model', default='gemini-2.0-flash-001', help='Base model to fine-tune')
    parser.add_argument('--epochs', type=int, default=3, help='Training epochs')
    parser.add_argument('--adapter-size', type=int, default=4, choices=[1, 4, 8, 16], help='LoRA adapter size')
    parser.add_argument('--display-name', default=None, help='Tuned model display name')
    args = parser.parse_args()

    try:
        import vertexai
        from vertexai.tuning import sft
    except ImportError:
        print("ERROR: google-cloud-aiplatform not installed. Run: pip install google-cloud-aiplatform")
        sys.exit(1)

    display_name = args.display_name or f'budapest-extraction-{time.strftime("%Y%m%d-%H%M")}'

    print(f"=== Gemini Fine-Tuning ===")
    print(f"  Project:       {args.project}")
    print(f"  Location:      {args.location}")
    print(f"  Base model:    {args.base_model}")
    print(f"  Training data: {args.training_data}")
    print(f"  Validation:    {args.validation_data or '(none)'}")
    print(f"  Epochs:        {args.epochs}")
    print(f"  Adapter size:  {args.adapter_size}")
    print(f"  Display name:  {display_name}")
    print()

    vertexai.init(project=args.project, location=args.location)

    train_kwargs = dict(
        source_model=args.base_model,
        train_dataset=args.training_data,
        epochs=args.epochs,
        adapter_size=args.adapter_size,
        tuned_model_display_name=display_name,
    )
    if args.validation_data:
        train_kwargs['validation_dataset'] = args.validation_data

    print("Launching fine-tuning job...")
    tuning_job = sft.train(**train_kwargs)

    print(f"Job name: {tuning_job.name}")
    print(f"Monitor: https://console.cloud.google.com/vertex-ai/generative/language/tuning?project={args.project}")
    print()

    # Poll until done
    print("Waiting for completion...")
    while not tuning_job.has_ended:
        time.sleep(60)
        tuning_job.refresh()
        state = tuning_job.state.name if hasattr(tuning_job.state, 'name') else str(tuning_job.state)
        print(f"  State: {state}")

    if tuning_job.has_succeeded:
        endpoint = tuning_job.tuned_model_endpoint_name
        model_name = tuning_job.tuned_model_name
        print()
        print("=== DONE ===")
        print(f"  Tuned model:    {model_name}")
        print(f"  Endpoint:       {endpoint}")
        print()
        print("Add this to your .env:")
        print(f"  VERTEX_TUNED_MODEL={endpoint}")
    else:
        print()
        print("=== FAILED ===")
        print(f"  Error: {tuning_job.error}")
        sys.exit(1)


if __name__ == '__main__':
    main()
