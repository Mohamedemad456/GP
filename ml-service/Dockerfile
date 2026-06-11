# ================================================================
# Stage 1: Builder — install dependencies in an isolated venv
# ================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Install build toolchain and database dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# Create a virtual‑env so we can copy it cleanly to the runtime stage
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ================================================================
# Stage 2: Runtime — lean production image
# ================================================================
FROM python:3.11-slim AS runtime

# ── Environment ──────────────────────────────────────────────────
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Copy only the pre‑built venv
COPY --from=builder /opt/venv /opt/venv

# ── Application code ────────────────────────────────────────────
COPY . .

RUN chmod +x /app/entrypoint.sh

# ── Port & health check ─────────────────────────────────────────
EXPOSE 8001 8501

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"]

# ── Start ────────────────────────────────────────────────────────
CMD ["/app/entrypoint.sh"]