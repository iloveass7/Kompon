# Kapuni — Backend Build Spec (MERN) — Context Doc for Claude Code / Antigravity

> Hand this file to Claude Code or Antigravity as full context. Stack: **Node.js
> + Express** for the orchestration API, **MongoDB Atlas** for geospatial
> lookups and static data, **React** frontend (already mostly built, not
> touched here). The one deliberate exception is the ML inference layer,
> which stays **Python** — see §2 for why, this is not a contradiction of
> "build it with MERN," it's how MERN apps normally integrate a Python ML
> model in practice.

**Timeline reality check:** today is July 5, 2026. If this is still targeting
the SciBlitz submission (July 8, 11:59 PM BST), you have **~3 days**. Build
order is in §11.

---

## 0. Non‑negotiable rules (apply everywhere)

- **Never output "safe" or "unsafe."** Every risk-related response uses tiers
  (Very Low / Low / Moderate / High / Very High) plus a screening disclaimer.
  This is already baked into Model A's `predict.py` and Model 3's
  `predict_scenario()` — the backend must not weaken or bypass it, including
  in error/fallback messages.
- **Uncertainty escalates caution, never reassurance.** If a model is
  uncertain, unreachable, or cold-starting, say so plainly — never silently
  substitute a neutral/low score.
- **No user accounts, no admin panel.** All endpoints are public and
  unauthenticated. The only access control is rate limiting (§7).
- **Do not persist uploaded images anywhere.** Process in memory (multer
  `memoryStorage()`), return the result, discard the buffer.

---

## 1. What already exists (don't rebuild these)

| Component | Status | Where |
|---|---|---|
| **Model 0** — image validity gate (MobileNetV3-Small, 3-class) | Trained, 99.88% val acc | Uploaded to HF |
| **Model A** — crack/damage segmentation (YOLOv8s-seg, 5 classes) | Trained, mask mAP50 0.725 | Uploaded to HF |
| **Model B** — static ground/soil liquefaction susceptibility (rules-based geospatial index, national 250m grid) | Data product exists — **verify the Low-class calibration issue was fixed before trusting it, see below** | Uploaded to HF |
| **Model 3** — scenario-adjusted liquefaction score (LightGBM regression, LOEO-validated on 8 events) | Per `kapuni_scenario_model_spec.md` | Uploaded to HF |
| Frontend | "Mostly done" (React, presumably, given MERN) | Not touched by this doc |

**Known risk worth a 10-minute check before building on it:** Model B's QA
sample previously showed a compressed score range (zero Low-class points,
stable regions like Chittagong Hill Tracts scoring ~52 when they should
score low) — a calibration bug, not a data bug. If unresolved, ship it
anyway but say so honestly in the disclaimer text rather than presenting it
as more validated than it is.

---

## 2. Architecture

```
┌─────────────────────────┐
│   REACT FRONTEND          │  → calls only the Express API below (one
└────────────┬─────────────┘     origin, CORS-locked)
             │ HTTPS / JSON, multipart for images
             ▼
┌───────────────────────────────────────────────────────────┐
│  RENDER — orchestration API (Node.js + Express)             │
│  Free web service: 512MB RAM / 0.1 CPU, sleeps after        │
│  15 min idle, ~30-60s cold start, 750 free instance-hrs/mo  │
│                                                               │
│  • Combined risk-assessment endpoint (scoring engine)        │
│  • News aggregation (cached)                                 │
│  • Nearest-safe-place lookup (Overpass, cached)               │
│  • Fire brigade directory search                              │
│  • Static hazard point lookup (MongoDB geospatial query)      │
│  • Rate limiting, validation, all security hardening          │
│                                                               │
│  No ML libraries here — stays light so cold starts are fast  │
│  and 512MB RAM is never a problem.                            │
└───┬──────────────┬──────────────────┬───────────────┬───────┘
    │              │                  │               │
    ▼              ▼                  ▼               ▼
┌──────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
│ HF SPACE  │ │ MongoDB      │ │ Upstash      │ │ Free external   │
│"kapuni-ml"│ │ Atlas M0      │ │ Redis        │ │ APIs:           │
│ Docker +  │ │ (free, 512MB, │ │ (REST-based, │ │ • Currents API  │
│ FastAPI    │ │ 2dsphere      │ │ 500K cmds/mo │ │   (news)        │
│ (Python —  │ │ geospatial    │ │ free)        │ │ • Overpass API  │
│ see below) │ │ index)        │ └──────────────┘ │   (OSM safe     │
│            │ │                                    │   places)       │
│ 2 vCPU,    │ │ • Clipped hazard grid (§3a)         └────────────────┘
│ 16GB RAM,  │ │ • Clipped scenario grids (§3b)
│ sleeps     │ │ • Fire brigade directory (§3c)
│ after 48h   │ └──────────────────────
│ idle       │
│            │
│ • Model 0  │
│   + Model A│
│   combined │
│ • Model 3  │
└────────────┘
```

**Why the ML Space stays Python, not Node:** Model 0/A run on
PyTorch + Ultralytics, Model 3 is LightGBM. There's no mature Node runtime
for these that doesn't involve re-exporting every model to ONNX and
validating that the exported version still matches your trained metrics —
real work, real risk, for a model layer that's already cleanly isolated
behind an HTTP call. This is the completely standard pattern for MERN
apps with an ML component: JS end-to-end for the app, one small Python
microservice for inference, talked to over REST like any other API. It's
not "half the stack isn't MERN" — the M-E-R-N app *is* everything in the
top two boxes; the ML Space is a vendored dependency, same as if you were
calling any third-party inference API.

**Why MongoDB instead of the flat-file approach:** the static hazard grid
and each scenario grid are just points with a score attached. Atlas's free
M0 tier gives you a real `2dsphere` index, so "nearest grid cell to this
lat/lon" is a native `$near` query instead of a hand-rolled rounding-dict
lookup. Cleaner, and it's genuinely a better fit here, not just "using
Mongo because MERN."

---

## 3. Required data prep — do this BEFORE writing backend code

### 3a. Clip Model B's static grid into MongoDB
The full national CSV (~2.25M rows, 805MB) cannot ship and doesn't need to.
Clip to the area(s) your demo covers (Greater Dhaka at minimum), keep only
what the API needs, and load into a `hazard_points` collection:

```js
// hazard_points schema
{
  location: { type: "Point", coordinates: [lon, lat] }, // GeoJSON: lon first
  ground_susceptibility_score: Number,
  ground_susceptibility_class: String,
  vs30: Number,
  confidence: Number
}
```
```js
hazardPointSchema.index({ location: "2dsphere" });
```
Nearest-point query at request time:
```js
const nearest = await HazardPoint.findOne({
  location: {
    $near: {
      $geometry: { type: "Point", coordinates: [lon, lat] },
      $maxDistance: 500 // meters, matches the 250m grid spacing
    }
  }
});
```
Bulk-load the clipped CSV with a one-off script (`csv-parse` + `insertMany`)
once, at build time — not per request.

### 3b. Clip Model 3's per-event scenario grids the same way
For an arbitrary user-pinned point, Model 3 needs the ground features from
3a plus shaking features (`magnitude, depth_km, dist_epicenter_km,
pga_g_filled, pgv_cms_filled, mmi_filled`) for whichever of the 8 trained
events the user selects. The training CSV is already a national grid *per
event*, so do the same nearest-point lookup against a clipped collection —
don't compute a live GMPE, the precomputed grid already has this. One
collection per event (or one collection with `event_id` as a field and a
compound index), same `2dsphere` pattern as 3a.

### 3c. Compile the fire brigade directory (Feature #7)
**Source confirmed:** `fireservice.gov.bd` publishes per-division contact
lists as downloadable files (8 divisions: Dhaka, Chittagong, Khulna,
Barisal, Rajshahi, Sylhet, Rangpur, Mymensingh) on their contact-numbers
page. Individual districts/upazilas also run their own subdomains
(`fireservice.<district>.gov.bd`) with a contact page each — useful for
cross-checking, but the division-level downloads are your primary source.

**Realistic scope for 3 days:** don't try to compile all ~64 districts /
~495 upazilas. Recommended MVP:
1. Fully compile **Dhaka division**.
2. Add other divisions opportunistically if time allows.
3. Any search with no match falls back to the national emergency number(s)
   — confirm the current one directly on fireservice.gov.bd before
   shipping, sources disagree between "999" and "102" and it may vary by
   page/date, don't guess this one.

Store as a small `fire_stations` collection:
```js
{
  division: "Dhaka",
  district: "Dhaka",
  upazila: "Dohar",
  station_name: "Dohar Fire Station",
  phone_numbers: ["02-xxxxxxx", "01730-xxxxxx"],
  source_url: "https://fireservice.gov.bd/...",
  last_verified: "2026-07-05"
}
```
Index on `{district: 1, upazila: 1}`. This is small and static enough that
you could also just load it as an in-memory array at server startup instead
of a DB round-trip — either is fine, Mongo just keeps everything in one
place if you're already running it for §3a/3b.

---

## 4. Free service choices (verified July 2026 — re-check before signing up, terms drift)

| Need | Choice | Free tier | Why |
|---|---|---|---|
| Backend hosting | **Render** (Web Service, Node) | 512MB RAM, 0.1 CPU, 750 instance-hrs/mo, 100GB bandwidth/mo, sleeps after 15 min idle | Your pick, works fine kept lightweight |
| Database | **MongoDB Atlas M0** | 512MB storage, 500 connections, permanently free, `2dsphere` geospatial indexing included | Confirmed current, no time limit |
| ML hosting | **Hugging Face Spaces** (Docker SDK) | 2 vCPU, 16GB RAM, sleeps after 48h idle | Far more generous than Render's tier for the actual model weights |
| Cache/rate-limit store | **Upstash Redis** | 500K commands/month, 256MB data, 10GB bandwidth/mo, REST-based (works cleanly from serverless/Render, has an official `@upstash/redis` + `@upstash/ratelimit` JS SDK) | Framework-agnostic, plug straight into Express |
| Earthquake news | **Currents API** | ~600 req/day, no card, **commercial use explicitly allowed**, returns an `image` field per article | GNews (100/day, **non-commercial only** — wrong fit even for a hackathon submission) and NewsData.io (200 credits/day, commercial OK) are solid backups |
| News fallback / redundancy | **GDELT DOC 2.0 API** | Free, unlimited, no key | Insurance if Currents has an outage during judging; better non-English/global coverage too |
| Nearest open space / safe ground | **OpenStreetMap Overpass API** | Free, no key, fair-use rate limits | Query `leisure=park`, `landuse=grass\|meadow\|recreation_ground`, `leisure=pitch`, `natural=field` within a radius |
| Map tiles (frontend) | OSM tile layer via Leaflet | Free, fair-use policy | Standard React/Leaflet pairing |
| Uptime keep-alive | **UptimeRobot** free plan | 50 monitors, 5-min interval | See honest caveat below |

**Honest caveat on keep-alive pinging:** Render's own docs note this isn't
their recommended approach. The more robust fix is a **graceful cold-start
UI state** on the frontend ("waking up the server, ~30s") rather than
fighting the sleep policy — do both if you have time, but don't skip the
honest loading state.

**On video for the news feature:** no free news API reliably returns video
for arbitrary articles. Show the article image (Currents), and optionally a
"watch coverage" link that deep-links to a YouTube search for the headline
— no API call, no quota. Don't spend build time chasing real video embeds
for v1.

---

## 5. HF Space — ML inference API spec (Python, unchanged)

Single Space, Docker SDK, one FastAPI app, three routes. This is the one
piece of the stack that isn't Express/Mongo, for the reasons in §2.

### `POST /infer/image-risk`
Combines Model 0 (gate) + Model A (crack/damage), mirrors the existing
`run_kapuni()` wrapper. Request: `multipart/form-data`, field `image`.
```json
{
  "gate": { "decision": "accept", "class": "building_surface", "confidence": 0.91 },
  "crack_analysis": {
    "detections": [{ "class": "structural_crack", "confidence": 0.83, "coverage_pct": 0.9 }],
    "severity_tier": "Moderate"
  },
  "disclaimer": "Screening result only — not a safety certificate. Refer High/Very High findings to a licensed engineer."
}
```
If gate rejects: return the reason (`"other"` / `"road_or_pavement"`), don't
run Model A.

### `POST /infer/scenario-score`
Exact contract from `kapuni_scenario_model_spec.md` — reuse
`predict_scenario()` as-is, disclaimer text copied verbatim, not reworded.

### `GET /health`
Instant 200, no model loading touched.

---

## 6. Render — orchestration API spec (Express)

Node 20+, Express, `mongoose` for MongoDB, `@upstash/redis` +
`@upstash/ratelimit` for caching/limiting, `multer` (memory storage) +
`sharp` + `file-type` for image handling, `axios` or native `fetch` with a
keep-alive agent for calls to the HF Space, `helmet` + `compression`
middleware, `zod` (or `joi`) for request validation.

### 6.1 `POST /v1/risk-assessment` — Feature #1 (the core feature)

Request: `multipart/form-data`:
- `image`: file
- `questionnaire`: JSON string (see §6.1.1)
- `lat`, `lon`: optional floats
- `scenario_event_id`: optional string (one of the 8 trained event IDs)

Flow:
1. Validate the image (§7) → forward buffer to HF Space `/infer/image-risk`.
2. Compute `StructuralVulnerability` from the questionnaire (rule-based,
   §6.1.2).
3. If `lat`/`lon` given: MongoDB `$near` lookup against `hazard_points` for
   `SiteHazard`.
4. If `lat`/`lon` **and** `scenario_event_id` given: `$near` lookup against
   the matching scenario collection, then call HF Space
   `/infer/scenario-score` for `ScenarioShaking`.
5. Combine via the weighted formula (§6.1.3) → final tier + breakdown.
6. Return everything, including which inputs were actually used.

Response:
```json
{
  "final_score": 62.4,
  "final_tier": "High",
  "breakdown": {
    "structural_vulnerability": { "score": 55, "weight": 0.35 },
    "crack_evidence": { "score": 70, "weight": 0.30 },
    "site_hazard": { "score": 68, "weight": 0.20, "included": true },
    "scenario_shaking": { "score": null, "weight": 0.15, "included": false }
  },
  "escalation_applied": false,
  "gate": { "...": "..." },
  "crack_analysis": { "...": "..." },
  "preparedness_checklist": ["...", "..."],
  "engineer_referral_recommended": true,
  "disclaimer": "Screening result only — not a safety certificate. Based on a photo, a short questionnaire, and (if provided) location data. Do not use for structural decisions without a licensed engineer."
}
```

#### 6.1.1 Questionnaire fields (FEMA P-154-lite starting rubric)
**Flag this to the team explicitly: these point values are a reasonable
starting rubric, not a civil-engineering-validated instrument.** Get a
sanity check from a civil engineering advisor before presenting the scoring
as authoritative.

| Field | Options | Points toward StructuralVulnerability (0–100) |
|---|---|---|
| Building age | <10y / 10–30y / >30y / unknown | 0 / 15 / 30 / 15 |
| Number of stories | 1–2 / 3–5 / 6+ | 5 / 15 / 25 |
| Soft story / open ground floor | yes/no/unsure | +25 / 0 / +10 |
| Primary structural material | RC frame / load-bearing masonry / informal-other | 5 / 20 / 30 |
| Visible foundation settlement/tilt | yes/no/unsure | +20 / 0 / +8 |
| Prior earthquake/flood damage | yes/no/unsure | +15 / 0 / +5 |
| Crack location (corroborating the photo) | column/beam joint / load-bearing wall / plaster-partition / unsure | 30 / 20 / 5 / 15 |

Sum, clip to 0–100.

#### 6.1.2 CrackEvidence derivation
From Model A's `severity_tier` + coverage:
`Very Low→10, Low→25, Moderate→50, High→75, Very High→95`, optionally nudged
±10 by `coverage_pct` within tier. The tier mapping already encodes the hard
safety logic — don't override it downward.

#### 6.1.3 Combining weights
```js
const weights = { structural: 0.35, crack: 0.30, siteHazard: 0.20, scenario: 0.15 };
```
If `siteHazard` and/or `scenario` weren't computed (no location given),
**redistribute their weight proportionally** across whichever components
were computed — a missing input is never silently treated as 0.

**Escalation override (non-negotiable):** if `crack_analysis.severity_tier`
is `Very High`, OR the gate confidence was below its uncertainty threshold,
floor `final_tier` at `High` regardless of the weighted average, and set
`engineer_referral_recommended: true`. A good questionnaire score must never
average down a genuinely dangerous crack signal.

### 6.2 `GET /v1/news/earthquakes` — Feature #2
Query params: `page` (default 1), `country` (optional). Serves from Redis
cache only — never calls Currents/GDELT synchronously on a user request. A
`node-cron` job (or a Render Cron Job hitting an internal
`/internal/refresh-news` route) refreshes the cache every 20–30 minutes:
```
query = "earthquake" (+ optionally region terms like "Bangladesh")
sources = [Currents primary, GDELT fallback on error/quota]
```
Response: paginated `{title, summary, image_url, source_name, source_url,
published_at}`. Strip HTML tags from `title`/`summary` server-side before
caching (defense against a malicious upstream source) — `sanitize-html` or
a simple regex strip is enough.

### 6.3 `GET /v1/safe-places?lat=&lon=&radius_m=` — Feature #3
Round lat/lon to a cache key, check Redis (TTL 7 days — parks don't move),
on miss query Overpass:
```
[out:json][timeout:10];
(
  node["leisure"~"park|pitch"](around:{radius},{lat},{lon});
  way["landuse"~"grass|meadow|recreation_ground"](around:{radius},{lat},{lon});
  node["natural"="field"](around:{radius},{lat},{lon});
);
out center;
```
Return `{name, lat, lon, type, distance_m}` sorted by distance, cap to
top ~15.

### 6.4 `GET /v1/fire-brigade/search?district=&upazila=` — Feature #7
Query the `fire_stations` collection (or in-memory array, §3c). Validate
`district`/`upazila` against the known values in that dataset (reject
unknown values with a clear 404, don't string-match blindly). Always include
the national fallback number(s) alongside a match, labeled separately.

### 6.5 `GET /v1/hazard/static?lat=&lon=` — for map display
Same `$near` lookup as §3a, exposed directly for the map view (not every
hazard lookup needs to go through a full risk assessment).

### 6.6 `GET /health`
Trivial 200 OK, used by UptimeRobot.

---

## 7. Security checklist ("as close to zero vulnerability as a no-auth public API gets")

No system is literally zero-vulnerability — treat this as the concrete floor.

- **Rate limit every endpoint per IP** — your only line of defense with no
  auth. `@upstash/ratelimit` (sliding window) backed by the same Redis
  instance: `/v1/risk-assessment` 5/min, `/v1/news/*` 30/min,
  `/v1/safe-places` 20/min, `/v1/fire-brigade/*` 30/min.
- **CORS locked to your actual frontend origin(s)** via the `cors` package
  — never `*`.
- **Image upload hardening:**
  - `multer` with `memoryStorage()` — never `diskStorage()`.
  - Verify actual file type with `file-type` (magic bytes), don't trust the
    declared `Content-Type` header.
  - Hard size cap (e.g. 8MB) via multer's `limits.fileSize`.
  - Decode/re-encode through `sharp` — this both validates the file is a
    real, well-formed image and, by default, drops EXIF metadata on output
    (call `.rotate()` first to respect orientation before it's stripped, do
    **not** call `.withMetadata()`, which would keep EXIF including GPS).
  - Downscale to a max dimension (e.g. 1600px) with `sharp` before
    forwarding to the HF Space — cuts latency and payload size on slow
    mobile networks.
  - **Never write the uploaded file to disk or the database.** In-memory
    buffer only, discarded after the response.
- **Validate everything server-side** with `zod`/`joi`, not just
  client-side: lat ∈ [-90,90], lon ∈ [-180,180], `district`/`upazila`
  against the known set, `scenario_event_id` against the 8 valid IDs.
- **Secrets only via environment variables** (Render's env var store / HF
  Space secrets), never committed; `.env` in `.gitignore`.
- **HTTPS-only**, HSTS via `helmet()`. Both Render and HF Spaces provide TLS
  automatically.
- **Security headers via `helmet()`**: sane defaults cover
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` — don't
  hand-roll these.
- **Sanitize third-party content**: strip HTML tags from news API responses
  before caching/serving.
- **No SSRF surface:** never fetch a user-supplied URL server-side. All
  outbound targets (Overpass, HF Space, Currents/GDELT) are backend-
  constructed.
- **Timeouts on every outbound call** (8–12s, via `axios`'s `timeout` option
  or an `AbortController` with native `fetch`) with a clear fallback message
  instead of letting a request hang on the free tier's limited concurrency.
- **MongoDB query safety:** always use Mongoose's parameterized query
  builders (`find`, `findOne` with an object filter) — never build a query
  from a raw string of user input, which is how NoSQL injection happens.
- **Dependency hygiene:** pin versions in `package.json`, run `npm audit`
  before each deploy.

---

## 8. Performance checklist ("no lag tolerated")

- The Express service has **no ML libraries** — those live only in the HF
  Space. Keeps cold start short and 512MB RAM safe.
- Redis caching table:

| Key pattern | TTL | Refreshed by |
|---|---|---|
| `news:list:v1` | 30 min | `node-cron` job, not per-request |
| `safeplaces:{lat_r}:{lon_r}:{radius}` | 7 days | On cache miss |
| fire brigade data | N/A | In-memory or Mongo, no TTL needed |

- MongoDB `$near` queries on a `2dsphere` index are fast even on M0 — no
  extra caching layer needed for hazard/scenario lookups unless you see
  latency in testing, in which case add a thin Redis cache in front the same
  way as safe-places.
- `compression` middleware (gzip) on all JSON responses.
- Paginate `/v1/news/earthquakes` (page size ~10) — small payloads for
  mobile.
- Reuse a single HTTP client/agent (keep-alive) for calls to the HF Space —
  don't open a new connection per request.
- UptimeRobot ping on Render's `/health` every 5 min, paired with a
  graceful "waking up" loading state on the frontend regardless.

---

## 9. Suggested repo structure

```
kapuni-backend/
├── src/
│   ├── server.js                 # Express app, middleware, route mounting
│   ├── routes/
│   │   ├── riskAssessment.js
│   │   ├── news.js
│   │   ├── safePlaces.js
│   │   ├── fireBrigade.js
│   │   └── hazard.js
│   ├── services/
│   │   ├── mlClient.js           # calls to the HF Space
│   │   ├── newsClient.js         # Currents + GDELT fallback
│   │   ├── overpassClient.js
│   │   ├── scoringEngine.js      # §6.1.2 / 6.1.3 logic
│   │   └── redisClient.js        # Upstash wrapper
│   ├── models/
│   │   ├── HazardPoint.js        # Mongoose schema, §3a
│   │   ├── ScenarioPoint.js      # Mongoose schema, §3b
│   │   └── FireStation.js        # Mongoose schema, §3c
│   ├── middleware/
│   │   ├── rateLimit.js
│   │   ├── security.js           # helmet config
│   │   └── validate.js           # zod schemas
│   └── scripts/
│       └── loadStaticData.js     # one-off CSV → MongoDB loaders
├── package.json
└── .env.example

kapuni-ml-space/
├── app.py                        # FastAPI: /infer/image-risk, /infer/scenario-score
├── models/
│   ├── gate.py                   # existing, unmodified
│   ├── predict.py                # existing Model A predict.py, unmodified
│   └── scenario_predict.py       # predict_scenario() from the spec doc
├── weights/                      # downloaded from your HF model repos at build time
├── Dockerfile
└── requirements.txt
```

---

## 10. Environment variables

```
# Render backend (Express)
CURRENTS_API_KEY=
NEWSDATA_API_KEY=              # optional backup
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
MONGODB_URI=mongodb+srv://...
ML_SPACE_BASE_URL=https://<your-space>.hf.space
ALLOWED_ORIGIN=https://<your-frontend-domain>

# HF Space
HF_MODEL_REPO_GATE=<your-username>/kapuni-model0-gate
HF_MODEL_REPO_CRACK=<your-username>/kapuni-modelA-crack
HF_MODEL_REPO_SCENARIO=<your-username>/kapuni-model3-scenario
```

---

## 11. Build order (3 days)

**Day 1 (today, Jul 5):**
1. Set up MongoDB Atlas M0, clip the static hazard grid (§3a) and one
   scenario grid (§3b) — pick the training event closest to your demo
   region — load both with a one-off script.
2. Stand up the HF Space skeleton: load Model 0 + Model A, get
   `/infer/image-risk` working end-to-end against a real photo.
3. Compile Dhaka division's fire brigade contacts (§3c) — pure data entry,
   parallel with the above.

**Day 2 (Jul 6):**
4. Get `/infer/scenario-score` working on the HF Space against the clipped
   grid from step 1.
5. Build the Express skeleton: `/health`, CORS, rate limiting, Mongo +
   Redis connections.
6. Wire `/v1/risk-assessment` end-to-end (image → HF Space → questionnaire
   scoring → combined tier). Highest-value endpoint — prioritize this
   working correctly over the other features.

**Day 3 (Jul 7):**
7. Wire `/v1/news/earthquakes` (Currents + Redis cache + cron),
   `/v1/safe-places` (Overpass + cache), `/v1/fire-brigade/search`.
8. Security pass: rate limits on every route, CORS lockdown, image upload
   hardening, `helmet()`.
9. Set up UptimeRobot on Render's `/health`. Deploy both services for real,
   test cold starts, test the full flow from the actual frontend.

**Jul 8 (submission day):** buffer for bugs, not new features.

---

## 12. Assumptions I made — flag if any of these are wrong

- Frontend is React (implied by "MERN") — if it's actually something else,
  none of this backend spec changes, only the frontend integration snippets
  would.
- One HF Space hosts all model routes rather than separate Spaces — fewer
  cold starts to manage, 16GB RAM covers YOLOv8s-seg + MobileNetV3-Small +
  LightGBM together comfortably.
- Model B's clipping/calibration work (§3a, and the Low-class check) is not
  yet done — you said models are "done and uploaded," but earlier planning
  docs left this open. Worth 10 minutes to confirm before building the
  hazard lookup on top of it.
- Fire brigade data ships as Dhaka-division-only for the deadline, with a
  national-number fallback everywhere else.
- Mongoose over the raw MongoDB driver, for faster schema/index setup under
  time pressure — swap if the team prefers the native driver.
