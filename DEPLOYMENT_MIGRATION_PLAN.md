# Deployment Migration Plan

## Recommendation

Keep the backend on Render for now. It is the lowest-risk option because the service is already deployed, and the codebase only needs a small amount of hardening before it is production-ready.

Use this sequence:

1. Stabilize the current Render deployment.
2. Move the frontend to a low-cost static host if desired.
3. Revisit AWS or GCP only when cost, compliance, or scale justify the move.

## What to fix on Render now

- Add and monitor a `/healthz` endpoint.
- Keep the web service on `gunicorn wsgi:app`.
- Run Celery as a separate worker service.
- Use managed Postgres with backups.
- Use managed Redis or a hosted Redis provider for Celery.
- Store all secrets in Render environment variables.
- Add a deploy check that verifies the app boots and returns `200` from `/healthz`.

## Short AWS migration plan

1. Add a Dockerfile for the backend image.
2. Push images to Amazon ECR.
3. Run the web app on ECS Fargate or App Runner.
4. Move Postgres to RDS with automated backups.
5. Move Redis to ElastiCache or keep Upstash for a smaller setup.
6. Store secrets in AWS Secrets Manager.
7. Use CloudWatch logs and alarms.
8. Cut over DNS after a staging validation pass.

## Short GCP migration plan

1. Add a Dockerfile for the backend image.
2. Push images to Artifact Registry.
3. Run the web app on Cloud Run.
4. Move Postgres to Cloud SQL with backups.
5. Move Redis to Memorystore or keep Upstash for a smaller setup.
6. Store secrets in Secret Manager.
7. Use Cloud Logging and Cloud Monitoring.
8. Cut over DNS after a staging validation pass.

## Free or low-cost hosting options

### Best beginner-friendly choices

- **Render**: best if you want the least operational work and already have the backend there.
- **Vercel**: best for the React frontend only.
- **Netlify**: also good for the frontend only.
- **Cloud Run**: good if you want a cheap serverless backend on GCP.
- **Fly.io**: useful for small containerized services.

### Supporting services

- **Postgres**: Supabase free tier for prototypes, or a managed paid Postgres once you need reliability.
- **Redis**: Upstash free tier is the easiest low-cost option for small Celery workloads.

## Practical recommendation

For the beginning, keep the backend on Render, host the frontend on Vercel or Netlify if needed, use Supabase or managed Postgres for the database, and use Upstash for Redis. That gives you the lowest operational burden while you validate the product.
