# ================================================================
# Stage 1: Builder — install dependencies in an isolated venv
# ================================================================
FROM python:3.13-slim AS builder

WORKDIR /build

# Install build toolchain for any compiled packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential && \
    rm -rf /var/lib/apt/lists/*

# Create a virtual‑env so we can copy it cleanly to the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python deps (layer cached until requirements.prod.txt changes)
COPY requirements.prod.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.prod.txt


# ================================================================
# Stage 2: Runtime — lean production image
# ================================================================
FROM python:3.13-slim AS runtime

# Install tzdata so TZ environment variable is respected
RUN apt-get update && \
    apt-get install -y --no-install-recommends tzdata && \
    rm -rf /var/lib/apt/lists/*

# ── Environment ──────────────────────────────────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy only the pre‑built venv (no compiler, no headers)
COPY --from=builder /opt/venv /opt/venv

# ── Non‑root user ───────────────────────────────────────────────
RUN groupadd --gid 1000 appuser && \
    useradd  --uid 1000 --gid appuser --shell /bin/bash --create-home appuser

# ── Application code + data (bundled) ───────────────────────────
COPY ./app ./app
COPY ./data ./data

RUN mkdir -p /app/logs

RUN chown -R appuser:appuser /app
USER appuser

# ── Port & health check ─────────────────────────────────────────
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]

# ── Start ────────────────────────────────────────────────────────
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
