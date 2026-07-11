<div align="center">

# 🚗 Karna — كارنا

### AI-Powered Used Car Marketplace for Egypt

*A full-stack graduation project featuring ML-driven price prediction, an LLM-powered chatbot, and a role-based marketplace platform tailored for the Egyptian used-car market.*

[![.NET](https://img.shields.io/badge/.NET_10-512BD4?style=for-the-badge&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![SQL Server](https://img.shields.io/badge/SQL_Server_2022-CC2927?style=for-the-badge&logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/en-us/sql-server)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Features](#-features)
  - [Buyer Features](#-buyer-features)
  - [Seller Features](#-seller-features)
  - [Admin Features](#-admin-features)
  - [ML Pricing Engine](#-ml-pricing-engine)
  - [AI Chatbot](#-ai-chatbot)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running with Docker Compose](#running-with-docker-compose)
  - [Running Services Individually](#running-services-individually)
- [API Reference](#-api-reference)
- [ML Model Details](#-ml-model-details)
- [Monitoring](#-monitoring)
- [Team](#-team)

---

## 🌟 Overview

**Karna (كارنا)** is an end-to-end used car marketplace designed specifically for the Egyptian market. It combines a modern web platform with two specialized AI microservices:

1. **ML Pricing Engine** — Predicts a fair market price for any used car using an XGBoost + LightGBM ensemble trained on 26,000+ Egyptian listings, providing confidence intervals, SHAP-based explanations, and a "Good Deal" indicator.

2. **LLM Chatbot** — A conversational AI assistant that answers car-related questions in both Arabic and English, grounded in a verified local knowledge base (specs, market notes, fuzzy matching).

The platform supports three distinct roles — **Buyer**, **Seller**, and **Admin** — each with a dedicated, role-specific UI.

---

## 🏛 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                        │
│               React 19 + TypeScript + Vite                  │
│              (Port 5173 — Arabic/English i18n)               │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP
┌────────────────────────────▼────────────────────────────────┐
│                   .NET 9 REST API (Backend)                  │
│              Clean Architecture — Port 9090                  │
│  Domain → Application → Infrastructure → Controllers/API     │
└──────┬──────────────────────┬───────────────────────────────┘
       │ SQL                  │ HTTP
       ▼                      ▼
┌─────────────┐    ┌──────────────────────────────────────────┐
│ SQL Server  │    │         Python Microservices             │
│    2022     │    │                                          │
│  Port 1433  │    │  ┌──────────────┐  ┌──────────────────┐ │
└─────────────┘    │  │  ML Service  │  │   AI Service     │ │
                   │  │  (FastAPI)   │  │   (FastAPI)      │ │
                   │  │  Port 8001   │  │   Port 8000      │ │
                   │  │  XGB + LGBM  │  │  LLM Fallback    │ │
                   │  │  Ensemble    │  │  Chain + RAG     │ │
                   │  └──────────────┘  └──────────────────┘ │
                   └──────────────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │    Monitoring      │
                   │ Prometheus+Grafana │
                   └───────────────────┘
```

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite (Rolldown) | Build tool |
| TailwindCSS v4 | Styling |
| Framer Motion | Animations |
| TanStack Query v5 | Server state management |
| React Router v7 | Client-side routing |
| i18next | Arabic / English internationalization |
| Axios | HTTP client |
| Lucide React | Icons |
| Sonner | Toast notifications |
| Storybook | Component design system |

### Backend (.NET 10)
| Technology | Purpose |
|---|---|
| ASP.NET Core 10 | Web API framework |
| Entity Framework Core | ORM |
| ASP.NET Identity | Authentication & user management |
| JWT + Refresh Tokens | Stateless auth |
| Clean Architecture | Domain / Application / Infrastructure / API |
| AutoMapper | DTO mapping |
| FluentValidation | Request validation |
| Specification Pattern | Reusable query logic |

### ML Service (Python)
| Technology | Purpose |
|---|---|
| FastAPI | REST API |
| XGBoost | Quantile regression (price prediction) |
| LightGBM | Quantile regression (price prediction) |
| SHAP | Explainable AI — feature attribution |
| Pandas / NumPy | Data processing |
| Scikit-learn | Preprocessing pipelines |
| Optuna | Hyperparameter tuning |
| Joblib | Model serialization |
| Streamlit | Admin ML dashboard |

### AI Service (Python)
| Technology | Purpose |
|---|---|
| FastAPI | REST API |
| DeepInfra API | LLM provider (Claude, Gemini, Qwen) |
| SambaNova API | LLM fallback (Llama 3.3 70B) |
| Google Gemini SDK | Final LLM fallback |
| RapidFuzz | Fuzzy car name matching |
| PyYAML | Prompt configuration |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Containerization & orchestration |
| SQL Server 2022 | Primary database |
| Prometheus | Metrics collection |
| Grafana | Metrics visualization |

---

## ✨ Features

### 🛒 Buyer Features
- **Browse Listings** — Paginated, filterable, sortable feed of approved car listings
- **Car Details** — Full vehicle specs, photo gallery, condition checklist with grade, SHAP-based pricing explanation, and "Good Deal" indicator
- **Favorites** — Save and manage favorite listings
- **Contact Seller** — Direct phone and WhatsApp contact links
- **AI Chatbot** — Ask any car question in Arabic or English
- **Profile Management** — Update personal information

### 🏷 Seller Features
- **Add Listing** — Multi-step listing form with real-time ML price prediction and confidence score
- **Edit Listing** — Update listing details and photos
- **My Listings** — Manage all personal listings with status tracking
- **Analytics** — View listing performance data
- **ML Price Guidance** — Receive fair price estimates, negotiation ranges, and SHAP-based price factor explanations at listing time

### 🔧 Admin Features
- **User Management** — View, activate, and deactivate user accounts
- **Listing Approval** — Review pending listings, approve or reject with reason
- **Makes & Models Management** — Full CRUD for car brands and models
- **Condition Checklists** — Manage defect categories and condition items for listing inspections
- **Market Re-evaluation** — Trigger background ML re-pricing of all active listings
- **Activity Logs** — Audit trail of all admin actions
- **Analytics Dashboard** — Platform-wide usage statistics

### 🤖 ML Pricing Engine

The ML service is a **frozen ensemble** of XGBoost and LightGBM quantile regression models trained on **~15,000 cleaned Egyptian used-car listings**.

**Prediction Pipeline:**
```
Request → Pydantic Validation → Make/Model Canonicalization
→ Feature Engineering (5-tier spec fallback)
→ Parallel Ensemble Inference (XGB + LGBM)
→ Robust Weighted Average
→ Confidence Scoring (MAPE + Support + Interval Width)
→ Negotiation Band Calculation
→ SHAP Explainability (Factor Expert)
→ Egyptian Market Price Rounding
→ JSON Response
```

**Model Performance (v2.1.2):**
| Metric | Value |
|---|---|
| MAPE | 11.23% |
| MAE | ~42,000 EGP |
| R² | 0.892 |
| Within ±15% | > 70% |

**Key ML Capabilities:**
- **15 input features** including make, model, year, mileage, fuel, transmission, engine CC, horsepower, location, body type, drivetrain, and segment
- **5-tier spec fallback** — auto-fills missing specs from a 4,300-row lookup table
- **Confidence labels** (High / Medium / Low) based on MAPE, training support count, and prediction interval width
- **Negotiation ranges** calibrated by confidence tier
- **SHAP explanations** translated into plain-language market statements in English
- **Model registry** — zero-downtime model hot-swap via admin API
- **Promotion gates** — new models only go to production if MAPE ≤ 15% and R² ≥ 0.80

### 💬 AI Chatbot

A context-aware conversational assistant for the Egyptian car market with **LLM provider fallback chain**:

```
Gemini Flash → DeepInfra Claude Sonnet → Claude Opus
→ Qwen 3 235B → Gemini Pro → SambaNova Llama 3.3 70B
```

**Capabilities:**
- Answers questions in **Arabic and English**
- Fuzzy lookup against verified local car specs database
- Grounded responses with verified specs (prevents hallucinations)
- Conversation history (up to 20 turns, in-memory)
- Smart output sanitization — strips reasoning tokens, CJK characters, and normalizes typography

---

## 📁 Project Structure

```
Karna-GP/
├── frontend/                    # React 19 + TypeScript SPA
│   └── src/
│       ├── pages/
│       │   ├── (public)/        # Home, About, Contact
│       │   ├── (auth)/          # Login, Register
│       │   ├── (buyer)/         # Feed, Car Details, Favorites, Profile
│       │   ├── (seller)/        # Add/Edit Listing, My Listings, Analytics
│       │   └── (admin)/         # Dashboard, Users, Approvals, Makes/Models
│       ├── components/          # Reusable UI components
│       ├── hooks/               # Custom React hooks
│       ├── locales/             # i18n translation files (ar/en)
│       └── types/               # TypeScript types
│
├── backend/KARNA/               # ASP.NET Core 10 — Clean Architecture
│   ├── Karna.Core.Domain/       # Entities, Enums
│   ├── Karna.Core.Application/  # Services, DTOs, Validators, Specifications
│   ├── Karna.Core.Application.Abstraction/  # Interfaces
│   ├── Karna.Infrastructure/    # Identity, external services
│   ├── Karna.Infrastructure.Persistence/   # EF Core, Migrations
│   ├── Karna.APIs.Controllers/  # API Controllers
│   └── Karna.APIs/              # Entry point, middleware, DI
│
├── ml-service/                  # FastAPI ML pricing microservice
│   ├── app/
│   │   ├── api/                 # Endpoints (/predict, /admin/*)
│   │   ├── services/            # Feature builder, predictor, confidence, SHAP
│   │   └── core/                # Config, model registry
│   ├── models/                  # Model pickles, metadata, registry
│   ├── notebooks/               # Training notebooks (XGBoost/LightGBM)
│   ├── scripts/                 # Data cleaning scripts
│   └── admin/                   # Streamlit admin dashboard
│
├── ai-service/                  # FastAPI LLM chatbot microservice
│   ├── app/
│   │   ├── api/                 # Chat endpoint
│   │   ├── services/            # LLM service, car lookup, context builder
│   │   └── prompts/             # Chatbot prompt YAML config
│   └── data/                    # AI_lookup.csv (car specs KB)
│
├── packages/design-system/      # Shared Storybook component library
├── monitoring/                  # Prometheus + Grafana config
├── docker-compose.yml           # Main compose file
└── docker-compose.monitoring.yml # Monitoring stack compose
```

---

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (v24+)
- [Docker Compose](https://docs.docker.com/compose/) (v2+)
- Git

### Environment Variables

Copy the sample and fill in your API keys:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DEEPINFRA_API_KEY` | DeepInfra API key (LLM fallback chain) |
| `SAMBA_NOVA_API_KEY` | SambaNova API key (Llama fallback) |
| `GEMINI_API_KEY` | Google Gemini API key (final fallback) |
| `SA_PASSWORD` | SQL Server SA password |

### Running with Docker Compose

**Start the full stack:**
```bash
docker compose up --build
```

**Start with monitoring (Prometheus + Grafana):**
```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up --build
```

**Services will be available at:**

| Service | URL |
|---|---|
| 🌐 Frontend | http://localhost:5173 |
| ⚙️ Backend API | http://localhost:9090 |
| 🤖 ML Service | http://localhost:8001 |
| 💬 AI Service | http://localhost:8000 |
| 📊 ML Admin Dashboard (Streamlit) | http://localhost:8502 |
| 📈 Grafana | http://localhost:3000 |
| 🔬 Prometheus | http://localhost:9090/metrics |
| 🗄️ SQL Server | localhost:1433 |

### Running Services Individually

**Frontend (dev):**
```bash
cd frontend
npm install
npm run dev
```

**Backend:**
```bash
cd backend/KARNA
dotnet run --project Karna.APIs
```

**ML Service:**
```bash
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**AI Service:**
```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📡 API Reference

### Backend REST API (Port 9090)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Register a new user |
| `POST` | `/api/auth/login` | — | Login, get JWT + refresh token |
| `POST` | `/api/auth/refresh` | — | Refresh access token |
| `GET` | `/api/listings` | — | Get approved listings (paginated, filtered) |
| `GET` | `/api/listings/{id}` | — | Get listing details |
| `POST` | `/api/listings` | Seller | Create a new listing |
| `PUT` | `/api/listings/{id}` | Seller | Update a listing |
| `DELETE` | `/api/listings/{id}` | Seller | Delete a listing |
| `GET` | `/api/listings/my` | Seller | Get seller's own listings |
| `POST` | `/api/favorites/{listingId}` | Buyer | Toggle favorite |
| `GET` | `/api/favorites` | Buyer | Get favorited listings |
| `GET` | `/api/admin/listings/pending` | Admin | Get pending approval queue |
| `POST` | `/api/admin/listings/{id}/approve` | Admin | Approve a listing |
| `POST` | `/api/admin/listings/{id}/reject` | Admin | Reject a listing |
| `GET` | `/api/admin/users` | Admin | List all users |
| `POST` | `/api/admin/users/{id}/toggle` | Admin | Activate / deactivate user |
| `POST` | `/api/admin/market-reevaluation` | Admin | Trigger ML market re-pricing |
| `GET` | `/api/makes` | — | List all car makes |
| `GET` | `/api/models` | — | List all car models |

### ML Service (Port 8001)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/predict` | Predict car price (returns fair price, range, confidence, SHAP factors) |
| `GET` | `/health` | Health check |
| `GET` | `/admin/models` | List all registered models |
| `POST` | `/admin/models/{id}/activate` | Activate a model (hot-swap) |

### AI Service (Port 8000)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/chat` | Send a chat message (supports `model` field for explicit selection) |
| `POST` | `/api/v1/chat/reset` | Clear in-memory conversation history |
| `GET` | `/health` | Health check |

---

## 🧠 ML Model Details

### Training Data
- **Source**: ~26,000 scraped Egyptian used-car listings (Rounds 1–8)
- **After cleaning**: ~15,000 processed samples
- **Features**: 15 features (6 numerical + 9 categorical)

### Data Pipeline Phases
1. **Make/Model Canonicalization** — Fixes 104 wrong-pair entries, quarantines 54 invalid entries
2. **Spec Conflict Resolution** — Eliminates all 46 ambiguous (make, model, year) groups
3. **EV Fixes** — Corrects fuel/transmission for electric vehicles
4. **Impossible Year Cleaning** — Removes pre-production model-year combinations
5. **Raw Data Pipeline** — End-to-end cleaning of scraped data
6. **Data Cleansing Notebook** — Deduplication, imputation, location normalization, lookup merge
7. **Training Notebook** — XGBoost + LightGBM quantile regression with Optuna tuning

### Feature Engineering
```
Numerical:  year, mileage_km, mileage_per_year, engine_cc, horsepower, seating_capacity
Categorical: make, model, transmission, fuel, location, body_type, drivetrain, brand_origin, car_segment
```

### Promotion Gates (before production deployment)
| Gate | Threshold |
|---|---|
| Holdout MAPE | ≤ 15.0% |
| Holdout R² | ≥ 0.80 |
| Within ±15% | ≥ 70.0% |
| CV MAPE | ≤ 15.0% |
| Errors > 30% (supported cars) | ≤ 10.0% |
| Errors > 50% (supported cars) | ≤ 2.0% |

---

## 📊 Monitoring

The monitoring stack (Prometheus + Grafana) is optional and can be started alongside the main stack:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

- **Grafana** → http://localhost:3000 (default: `admin` / `admin`)
- **Prometheus** → http://localhost:9090

---

## 👥 Team

This project is a graduation project developed by students of the Faculty of Computers and Artificial Intelligence, Helwan University (FCAI-HU), Level 4.

---

<div align="center">
  <sub>Built with ❤️ for the Egyptian used car market</sub>
</div>
