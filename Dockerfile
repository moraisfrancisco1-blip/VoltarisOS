# =============================================================================
# VoltarisOS — Production Dockerfile
# =============================================================================
# Multi-stage build: frontend + backend + all modules
# Optimized for Railway deployment
# =============================================================================

# Stage 1: Build frontend
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --prefer-offline
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend + serve frontend
# Same minor version as CI (.github/workflows/tests.yml), so what is tested is what ships.
FROM python:3.12-slim AS production
WORKDIR /app

# Install system dependencies
# libpango*/libharfbuzz-subset0/fonts: runtime libraries for weasyprint (PDF reports).
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz-subset0 \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/
COPY forecasting/ ./forecasting/
COPY optimization/ ./optimization/
COPY simulation/ ./simulation/
COPY trading/ ./trading/
COPY gateway/ ./gateway/
COPY legal/ ./legal/
COPY load_test/ ./load_test/
COPY control/ ./control/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Copy startup script
COPY start.sh ./
RUN chmod +x start.sh

# Create non-root user for security
RUN useradd -m -u 1000 voltaris && chown -R voltaris:voltaris /app
USER voltaris

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://localhost:8000/health'); r.raise_for_status()"

EXPOSE 8000

# Production environment
# PYTHONPATH: the Celery CLI only puts the cwd on sys.path while it imports
# backend.tasks, so lazy imports inside tasks (`from forecasting...`,
# `from optimization...`) failed with ModuleNotFoundError in the worker even
# though the packages are in /app.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    ENVIRONMENT=production

CMD ["./start.sh"]
