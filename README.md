<h1 align="center">Kompon</h1>

<p align="center">
  <strong>AI-powered earthquake risk screening for Bangladesh</strong>
</p>

<p align="center">
  <a href="#live-demo">Live Demo</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#ml-models">ML Models</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#api-reference">API Reference</a> •
  <a href="#devops--deployment">DevOps</a> •
  <a href="#team">Team</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Express-4-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express 4" />
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/PyTorch-2.5-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white" alt="PyTorch" />
  <img src="https://img.shields.io/badge/YOLOv8-Ultralytics-5C2D91?style=for-the-badge" alt="YOLOv8" />
  <img src="https://img.shields.io/badge/LightGBM-4.5-green?style=for-the-badge" alt="LightGBM" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/DuckDB-In--Memory-FFF000?style=for-the-badge" alt="DuckDB" />
</p>

---

## 📋 Table of Contents

- [What Is Kompon?](#what-is-kompon)
- [The Problem](#the-problem)
- [Live Demo](#live-demo)
- [Features](#features)
- [Architecture](#architecture)
  - [System Architecture Diagram](#system-architecture-diagram)
  - [ML Inference Pipeline](#ml-inference-pipeline)
  - [Risk Assessment Pipeline (End-to-End)](#risk-assessment-pipeline-end-to-end)
- [ML Models — Deep Dive](#ml-models--deep-dive)
  - [Model 0 — Image Validity Gate (MobileNetV3-Small)](#model-0--image-validity-gate-mobilenetv3-small)
  - [Model A — Crack/Damage Segmentation (YOLOv8-seg)](#model-a--crackdamage-segmentation-yolov8-seg)
  - [Model 3 — Scenario Liquefaction Scoring (LightGBM)](#model-3--scenario-liquefaction-scoring-lightgbm)
  - [Model Weight Loading Strategy](#model-weight-loading-strategy)
- [Scoring Engine](#scoring-engine)
- [Backend — Full Pipeline](#backend--full-pipeline)
  - [Server Architecture](#server-architecture)
  - [API Routes](#api-routes)
  - [Services Layer](#services-layer)
  - [Middleware Stack](#middleware-stack)
  - [Database & Data Layer](#database--data-layer)
- [Frontend — Full Pipeline](#frontend--full-pipeline)
  - [Component Architecture](#component-architecture)
  - [Pages & Sections](#pages--sections)
- [Redis & Caching Strategy](#redis--caching-strategy)
- [LLM-Powered Chatbot](#llm-powered-chatbot)
- [DevOps & Deployment](#devops--deployment)
  - [Docker Compose](#docker-compose)
  - [Dockerfiles](#dockerfiles)
  - [CI/CD Pipeline (GitHub Actions)](#cicd-pipeline-github-actions)
  - [Nginx Configuration](#nginx-configuration)
  - [Environment Variables](#environment-variables)
- [External APIs & Data Sources](#external-apis--data-sources)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Figma Design](#figma-design)
- [Disclaimer](#disclaimer)
- [License](#license)
- [Team](#team)

---

## What Is Kompon?

**Kompon** (কম্পন — meaning *tremor* in Bengali) is a full-stack, AI-powered earthquake risk screening platform built specifically for **Bangladesh** — a country that sits at the junction of three tectonic plates and has been struck by over 250 earthquakes in the last 50 years.

Users upload a photo of building damage, answer a short structural questionnaire, and optionally share their location. Kompon runs the image through **three machine learning models** in sequence, combines the results with geospatial hazard data, and produces a **risk tier** (Very Low → Very High) with an actionable **preparedness checklist** and **engineer referral recommendation**.

> **⚠️ Important:** Kompon is a *screening tool*, not a safety certificate. High/Very High findings should always be referred to a licensed structural engineer.

---

## The Problem

Bangladesh is one of the most seismically vulnerable countries in the world:

- **Tectonic exposure**: Located at the convergence of the Indian, Eurasian, and Burmese plates.
- **Dense urban population**: Cities like Dhaka and Chittagong have millions living in aging masonry and informal structures.
- **Limited access to structural engineers**: Most residents cannot afford or access professional building inspections.
- **Information gap**: Earthquake news, safe evacuation points, and emergency contacts are scattered across disparate sources.

Kompon addresses all of these with a single integrated platform.

---

## Live Demo

| Service | URL |
|---------|-----|
| 🌐 **Frontend** | *Deployed on Render* |
| ⚙️ **Backend API** | *Deployed on Render* |
| 🤖 **ML Inference Space** | [huggingface.co/spaces/iloveass/kompon-ml](https://huggingface.co/spaces/iloveass/kompon-ml) |
| 🎨 **Figma Design** | [Kompon Figma](https://www.figma.com/design/ZbLVEt064GSs1NJP2MlDBd/Kompon-Figma?node-id=0-1&t=foqY0T42qPtoZCUY-1) |

---

## Features

### 🔍 Building Inspection & Risk Assessment
- **Image-based damage detection** — upload a photo of a building crack/damage
- **3-model ML pipeline** — Gate → Crack Segmentation → Scenario Scoring
- **Structural vulnerability questionnaire** (FEMA P-154 inspired)
- **Weighted multi-factor risk scoring** with 5-tier output (Very Low → Very High)
- **Automatic engineer referral recommendation** for High/Very High tiers
- **Preparedness checklist** generated based on assessment results

### 🗺️ Interactive Hazard Map
- **Leaflet-based interactive map** centered on Bangladesh
- **Ground susceptibility heatmap** — national grid overlay showing soil vulnerability
- **8 earthquake scenario layers** — pre-computed shaking intensity for M5.0–M6.9 events
- **Safe places overlay** — parks, open fields, playgrounds via OpenStreetMap Overpass API
- **Fire brigade directory** — searchable by district/upazila with phone numbers

### 📰 Real-Time Earthquake Alerts & News
- **USGS GeoJSON feed** — live earthquake data with South Asia focus
- **Regional priority sorting** — Bangladesh → South Asia → Asia → Global
- **Earthquake news aggregation** — Currents API primary, GDELT fallback
- **Cron-refreshed cache** — never blocks user requests

### 🤖 AI Safety Chatbot
- **Dual-provider LLM** — Groq (Llama 3.1 8B) primary, Gemini 2.5 Flash fallback
- **Function calling** — live USGS earthquake data via tool use
- **Domain-locked** — only answers earthquake safety, preparedness, and Kompon usage questions
- **Jailbreak-resistant** system prompt

### 🚒 Emergency Services Directory
- **Fire brigade lookup** by district and upazila
- **Phone numbers and station names** for all Bangladesh divisions
- **MongoDB-backed** with JSON fallback for offline operation

---

## Architecture

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                │
│  React 19 + Vite + Tailwind CSS + Framer Motion + Leaflet          │
│  Pages: Home → Alerts → Inspect → Relief                          │
│  Components: Navbar, Hero, Map, Chatbot, EarthquakeNotification,   │
│              InspectResults, FireServiceSection, Footer             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (Axios)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXPRESS BACKEND (Node 20)                       │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Security │  │  CORS    │  │Rate Limit │  │   Compression    │  │
│  │ (helmet) │→ │(locked)  │→ │(Upstash)  │→ │   (gzip)         │  │
│  └──────────┘  └──────────┘  └───────────┘  └──────────────────┘  │
│                                                                     │
│  API Routes (v1):                                                  │
│  ├─ POST /v1/risk-assessment  ← Core feature (multipart)          │
│  ├─ GET  /v1/news/earthquakes ← Cached news feed                  │
│  ├─ GET  /v1/earthquakes/recent ← USGS live feed                  │
│  ├─ GET  /v1/safe-places      ← Overpass/OSM query                │
│  ├─ GET  /v1/fire-brigade/search ← MongoDB/JSON lookup            │
│  ├─ GET  /v1/hazard/static    ← DuckDB heatmap layers             │
│  ├─ POST /v1/chat             ← LLM chatbot                       │
│  └─ GET  /health              ← UptimeRobot health check          │
│                                                                     │
│  Services:                                                         │
│  ├─ mlClient.js       → HF Space (HTTP/keep-alive)                │
│  ├─ scoringEngine.js  → Rule-based score combination               │
│  ├─ redisClient.js    → Upstash Redis (REST)                      │
│  ├─ duckdbClient.js   → DuckDB in-memory (Parquet)                │
│  ├─ llmClient.js      → Groq + Gemini dual-provider               │
│  ├─ newsClient.js     → Currents + GDELT                          │
│  ├─ earthquakeFeedClient.js → USGS GeoJSON                        │
│  ├─ overpassClient.js → OpenStreetMap                              │
│  └─ heatmapCache.js   → CSV→JSON pre-computation                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (Axios, keep-alive)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│              HUGGING FACE SPACE (Docker, cpu-basic)                 │
│              FastAPI + Uvicorn on port 7860                        │
│                                                                     │
│  POST /infer/image-risk                                            │
│  ┌────────────────┐     ┌─────────────────────┐                    │
│  │ Model 0 (Gate) │ ──→ │ Model A (YOLOv8-seg)│                   │
│  │ MobileNetV3    │     │ 5-class damage       │                   │
│  │ 3-class        │     │ segmentation         │                   │
│  └────────────────┘     └─────────────────────┘                    │
│                                                                     │
│  POST /infer/scenario-score                                        │
│  ┌─────────────────────────────┐                                   │
│  │ Model 3 (LightGBM)         │                                   │
│  │ Scenario liquefaction       │                                   │
│  │ regressor                   │                                   │
│  └─────────────────────────────┘                                   │
│                                                                     │
│  GET /health                                                       │
└─────────────────────────────────────────────────────────────────────┘

External Services:
  ├─ Upstash Redis      — Caching + rate limiting (REST API)
  ├─ MongoDB Atlas      — Fire brigade directory
  ├─ USGS               — Live earthquake feed (GeoJSON)
  ├─ Currents API       — Earthquake news (primary)
  ├─ GDELT DOC 2.0      — Earthquake news (fallback)
  ├─ Overpass/OSM       — Safe places (parks, fields)
  ├─ Groq API           — Llama 3.1 8B (chatbot primary)
  ├─ Google Gemini API  — Gemini 2.5 Flash (chatbot fallback)
  └─ HF Datasets        — Parquet serving data (hazard grids)
```

### ML Inference Pipeline

```
User uploads image
        │
        ▼
┌──────────────────┐
│  Image Validation │  ← magic-byte check (file-type), EXIF strip,
│  & Preprocessing  │    re-encode via sharp, downscale to 1600px max
└────────┬─────────┘
         │ Buffer (JPEG)
         ▼
┌──────────────────┐
│  MODEL 0 — GATE  │  ← MobileNetV3-Small, 3-class classifier
│                   │    Classes: building_surface, road_or_pavement, other
│  Quality checks:  │    • Resolution ≥ 200px shortest side
│  • Blur (Laplacian│    • Brightness 40–215 mean luma
│    variance ≥ 60) │    • Confidence threshold τ = 0.55
│  • Brightness     │    • Accept-on-uncertainty: conf < τ → ACCEPT
│  • Resolution     │
└────────┬─────────┘
         │
    ┌────┴────┐
    │ REJECT? │───────→ Return rejection reason + message to user
    │         │         (road/pavement, too blurry, too dark, etc.)
    └────┬────┘
         │ ACCEPT
         ▼
┌──────────────────┐
│  MODEL A — CRACK │  ← YOLOv8-seg, 5-class instance segmentation
│  SEGMENTATION    │    • microcrack          → Low concern
│                  │    • structural_crack     → High concern
│  imgsz=640       │    • spalling             → Moderate concern
│  conf=0.25       │    • rebar_corrosion      → Very High concern
│                  │    • severe_distress       → Very High concern
│  Outputs:        │
│  • Per-detection │    Coverage modulation:
│    class + conf  │    • spalling ≥ 15% coverage → Very High
│  • Coverage %    │    • structural_crack ≥ 10% → Very High
│  • Severity tier │
│  • Escalation    │    OOD fail-safe:
│    flag          │    • Only tiny, low-conf fragments → "Unclear"
└────────┬─────────┘
         │
         ▼
  Severity Tier: Very Low | Low | Moderate | High | Very High | Unclear
```

### Risk Assessment Pipeline (End-to-End)

```
                    ┌─────────────────────────┐
                    │  User Submission         │
                    │  • Image (required)      │
                    │  • Questionnaire (opt.)  │
                    │  • Location lat/lon (opt.)│
                    │  • scenario_event_id (opt)│
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
     ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐
     │ ML Space Call  │ │ Questionnaire │ │ Geospatial       │
     │ (Model 0 + A) │ │ Scoring       │ │ Lookups          │
     │                │ │ (FEMA P-154   │ │ • DuckDB hazard  │
     │ Gate → Crack   │ │  inspired)    │ │   grid (Parquet) │
     │ analysis       │ │               │ │ • Scenario point │
     └───────┬────────┘ └───────┬───────┘ │   lookup         │
             │                  │         │ • Model 3 call   │
             │                  │         │   (LightGBM)     │
             │                  │         └────────┬─────────┘
             ▼                  ▼                  ▼
     ┌────────────────────────────────────────────────────┐
     │              SCORING ENGINE                        │
     │                                                    │
     │  Component Scores (0–100 each):                   │
     │  ├─ Structural Vulnerability  (weight: 0.35)      │
     │  ├─ Crack Evidence            (weight: 0.30)      │
     │  ├─ Site Hazard               (weight: 0.20) *opt │
     │  └─ Scenario Shaking          (weight: 0.15) *opt │
     │                                                    │
     │  Missing components → proportional redistribution │
     │                                                    │
     │  Escalation override (non-negotiable):            │
     │  • Crack severity == "Very High" → floor at High  │
     │  • Gate confidence < 0.5 → floor at High          │
     │  • High/Very High → engineer referral recommended │
     └──────────────────────┬─────────────────────────────┘
                            │
                            ▼
     ┌────────────────────────────────────────────────────┐
     │                 FINAL OUTPUT                       │
     │  • final_score (0–100)                            │
     │  • final_tier (Very Low→Very High)                │
     │  • breakdown (per-component scores & weights)     │
     │  • escalation_applied (boolean)                   │
     │  • engineer_referral_recommended (boolean)        │
     │  • preparedness_checklist (string[])              │
     │  • gate result + crack_analysis + site_hazard     │
     │  • disclaimer (always present)                    │
     └────────────────────────────────────────────────────┘
```

---

## ML Models — Deep Dive

### Model 0 — Image Validity Gate (MobileNetV3-Small)

| Property | Detail |
|----------|--------|
| **Architecture** | MobileNetV3-Small (torchvision) |
| **Task** | 3-class image classification |
| **Classes** | `building_surface`, `road_or_pavement`, `other` |
| **Input** | RGB image, resized to configured `img_size` |
| **Preprocessing** | `Resize → ToTensor → Normalize(mean, std)` |
| **Confidence threshold** | τ = 0.55 |
| **Accept-on-uncertainty** | If confidence < τ → **ACCEPT** (never block a real crack) |
| **Weights** | `gate_mobilenetv3.pth` (~4MB) |
| **Config** | `gate_config.json` (classes, img_size, mean, std) |
| **HF Model Repo** | `iloveass/kompon-image-gate` |

**Quality pre-checks** (runs before the neural network):
- **Resolution**: Shortest side must be ≥ 200px
- **Brightness**: Mean luma must be between 40–215 (rejects too dark / overexposed)
- **Blur detection**: Variance of Laplacian ≥ 60 (manual 3×3 kernel, no OpenCV dependency)

**Design philosophy**: The gate uses an *accept-on-uncertainty* strategy — it's better to run Model A on a borderline image than to reject a genuine building crack.

---

### Model A — Crack/Damage Segmentation (YOLOv8-seg)

| Property | Detail |
|----------|--------|
| **Architecture** | YOLOv8-seg (Ultralytics) |
| **Task** | Instance segmentation (5 classes) |
| **Classes** | `microcrack`, `structural_crack`, `spalling`, `rebar_corrosion`, `severe_distress` |
| **Input** | PIL Image, inferred at `imgsz=640`, `conf=0.25` |
| **Output per detection** | Class name, confidence, coverage percentage (mask area / frame area) |
| **Weights** | `best.pt` (YOLOv8 checkpoint) |
| **HF Model Repo** | `iloveass/kompon-damage-severity-detection` |

**Severity mapping**:

| Damage Class | Base Concern | Escalation Condition |
|--------------|-------------|----------------------|
| `microcrack` | Low | — |
| `structural_crack` | High | Coverage ≥ 10% → Very High |
| `spalling` | Moderate | Coverage ≥ 15% → Very High |
| `rebar_corrosion` | Very High | — |
| `severe_distress` | Very High | — |

**Out-of-distribution (OOD) fail-safe**: If all detections are tiny fragments (< 1% coverage) with low confidence (< 0.50), the result is marked as **"Unclear"** with `reliable: false` — the system admits uncertainty rather than producing a false negative.

---

### Model 3 — Scenario Liquefaction Scoring (LightGBM)

| Property | Detail |
|----------|--------|
| **Architecture** | LightGBM Booster (regression) |
| **Task** | Predict earthquake-triggered ground failure score (0–100) |
| **Training data** | 8 historical earthquakes, M5.0–M6.9 |
| **Features** | 15 geophysical + seismic features |
| **Output** | `score` (0–100), `scenario_risk_class`, `disclaimer` |
| **Model file** | `scenario_model_v4_regressor.txt` |
| **HF Model Repo** | `iloveass/kompon-ground-failure-model` |

**Input features**:

| Feature | Description | Default |
|---------|-------------|---------|
| `vs30` | Shear-wave velocity (m/s) | 250.0 |
| `elevation_m` | Elevation above sea level | 10.0 |
| `slope_deg` | Surface slope in degrees | 0.5 |
| `dist_water_m` | Distance to nearest water body | 1000.0 |
| `water_occurrence_pct` | Surface water occurrence | 0.0 |
| `geology_class` | Geological classification | "Unknown" |
| `hand_m` | Height Above Nearest Drainage | 10.0 |
| `water_max_extent` | Maximum water extent | 0.0 |
| `dynamic_label_name` | Dynamic label classification | "Unknown" |
| `magnitude` | Earthquake magnitude | *required* |
| `depth_km` | Earthquake depth in km | *required* |
| `dist_epicenter_km` | Distance from epicenter | *required* |
| `pga_g_filled` | Peak Ground Acceleration (g) | *required* |
| `pgv_cms_filled` | Peak Ground Velocity (cm/s) | *required* |
| `mmi_filled` | Modified Mercalli Intensity | *required* |

**Risk classification**:

| Score Range | Risk Class |
|------------|------------|
| 0 – 19 | Very Low |
| 20 – 39 | Low |
| 40 – 59 | Moderate |
| 60 – 79 | High |
| 80 – 100 | Very High |

---

### Model Weight Loading Strategy

All three models use a **dynamic weight loading** strategy:

1. **Check local path** — if the weight file exists locally and is > 500 bytes (not a Git LFS pointer), use it.
2. **Download from Hugging Face Hub** — if the local file is missing or is an LFS pointer, download the real weights from the configured HF model repo via `huggingface_hub.hf_hub_download()`.

This allows the Docker container to start with an empty `weights/` directory and fetch models dynamically, avoiding bloated Docker images.

```python
# Environment variables controlling model repos:
HF_MODEL_REPO_GATE     = "iloveass/kompon-image-gate"
HF_MODEL_REPO_CRACK    = "iloveass/kompon-damage-severity-detection"
HF_MODEL_REPO_SCENARIO = "iloveass/kompon-ground-failure-model"
HF_SCENARIO_MODEL_FILE = "scenario_model_v4_regressor.txt"
```

---

## Scoring Engine

The **Scoring Engine** (`scoringEngine.js`) combines up to 4 component scores into a single risk assessment:

### Component Weights

| Component | Weight | Source |
|-----------|--------|--------|
| Structural Vulnerability | **0.35** | Questionnaire (FEMA P-154 inspired) |
| Crack Evidence | **0.30** | Model A output |
| Site Hazard | **0.20** | DuckDB Parquet lookup (optional) |
| Scenario Shaking | **0.15** | Model 3 output (optional) |

**Proportional redistribution**: When optional components are missing (no location → no Site Hazard or Scenario), their weights are redistributed proportionally to the remaining components.

### Structural Vulnerability Scoring (FEMA P-154 Lite)

| Factor | Options → Points |
|--------|-----------------|
| Building age | <10y: 0, 10-30y: 15, >30y: 30, unknown: 15 |
| Stories | 1-2: 5, 3-5: 15, 6+: 25 |
| Soft story | yes: 25, no: 0, unsure: 10 |
| Structural material | RC frame: 5, masonry: 20, informal: 30 |
| Foundation settlement | yes: 20, no: 0, unsure: 8 |
| Prior damage | yes: 15, no: 0, unsure: 5 |
| Crack location | column/beam: 30, load-bearing: 20, plaster: 5, unsure: 15 |

Sum is clipped to [0, 100].

### Escalation Override (Non-Negotiable)

```
IF crack_severity == "Very High" OR gate_confidence < 0.5:
    → Floor final_tier at "High"
    → Recommend engineer referral

IF final_tier ∈ {"High", "Very High"}:
    → Always recommend engineer referral
```

---

## Backend — Full Pipeline

### Server Architecture

```
Backend/
├── src/
│   ├── server.js              # Express entry point, middleware chain, cron
│   ├── config/
│   │   └── env.js             # dotenv loader
│   ├── middleware/
│   │   ├── security.js        # helmet + CORS (locked to ALLOWED_ORIGIN)
│   │   ├── rateLimit.js       # Upstash sliding window rate limiter
│   │   └── validate.js        # Zod schemas for all endpoints
│   ├── routes/
│   │   ├── riskAssessment.js  # POST /v1/risk-assessment (core)
│   │   ├── news.js            # GET  /v1/news/earthquakes
│   │   ├── earthquakes.js     # GET  /v1/earthquakes/recent
│   │   ├── safePlaces.js      # GET  /v1/safe-places
│   │   ├── fireBrigade.js     # GET  /v1/fire-brigade/search
│   │   ├── hazard.js          # GET  /v1/hazard/static
│   │   └── chat.js            # POST /v1/chat
│   ├── services/
│   │   ├── mlClient.js        # HF Space HTTP client (keep-alive)
│   │   ├── scoringEngine.js   # Rule-based score combiner
│   │   ├── redisClient.js     # Upstash Redis (REST SDK)
│   │   ├── duckdbClient.js    # DuckDB in-memory Parquet engine
│   │   ├── heatmapCache.js    # CSV→JSON heatmap pre-computation
│   │   ├── llmClient.js       # Groq + Gemini dual-provider LLM
│   │   ├── newsClient.js      # Currents + GDELT news aggregation
│   │   ├── earthquakeFeedClient.js  # USGS GeoJSON feed
│   │   ├── earthquakeTool.js  # LLM function calling tool
│   │   └── overpassClient.js  # OpenStreetMap safe places
│   ├── models/
│   │   ├── FireStation.js     # Mongoose schema
│   │   ├── HazardPoint.js     # Mongoose schema
│   │   └── ScenarioPoint.js   # Mongoose schema
│   └── scripts/
│       └── fetchServingData.js # HF Datasets Parquet downloader
├── data/                       # Runtime data (Parquet, heatmap cache)
├── fire_service.json           # Static fire brigade fallback data
├── package.json
└── .env.example
```

### API Routes

| Method | Endpoint | Rate Limit | Description |
|--------|----------|-----------|-------------|
| `POST` | `/v1/risk-assessment` | 5/min/IP | Core risk assessment (multipart/form-data) |
| `GET` | `/v1/news/earthquakes` | 30/min/IP | Paginated earthquake news (cached) |
| `GET` | `/v1/earthquakes/recent` | 30/min/IP | Live USGS earthquake feed |
| `GET` | `/v1/safe-places` | 20/min/IP | Nearby open/safe places (Overpass) |
| `GET` | `/v1/fire-brigade/search` | 30/min/IP | Fire brigade directory lookup |
| `GET` | `/v1/hazard/static` | 30/min/IP | Heatmap layers (DuckDB + cache) |
| `POST` | `/v1/chat` | Rate limited | AI chatbot (Groq/Gemini) |
| `GET` | `/health` | None | Health check (200 OK) |

### Services Layer

| Service | Purpose | External Dependency |
|---------|---------|-------------------|
| `mlClient.js` | Forwards image/scenario to HF Space via HTTP with keep-alive, 35s timeout | Hugging Face Space |
| `scoringEngine.js` | FEMA P-154 lite scoring, crack evidence derivation, weighted combination, escalation override | None (pure logic) |
| `redisClient.js` | `getCache()` / `setCache()` with TTL via Upstash REST SDK | Upstash Redis |
| `duckdbClient.js` | In-memory DuckDB for Parquet queries — nearest hazard point, scenario point, heatmap layers | DuckDB (in-process) |
| `heatmapCache.js` | Pre-computes static heatmap from CSV → JSON at startup; percentile normalization | Filesystem |
| `llmClient.js` | Dual-provider: Groq (Llama 3.1 8B) → Gemini 2.5 Flash fallback; tool calling for earthquake data | Groq, Google Gemini |
| `newsClient.js` | Currents API primary, GDELT fallback; earthquake-relevance filter; cron-refreshed every 20min | Currents, GDELT |
| `earthquakeFeedClient.js` | USGS GeoJSON feed consumer with regional priority sorting and in-memory cache (30s TTL) | USGS |
| `overpassClient.js` | Overpass QL queries for parks/fields/playgrounds; Haversine distance sorting; Redis cache (7-day TTL); fallback radius cascade | OpenStreetMap |

### Middleware Stack

Request processing order:

```
Request → helmet (security headers)
       → CORS (locked to ALLOWED_ORIGIN, never wildcard)
       → compression (gzip)
       → body parsing (JSON 1MB limit)
       → rate limiting (Upstash sliding window, per-endpoint per-IP)
       → Zod validation (schemas for all inputs)
       → route handler
```

### Database & Data Layer

| Storage | Technology | Purpose |
|---------|-----------|---------|
| **Geospatial queries** | DuckDB (in-memory) | Nearest-point lookup on Parquet files (hazard grid + 8 scenarios) |
| **Parquet data** | HF Datasets repo | 9 files: 1 hazard grid + 8 scenario grids, downloaded at startup |
| **Fire brigade** | MongoDB Atlas | Fire station directory (district/upazila indexed) |
| **Fire brigade fallback** | JSON file | `fire_service.json` — static fallback when MongoDB is unavailable |
| **Caching** | Upstash Redis | News cache (30min), safe places cache (7 days), rate limit counters |
| **Heatmap cache** | Filesystem JSON | Pre-computed CSV→JSON at startup for fast heatmap serving |

---

## Frontend — Full Pipeline

### Component Architecture

```
Frontend/
├── src/
│   ├── main.jsx            # Entry point, React root
│   ├── App.jsx             # Single-page layout: Navbar → Home → Alerts → Inspect → Relief → Footer
│   ├── pages/
│   │   ├── Home.jsx        # Landing section
│   │   ├── Alerts.jsx      # Earthquake alerts + news feed
│   │   ├── Inspect.jsx     # Risk assessment form (image upload + questionnaire)
│   │   └── Relief.jsx      # Safe places + fire brigade directory
│   ├── components/
│   │   ├── Navbar.jsx      # Sticky navigation with section anchors
│   │   ├── Hero.jsx        # Animated hero with seismic annotations
│   │   ├── Map.jsx         # Leaflet map (heatmap + safe places + scenarios)
│   │   ├── Chatbot.jsx     # Floating AI chatbot panel
│   │   ├── EarthquakeNotificationButton.jsx  # Live earthquake ticker
│   │   ├── InspectResults.jsx   # Risk assessment results display
│   │   ├── FireServiceSection.jsx  # Fire brigade search UI
│   │   ├── Footer.jsx      # Site footer with links
│   │   ├── BackToTop.jsx   # Scroll-to-top button
│   │   └── MediaPlaceholder.jsx  # Image placeholder component
│   ├── lib/
│   │   ├── motion.js       # Framer Motion animation presets
│   │   └── typography.js   # Typography scale constants
│   ├── config/
│   │   └── api.js          # Axios instance + VITE_API_ORIGIN
│   └── assets/             # Static assets
├── public/                  # Public static files (logo, hero image)
├── index.html               # SPA entry
├── vite.config.js           # Vite + React plugin config
├── package.json
└── .env.example
```

### Pages & Sections

| Section | Component | Features |
|---------|-----------|----------|
| **Hero** | `Hero.jsx` | Full-bleed background image, animated seismic annotations (SVG), CTA button |
| **Map** | `Map.jsx` | Leaflet interactive map, ground susceptibility heatmap, 8 scenario layers, safe places markers, fire brigade pins |
| **Alerts** | `Alerts.jsx` | USGS earthquake feed with regional priority, news ticker, live data |
| **Inspect** | `Inspect.jsx` | Image upload with drag-and-drop, structural questionnaire, location picker, scenario selector, real-time results |
| **Relief** | `Relief.jsx` | Safe places search (radius-based), fire brigade directory search |
| **Chatbot** | `Chatbot.jsx` | Floating chat panel, message history, tool use indicator |

### Key Frontend Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| React | 19.2 | UI framework |
| Vite | 8.1 | Build toolchain |
| Tailwind CSS | 4.3 | Utility-first styling |
| Framer Motion | 12.42 | Animations and transitions |
| Leaflet + React-Leaflet | 1.9 / 5.0 | Interactive maps |
| Axios | 1.18 | HTTP client |
| Lucide React | 1.23 | Icon library |
| Inter (Fontsource) | 5.2 | Typography |

---

## Redis & Caching Strategy

Kompon uses **Upstash Redis** (REST-based, serverless) for caching and rate limiting:

### Cache Keys & TTLs

| Key Pattern | TTL | Purpose |
|-------------|-----|---------|
| `news:list:v1` | 30 min | Earthquake news articles (Currents/GDELT) |
| `safeplaces:{lat}:{lon}:{radius}` | 7 days | Overpass safe places results (rounded to ~100m) |
| `kompon:ratelimit:{prefix}:{ip}` | 1 min (sliding window) | Per-endpoint rate limit counters |

### Cache Behavior

- **News**: Refreshed by cron every 20 minutes — never fetched synchronously on user requests
- **Safe places**: Redis-cached with rounded lat/lon key clustering (~111m precision) — 7-day TTL since OSM data changes slowly
- **Rate limiting**: Upstash `@upstash/ratelimit` with sliding window algorithm — fails open if Redis is unreachable (never blocks legitimate requests on Redis outage)

### Rate Limits

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Risk Assessment | 5 requests | 1 minute |
| News | 30 requests | 1 minute |
| Safe Places | 20 requests | 1 minute |
| Fire Brigade | 30 requests | 1 minute |
| Hazard | 30 requests | 1 minute |
| General | 60 requests | 1 minute |

---

## LLM-Powered Chatbot

### Architecture

```
User message + history (max 8 turns)
        │
        ▼
┌──────────────────┐
│  Groq API        │  ← Primary provider
│  Llama 3.1 8B    │     temp=0.2, max_tokens=1024
│  Instant         │     tool_choice="auto"
└────────┬─────────┘
         │
    ┌────┴────────┐
    │ Tool call?  │──YES──→ Execute get_recent_earthquakes(region, days, min_mag)
    │             │         ↓ USGS fdsnws API query
    │             │         ↓ Return tool result to LLM
    │             │         ↓ Second LLM call with tool result
    └─────┬───────┘
          │ NO / after tool
          ▼
    Response (or on failure...)
          │
          ▼
┌──────────────────┐
│  Gemini 2.5      │  ← Fallback provider
│  Flash           │     (no tool calling, text only)
└──────────────────┘
```

### Domain Locking

The system prompt strictly limits the chatbot to:
- ✅ Earthquake safety and preparedness
- ✅ First aid for earthquake injuries
- ✅ Recent earthquake information (via tool)
- ✅ Kompon website usage help
- ✅ General structural/seismic concepts
- ❌ Everything else — politely declined

The prompt is jailbreak-resistant: any attempt to change rules, reveal the system prompt, or roleplay as unrestricted is treated as off-topic.

---

## DevOps & Deployment

### Docker Compose

The project runs as a **2-service Docker Compose** stack:

```yaml
services:
  backend:      # Node 20, Express API on port 3001
  frontend:     # Nginx 1.27 serving Vite build on port 80 (mapped to 8080)
```

The ML inference service runs **externally on Hugging Face Spaces** (Docker SDK, port 7860) — it is not part of the Compose stack because it requires GPU-capable hosting for optimal performance.

### Dockerfiles

| Dockerfile | Base | Strategy |
|-----------|------|----------|
| `backend.Dockerfile` | `node:20-bookworm-slim` | Multi-stage: `dependencies` (npm ci --omit=dev) → `runtime` (copy node_modules + src). Built-in healthcheck every 30s. |
| `frontend.Dockerfile` | `node:20-bookworm-slim` → `nginx:1.27-alpine` | Multi-stage: build with Vite → copy dist to Nginx. `VITE_API_ORIGIN` injected at build time via `ARG`. |
| `kompon-ml-space/Dockerfile` | `python:3.10-slim` | Single stage: install system deps (OpenGL/X11 for OpenCV), pip install, empty weights dir (downloaded at runtime). |

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
# Triggers: push to main, all pull requests

Jobs:
  1. frontend      → npm ci + npm run build (Node 20)
  2. backend       → npm ci (dependency install check)
  3. containers    → Docker build for both frontend and backend images
                     (depends on jobs 1 & 2 passing)
```

No deployment secrets required — CI validates builds only.

### Nginx Configuration

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static asset caching — 7-day expiry, immutable
    location ~* \.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### Environment Variables

#### Backend (`.env`)

| Variable | Required | Description |
|----------|---------|-------------|
| `NODE_ENV` | No | `development` or `production` |
| `PORT` | No | Server port (default: 3001) |
| `ALLOWED_ORIGIN` | **Yes** | Frontend origin for CORS (e.g., `http://localhost:5173`) |
| `ML_SPACE_BASE_URL` | **Yes** | Hugging Face Space URL (e.g., `https://iloveass-kompon-ml.hf.space`) |
| `HF_DATASET_REPO` | **Yes** | HF Datasets repo for Parquet files |
| `UPSTASH_REDIS_REST_URL` | **Yes** | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | **Yes** | Upstash Redis auth token |
| `MONGODB_URI` | No | MongoDB Atlas connection string |
| `CURRENTS_API_KEY` | No | Currents API key for earthquake news |
| `GROQ_API_KEY` | **Yes** | Groq API key for chatbot |
| `GEMINI_API_KEY` | No | Google Gemini API key (chatbot fallback) |

#### Frontend (`.env`)

| Variable | Required | Description |
|----------|---------|-------------|
| `VITE_API_ORIGIN` | **Yes** | Backend API origin (e.g., `http://localhost:3001`) |

#### ML Space (HF Space Variables)

| Variable | Value |
|----------|-------|
| `HF_MODEL_REPO_GATE` | `iloveass/kompon-image-gate` |
| `HF_MODEL_REPO_CRACK` | `iloveass/kompon-damage-severity-detection` |
| `HF_MODEL_REPO_SCENARIO` | `iloveass/kompon-ground-failure-model` |
| `HF_SCENARIO_MODEL_FILE` | `scenario_model_v4_regressor.txt` |

---

## External APIs & Data Sources

| API / Source | Usage | Caching |
|-------------|-------|---------|
| **USGS Earthquake Hazards Program** | Live earthquake feed (GeoJSON), fdsnws event API for chatbot tool | In-memory 30s TTL |
| **Currents API** | Earthquake news aggregation (primary) | Redis 30min TTL |
| **GDELT DOC 2.0** | Earthquake news aggregation (fallback) | Redis 30min TTL |
| **OpenStreetMap Overpass API** | Safe places (parks, fields, playgrounds, sports grounds) | Redis 7-day TTL |
| **Hugging Face Hub** | Model weight downloads, Parquet dataset hosting | Filesystem (permanent) |
| **Groq API** | Llama 3.1 8B Instant (chatbot primary) | None |
| **Google Gemini API** | Gemini 2.5 Flash (chatbot fallback) | None |
| **MongoDB Atlas** | Fire brigade directory | None |

---

## Security

| Layer | Implementation |
|-------|---------------|
| **Security headers** | helmet.js — HSTS (1yr, preload), X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy: strict-origin-when-cross-origin |
| **CORS** | Locked to `ALLOWED_ORIGIN` — never wildcard. In dev, allows localhost patterns. Production rejects null origins. |
| **Rate limiting** | Per-endpoint per-IP sliding window via Upstash Redis. Fails open on Redis outage. |
| **Input validation** | Zod schemas for all request parameters (server-side, never trust client). |
| **Image validation** | Magic-byte verification via `file-type` (not Content-Type header). EXIF stripped via `sharp`. Re-encoded to sanitize embedded payloads. |
| **File size limits** | Multer: 8MB upload limit. ML Space: 16MB safety cap. |
| **HTML sanitization** | `sanitize-html` — all HTML tags stripped from news titles/summaries. |
| **API key protection** | All keys in `.env` / hosting provider secrets — never in Git. |
| **LLM safety** | Domain-locked system prompt, jailbreak-resistant, message length cap (1000 chars), history cap (8 turns). |

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2 | Component-based UI |
| Vite | 8.1 | Lightning-fast dev server and bundler |
| Tailwind CSS | 4.3 | Utility-first CSS framework |
| Framer Motion | 12.42 | Declarative animations |
| Leaflet | 1.9 | Interactive mapping |
| React-Leaflet | 5.0 | React bindings for Leaflet |
| Axios | 1.18 | Promise-based HTTP client |
| Lucide React | 1.23 | Beautiful icon set |

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | ≥ 20 | Runtime |
| Express | 4.21 | Web framework |
| DuckDB | 1.5 | In-memory OLAP (Parquet queries) |
| Mongoose | 8.9 | MongoDB ODM |
| Multer | 1.4 | Multipart file upload handling |
| Sharp | 0.33 | Image processing / EXIF stripping |
| Zod | 3.24 | Schema validation |
| Helmet | 8.0 | Security headers |
| node-cron | 3.0 | Scheduled jobs |
| sanitize-html | 2.14 | HTML sanitization |
| file-type | 19.6 | Magic-byte file type detection |

### ML Inference
| Technology | Version | Purpose |
|-----------|---------|---------|
| FastAPI | 0.115 | High-performance async API framework |
| Uvicorn | 0.34 | ASGI server |
| PyTorch | 2.5 | Deep learning framework (Model 0) |
| torchvision | 0.20 | Pretrained model architectures |
| Ultralytics | 8.3 | YOLOv8 inference (Model A) |
| LightGBM | 4.5 | Gradient boosting (Model 3) |
| Pillow | 11.1 | Image processing |
| huggingface_hub | 0.27 | Dynamic weight downloading |
| pandas | 2.2 | Feature engineering |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| Docker + Docker Compose | Containerization |
| Nginx | Frontend reverse proxy + SPA routing |
| Upstash Redis | Serverless caching + rate limiting |
| MongoDB Atlas | Document database |
| Hugging Face Spaces | ML model hosting (Docker SDK) |
| Hugging Face Datasets | Parquet data hosting |
| GitHub Actions | CI/CD pipeline |
| Render | Backend + Frontend deployment |

---

## Project Structure

```
Kompon/
├── Frontend/                  # React 19 + Vite + Tailwind
│   ├── src/
│   │   ├── pages/             # Home, Alerts, Inspect, Relief
│   │   ├── components/        # Navbar, Hero, Map, Chatbot, etc.
│   │   ├── lib/               # Motion presets, typography
│   │   └── config/            # API configuration
│   ├── public/                # Static assets
│   └── package.json
│
├── Backend/                   # Express + Node 20
│   ├── src/
│   │   ├── routes/            # 7 API route modules
│   │   ├── services/          # 10 service modules
│   │   ├── middleware/        # Security, rate limiting, validation
│   │   ├── models/            # Mongoose schemas
│   │   ├── scripts/           # Data fetching utilities
│   │   └── server.js          # Entry point
│   ├── data/                  # Runtime data (Parquet, cache)
│   ├── fire_service.json      # Static fire brigade data
│   └── package.json
│
├── kompon-ml-space/           # FastAPI ML inference server
│   ├── app.py                 # All 3 models + routes
│   ├── Dockerfile             # HF Spaces Docker config
│   └── requirements.txt       # Python dependencies
│
├── deploy/
│   ├── docker/
│   │   ├── backend.Dockerfile
│   │   └── frontend.Dockerfile
│   └── nginx/
│       └── frontend.conf
│
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI
│
├── docker-compose.yml         # 2-service orchestration
├── DEVOPS.md                  # Deployment documentation
└── README.md                  # ← You are here
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **Docker** and **Docker Compose** (for containerized deployment)
- **Python** 3.10+ (only if running ML space locally)

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/XGNoir95/Kompon.git
cd Kompon

# 2. Create environment file
cp Backend/.env.example Backend/.env
# Edit Backend/.env with your API keys

# 3. Set build-time variables and run
export VITE_API_ORIGIN=http://localhost:3001
export ALLOWED_ORIGIN=http://localhost:8080
export ML_SPACE_BASE_URL=https://iloveass-kompon-ml.hf.space

# 4. Build and run
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Backend: `http://localhost:3001/health`

### Option 2: Local Development

```bash
# Backend
cd Backend
cp .env.example .env   # Fill in API keys
npm install
npm run dev            # Starts on port 3001 with nodemon

# Frontend (in a new terminal)
cd Frontend
cp .env.example .env   # Set VITE_API_ORIGIN=http://localhost:3001
npm install
npm run dev            # Starts on port 5173 with Vite HMR
```

### Option 3: ML Space (Local)

```bash
cd kompon-ml-space
pip install -r requirements.txt

# Set environment variables for model repos
export HF_MODEL_REPO_GATE=iloveass/kompon-image-gate
export HF_MODEL_REPO_CRACK=iloveass/kompon-damage-severity-detection
export HF_MODEL_REPO_SCENARIO=iloveass/kompon-ground-failure-model
export HF_SCENARIO_MODEL_FILE=scenario_model_v4_regressor.txt

uvicorn app:app --host 0.0.0.0 --port 7860
```

---

## API Reference

### `POST /v1/risk-assessment`

The core endpoint. Accepts `multipart/form-data`.

**Request fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | File | Yes | Building damage photo (JPEG, PNG, WebP; max 8MB) |
| `questionnaire` | JSON string | No | Structural vulnerability answers |
| `lat` | Float | No | Latitude (-90 to 90) |
| `lon` | Float | No | Longitude (-180 to 180) |
| `scenario_event_id` | String | No | One of `event_1` through `event_8` |
| `bypass_gate` | Boolean | No | Skip gate rejection (for testing) |

**Response (200):**

```json
{
  "final_score": 42.5,
  "final_tier": "Moderate",
  "breakdown": {
    "structural_vulnerability": { "score": 55, "weight": 0.538 },
    "crack_evidence": { "score": 25, "weight": 0.462 },
    "site_hazard": { "score": null, "included": false },
    "scenario_shaking": { "score": null, "included": false }
  },
  "escalation_applied": false,
  "gate": {
    "decision": "accept",
    "class": "building_surface",
    "confidence": 0.8732
  },
  "crack_analysis": {
    "detections": [...],
    "severity_tier": "Low",
    "reliable": true,
    "escalate": false
  },
  "site_hazard": null,
  "scenario_shaking": null,
  "preparedness_checklist": ["Keep emergency supplies...", ...],
  "engineer_referral_recommended": false,
  "inputs_used": {
    "image": true,
    "questionnaire": true,
    "location": false,
    "scenario": false
  },
  "disclaimer": "Screening result only — not a safety certificate..."
}
```

### `GET /v1/earthquakes/recent`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `window` | String | `day` | `hour`, `day`, or `week` |
| `minMagnitude` | Float | 0 | Minimum magnitude filter |
| `limit` | Int | 12 | Max results (1–40) |
| `focus` | String | `south_asia` | `south_asia`, `asia`, or `global` |

### `GET /v1/safe-places`

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `lat` | Float | — | Latitude (required) |
| `lon` | Float | — | Longitude (required) |
| `radius_m` | Int | 1000 | Search radius in meters (100–5000) |

### `GET /v1/fire-brigade/search`

| Param | Type | Description |
|-------|------|-------------|
| `district` | String | District name (required) |
| `upazila` | String | Upazila name (optional) |

### `POST /v1/chat`

| Field | Type | Description |
|-------|------|-------------|
| `message` | String | User message (max 1000 chars) |
| `history` | Array | Previous conversation turns (max 8) |

### `GET /v1/hazard/static`

Returns heatmap layers for the map visualization.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `cellDeg` | Float | 0.035 | Grid cell size in degrees |
| `limitPerLayer` | Int | 1200 | Max points per layer |
| `includeScenarios` | Boolean | true | Include scenario layers |

---

## Figma Design

The complete UI/UX design was created in Figma before development:

🎨 **[View Figma Design →](https://www.figma.com/design/ZbLVEt064GSs1NJP2MlDBd/Kompon-Figma?node-id=0-1&t=foqY0T42qPtoZCUY-1)**

The design system includes:
- Color palette centered on `#ff5330` (Kompon orange) and `#121212` (dark)
- Inter font family throughout
- Responsive layouts for mobile, tablet, and desktop
- Component specifications for all interactive elements
- Motion design guidelines for Framer Motion animations

---

## Disclaimer

> **Kompon is a screening tool, not a structural safety certificate.**
>
> Results are based on machine learning models trained on limited data and a short questionnaire. They should never be used as the sole basis for structural decisions.
>
> - Model A was trained for 5 specific damage types and may miss other forms of structural failure.
> - Model 3 is based on 8 earthquakes (M5.0–M6.9) and may not generalize to all scenarios.
> - **High or Very High findings should always be referred to a licensed structural engineer.**
> - The absence of detected damage does **not** mean a building is safe.
>
> Do not interpret a service outage, error, or missing result as an indication of safety.

---

## License

This project is **UNLICENSED** — all rights reserved.

---

## Team

Built with 💪 for the earthquake safety of Bangladesh.

| Name | Role |
|------|------|
| **Syed Abir Hossain** | ML Engineering, Backend Development, DevOps |
| **Shuhrid Abrar** | Frontend Development, UI/UX Design |
| **MD Tanjir Rahman** | Data Engineering, Research, Documentation |


---

<p align="center">
  <sub>কম্পন — Because every tremor should meet a prepared community.</sub>
</p>
