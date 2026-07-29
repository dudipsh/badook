# Budapest - Labeling Platform

## Quick Start

```bash
# Install dependencies
pnpm install

# Start database
# (PostgreSQL should be running on localhost:5432)

# Run API + Web
npm run dev
```

## Available AI Models

| Model | Provider | Use Case |
|-------|----------|----------|
| Gemini 2.5 Flash | Google | Default extraction - fast and accurate |
| Gemini Fine-tuned | Vertex AI | Fine-tuned Gemini Flash on Israeli documents, hosted on Google Cloud |

### Vertex AI Fine-tuned Model

The fine-tuned model runs on Google Cloud Vertex AI. Required env vars:
```
GCP_PROJECT_ID=<your-gcp-project-id>
GCP_LOCATION=us-central1
VERTEX_TUNED_MODEL=projects/<project>/locations/<region>/endpoints/<endpoint-id>
```

For Railway/Docker deployments, also set `GCP_CREDENTIALS_JSON` with the service account key JSON.
