---
name: python-deployment
description: "Prepare Python deployment runbooks for FastAPI/uvicorn applications. Covers uvicorn worker configuration, gunicorn process management, Docker container builds, environment-specific configs, health checks, and the ai-server's multi-worker formula derived from uvicorn_config.py. Use when deploying the ai-server, configuring uvicorn/gunicorn workers, writing Dockerfiles, setting up environment configs, or planning production releases. Also triggers on: 'Deploy Python', 'Uvicorn config', 'Dockerfile Python', 'Deploy FastAPI', 'Python production', 'AI server deployment', 'Python release', 'FastAPI Docker', 'Production uvicorn'."
next_skill: null
required_gate: "Gate 5 (Production Sign-off)"
skill_id: SK-085
allowed-tools: Read Write Edit Grep Glob Bash
context_budget:
  load_kb: 30
  scope: task
version: 1.2.4
dependencies:
  required:
    - python-testing
  optional:
    - github-ops
    - audit
license: Proprietary
compatibility: "Claude Code 1.x"
metadata:
  author: WebOsmotic Private Limited
---

# Python Deployment (FastAPI)

Loads: `rules/development-rules.md` and `rules/python-rules.md`.

> AI never deploys. Prepares, documents, validates, generates artifacts. Human operator runs every `docker push` / `kubectl apply` / cloud-CLI deploy.

## Uvicorn Workers

| Env | Workers | reload | log_level |
|---|---|---|---|
| development | 1 | True | debug |
| staging | `cpu_count()` | False | info |
| production | `cpu_count() * 2 + 1` | False | warning |

`cpu_count() * 2 + 1` is the classic Gunicorn formula for I/O-bound async workers — saturates cores while most are awaiting I/O.

```python
# uvicorn_config.py
import multiprocessing, uvicorn
from app.config import settings
def main() -> None:
    env = settings.environment.lower()
    if env == "production":
        workers, reload, log_level = multiprocessing.cpu_count() * 2 + 1, False, "warning"
    elif env == "staging":
        workers, reload, log_level = multiprocessing.cpu_count(), False, "info"
    else:
        workers, reload, log_level = 1, True, "debug"
    uvicorn.run("app.main:app", host=settings.host, port=settings.port,
                reload=reload, workers=workers, log_level=log_level)
```

- Never `reload=True` outside development.
- Multi-worker requires the import string `"app.main:app"`, not the `app` object.
- `host` must be `0.0.0.0` in containers (default `127.0.0.1` is loopback only).
- Production `log_level="warning"` — `debug`/`info` floods logs.

## Gunicorn + UvicornWorker

```bash
gunicorn app.main:app --worker-class uvicorn.workers.UvicornWorker \
  --workers $(python -c "import multiprocessing; print(multiprocessing.cpu_count() * 2 + 1)") \
  --bind 0.0.0.0:8000 --timeout 120 --keepalive 5 --log-level warning
```

`UvicornWorker` is mandatory for ASGI — plain gunicorn workers are WSGI and silently fail async routes. Use gunicorn for single-VM multi-worker / systemd / `SIGHUP` graceful reload (`kill -HUP $(pgrep -f "gunicorn app.main:app")`). Use plain uvicorn for K8s with HPA, one process per container, or managed runtimes (Railway, Render, Fly). Plain uvicorn cannot do graceful reload in production.

## Dockerfile

Verify Python version against `https://devguide.python.org/versions/` before pinning; match `pyproject.toml` / `requirements.txt`.

```dockerfile
FROM python:<LTS>-slim AS builder
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:<LTS>-slim AS runtime
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
WORKDIR /app
COPY --from=builder /install /usr/local
COPY app/ ./app/
COPY src/ ./src/
COPY uvicorn_config.py .
RUN chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["python", "uvicorn_config.py"]
```

- Multi-stage always. `slim` not full / not alpine (alpine breaks pydantic native ext).
- Non-root user. No `requirements-dev.txt` in production image.
- Copy only `app/`, `src/`, `uvicorn_config.py` — never the whole repo.
- HEALTHCHECK points to `/health` (returns `{"status":"ok"}`).

## Environment & Zero-Downtime

```bash
ENVIRONMENT=production   # triggers cpu_count()*2+1 worker formula
HOST=0.0.0.0             # mandatory in containers
PORT=8000
API_PREFIX=/api
# Secrets injected at runtime — never in Dockerfile
```

- `app/config.py` raises `ValueError` for missing required production values (fail fast).
- `.env.example` documents every variable.

| Platform | Mechanism |
|---|---|
| Docker Compose | `up -d --no-deps --build` |
| Docker Swarm | `service update --update-parallelism 1 --update-delay 10s --update-failure-action rollback` |
| Kubernetes | `RollingUpdate` with `maxUnavailable: 0`, `maxSurge: 1`, `readinessProbe` -> `/health`, `initialDelaySeconds: 15` |

## Verification & Rollback

Pre-deploy:
- `pytest --cov-branch --cov-fail-under=98` passes; `python -c "import app.main"` succeeds.
- No `os.getenv` outside `config.py`; no hardcoded secrets; `.env` excluded; `audit` passed.
- Image builds, container starts, `/health` returns 200, worker count matches formula.
- `ENVIRONMENT=production`, `HOST=0.0.0.0`, secrets injected via secrets manager.

Post-deploy validation:
```bash
curl -f http://host:port/health                       # {"status":"ok"}
docker exec C ps aux | grep -c uvicorn                # cpu_count()*2+1 (+1 master)
docker logs C 2>&1 | grep -E "ERROR|CRITICAL"         # empty
```

Not successful until: `/health` 200 for 60s, no ERROR/CRITICAL for 5 min, first real request succeeds, log level is `warning`.

Rollback (target <5 min):
- Docker: `docker service update --image ai-server:${PREV_TAG} ai-server-service` or `--rollback`.
- K8s: `kubectl rollout undo deployment/ai-server`; verify with `kubectl rollout status`.
- Code: `git revert HEAD --no-edit`, push, redeploy clean. Never patch a running container.
<!-- Version: 1.2.4 | 2026-10-22 | repointed rule references after code-rules.md and compliance/secrets.md merges (v4.32.0) -->
