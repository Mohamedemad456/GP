#!/bin/bash
set -e

# Start Streamlit admin dashboard in the background
streamlit run admin/dashboard.py --server.port 8501 --server.address 0.0.0.0 --server.headless true &

# Start FastAPI app in the foreground
exec uvicorn app.main:app --host 0.0.0.0 --port 8001
