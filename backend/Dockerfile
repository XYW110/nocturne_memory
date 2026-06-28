# ============================================================
# Stage 1: Build frontend (pnpm)
# ============================================================
FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

# 用 npm 代替 pnpm，避免 pnpm 11 的 ERR_PNPM_IGNORED_BUILDS 问题
COPY frontend/package.json ./
RUN npm install

COPY frontend/index.html frontend/vite.config.js frontend/tailwind.config.js frontend/postcss.config.js ./
COPY frontend/src/ ./src/

RUN npm run build

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
    && chown -R appuser:appuser /app /frontend

# Runtime dirs for SQLite DB, snapshots, backups
RUN mkdir -p /app/data /app/snapshots /app/backups \
    && chown appuser:appuser /app/data /app/snapshots /app/backups

RUN chmod +x /app/entrypoint.sh \
    && chown appuser:appuser /app/entrypoint.sh

USER appuser

ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 8233
