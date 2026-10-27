---
name: release-readiness
description: Use when preparing infrastructure, CI/CD, environments, deployments, monitoring, backups, secrets, runbooks or a go-live checklist for the clinic platform on AWS Mumbai.
---

# Release readiness and operations

## Environments
`local` (docker compose: PostgreSQL 16, MinIO), `staging` (mirrors production, seeded demo clinic, used for QA and Sarvam test agent), `production`. Separate AWS accounts or at least separate VPCs, databases, buckets, secrets and Sarvam agents. No production data in staging.

## Infrastructure (AWS ap-south-1, defined as code with Terraform)
RDS PostgreSQL (private subnets, encryption, automated backups with point-in-time recovery, Multi-AZ for production if budget allows), ECS Fargate services for API and worker (same image, different command), ALB with TLS, S3 private bucket for recordings (SSE, block public access, lifecycle), Secrets Manager, CloudWatch logs and alarms, Sentry for errors, static hosting for the two web apps (S3 + CloudFront) on separate subdomains.

## CI/CD (GitHub Actions)
PR: install, lint, typecheck, test (Testcontainers), OpenAPI drift, migration on empty DB, policy-coverage script, dependency audit, build, bundle budget.
Main: build image, deploy to staging, run migrations (separate step with the owner role), smoke tests, manual approval, deploy to production, smoke tests, automatic rollback on failed health check.
Migrations run in the pipeline only, before the new version is started, and must be backward compatible with the previous version.

## Observability
Structured JSON logs with request IDs, no PHI. Metrics/alarms: 5xx rate, p95 latency of voice tool endpoints, failed webhooks, failed or stuck jobs, queue depth, database CPU/connections/storage, certificate expiry. A health endpoint and a readiness endpoint. Admin console shows integration failures.

## Backups and recovery
Point-in-time recovery enabled; recovery point <= 15 min and recovery time <= 4 h (proposal); restore drill performed once before go-live and documented. S3 versioning for recordings.

## Go-live checklist
Definition of Done in the planning doc fully ticked; secrets rotated from staging; Sarvam production agent mapped; call-recording consent line in the greeting; retention job running; alarms routed to a human; runbook covers onboarding a clinic, rotating secrets, restoring a backup and handling a Sarvam outage; rollback tested; Android compatibility matrix signed off.

## Rules for AI sessions
Never run production commands, migrations against shared databases or terraform apply. Produce the change and the exact commands for a human to review and run.
