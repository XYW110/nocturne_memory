# ============================================================
# Stage 1: Build frontend (pnpm)
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

RUN corepack enable

COPY frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml frontend/package.json ./
RUN pnpm install --frozen-lockfile

COPY frontend/index.html frontend/vite.config.js frontend/tailwind.config.js frontend/postcss.config.js ./
COPY frontend/src/ ./src/

RUN pnpm build

# ============================================================
# Stage 2: Build backend deps (compilers for C extensions like jieba)
# ============================================================
FROM python:3.12-slim AS backend-builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ============================================================
# Stage 3: Runtime (minimal, no compilers)
# ============================================================
FROM python:3.12-slim

# Only curl for healthcheck
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed Python packages
COPY --from=backend-builder /install /usr/local

# Copy backend source
COPY backend/ ./

# Copy frontend build output (web_app.py expects ../frontend/dist)
COPY --from=frontend-builder /frontend/dist /app/../frontend/dist

# Non-root user
RUN adduser --disabled-password --gecos '' appuser \
    && chown -R appuser:appuser /app

# Runtime dirs for SQLite DB, snapshots, backups
RUN mkdir -p /app/data /app/snapshots /app/backups \
    && chown appuser:appuser /app/data /app/snapshots /app/backups

USER appuser

EXPOSE 8233
