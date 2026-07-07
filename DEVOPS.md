# Kompon DevOps

This layer adds deployment and CI support without changing frontend, backend, or model source code.

## Local container run

1. Copy `Backend/.env.example` to `Backend/.env` and fill in real values.
2. Set the public API origin used by the frontend build if needed:

```powershell
$env:VITE_API_ORIGIN="http://localhost:3001"
$env:ALLOWED_ORIGIN="http://localhost:8080"
$env:ML_SPACE_BASE_URL="https://your-hugging-face-space.hf.space"
docker compose up --build
```

The frontend will be available at `http://localhost:8080`.
The backend health check will be available at `http://localhost:3001/health`.

## Hugging Face model service

The model service stays external. Point the backend to the deployed Hugging Face Space with:

```text
ML_SPACE_BASE_URL=https://your-hugging-face-space.hf.space
```

If serving Parquet data from Hugging Face Datasets, also set:

```text
HF_DATASET_REPO=your-hugging-face-username/your-serving-data-repo
```

## CI

GitHub Actions runs:

- frontend install and production build
- backend dependency install check
- Docker image builds for frontend and backend

CI secrets are not required for these checks because no deployment happens in the workflow.

## Deployment notes

- Configure `ALLOWED_ORIGIN` on the backend to the deployed frontend origin.
- Configure `VITE_API_ORIGIN` at frontend image build time to the deployed backend origin.
- Keep API keys and database URLs in the hosting provider's secret manager, not in Git.
- Keep the Hugging Face Space deployment independent unless you intentionally move it into the same runtime.
