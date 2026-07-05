# Kompon ML Space — FastAPI inference server
# Hosts Model 0 (gate), Model A (crack/damage segmentation), and Model 3 (scenario).
# Deployed on Hugging Face Spaces with Docker SDK.
#
# Routes:
#   POST /infer/image-risk   — Model 0 gate + Model A crack analysis
#   POST /infer/scenario-score — Model 3 scenario liquefaction scoring
#   GET  /health              — Health check (no model loading)

import io
import json
import logging
from pathlib import Path
from contextlib import asynccontextmanager

import os
from pathlib import Path
from contextlib import asynccontextmanager

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torchvision import transforms, models
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import lightgbm as lgb
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

# ─── Logging ───
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("kompon-ml")

# ─── Weight paths (relative to app root inside the Docker container) ───
GATE_WEIGHTS = Path("weights/gate_mobilenetv3.pth")
GATE_CONFIG = Path("weights/gate_config.json")
CRACK_WEIGHTS = Path("weights/best.pt")
SCENARIO_MODEL = Path("weights/scenario_model.txt")
SCENARIO_FEATURES = Path("weights/scenario_feature_list.json")
SCENARIO_CAT_COLS = Path("weights/scenario_categorical_cols.json")

# ─── Global model holders (loaded once at startup) ───
gate_model = None
gate_cfg = None
gate_transform = None
crack_model = None
scenario_booster = None
scenario_feature_list = None
scenario_cat_cols = None


# ═══════════════════════════════════════════════════════════════════
# HUGGING FACE HUB DYNAMIC WEIGHT LOADER
# ═══════════════════════════════════════════════════════════════════

def get_file_path(local_path: Path, env_repo_id: str, filename: str) -> str:
    """
    Get the path to a weight file. 
    1. If the file exists and is a real binary (not a Git LFS pointer < 500 bytes), use it.
    2. Otherwise, download it dynamically from the Hugging Face model repository.
    """
    # Real files are much larger than a few hundred bytes LFS pointer
    if local_path.exists() and local_path.stat().st_size > 500:
        logger.info(f"Using local file: {local_path} ({local_path.stat().st_size / 1024 / 1024:.2f} MB)")
        return str(local_path)

    # Resolve Hugging Face repo ID
    repo_id = os.environ.get(env_repo_id)
    if not repo_id:
        error_msg = (
            f"Local file {local_path} is missing/invalid, and environment variable "
            f"'{env_repo_id}' is not set. Cannot download from Hugging Face Hub."
        )
        logger.error(error_msg)
        raise RuntimeError(error_msg)

    logger.info(f"Downloading {filename} from HF repo {repo_id}...")
    try:
        # Downloads from HF hub (uses HF_TOKEN automatically if set in Space secrets)
        downloaded_path = hf_hub_download(repo_id=repo_id, filename=filename)
        logger.info(f"Successfully downloaded {filename} to {downloaded_path}")
        return downloaded_path
    except Exception as e:
        logger.error(f"Failed to download {filename} from Hugging Face: {e}")
        raise


# ═══════════════════════════════════════════════════════════════════
# MODEL 0 — Image validity gate (MobileNetV3-Small, 3-class)
# ═══════════════════════════════════════════════════════════════════

# Tunables (from original gate.py)
GATE_TAU = 0.55          # confidence floor; below this -> ACCEPT (accept-on-uncertainty)
BLUR_MIN = 60.0          # variance-of-Laplacian below this -> too blurry
BRIGHT_LO, BRIGHT_HI = 40, 215   # mean luma bounds (0-255)
MIN_SIDE = 200           # shorter side in pixels


def load_gate():
    global gate_model, gate_cfg, gate_transform

    # Resolve paths (local first, then HF Hub)
    config_path = get_file_path(GATE_CONFIG, "HF_MODEL_REPO_GATE", "gate_config.json")
    weights_path = get_file_path(GATE_WEIGHTS, "HF_MODEL_REPO_GATE", "gate_mobilenetv3.pth")

    with open(config_path, "r") as f:
        gate_cfg = json.load(f)

    m = models.mobilenet_v3_small(weights=None)
    m.classifier[3] = nn.Linear(m.classifier[3].in_features, len(gate_cfg["classes"]))
    
    # In PyTorch 2.6+, weights_only defaults to True which blocks loading.
    # We bypass this using weights_only=False.
    m.load_state_dict(torch.load(weights_path, map_location="cpu", weights_only=False))
    m.eval()
    gate_model = m

    gate_transform = transforms.Compose([
        transforms.Resize((gate_cfg["img_size"], gate_cfg["img_size"])),
        transforms.ToTensor(),
        transforms.Normalize(gate_cfg["mean"], gate_cfg["std"]),
    ])
    logger.info("Model 0 (gate) loaded.")


def passes_quality(pil_img: Image.Image):
    """Cheap blur/brightness/resolution check. Returns (ok, reason)."""
    g = np.asarray(pil_img.convert("L"), dtype=np.float32)
    h, w = g.shape
    if min(h, w) < MIN_SIDE:
        return False, "too_small"
    mean_luma = g.mean()
    if mean_luma < BRIGHT_LO:
        return False, "too_dark"
    if mean_luma > BRIGHT_HI:
        return False, "overexposed"
    # Variance of Laplacian (manual 3x3, no cv2 dependency)
    lap = (-4 * g[1:-1, 1:-1] + g[:-2, 1:-1] + g[2:, 1:-1] + g[1:-1, :-2] + g[1:-1, 2:])
    if lap.var() < BLUR_MIN:
        return False, "too_blurry"
    return True, "ok"


def run_gate(pil_img: Image.Image) -> dict:
    """Run Model 0 gate. Returns gate decision dict."""
    ok, why = passes_quality(pil_img)
    if not ok:
        return {
            "decision": "reject",
            "reason": why,
            "class": None,
            "confidence": None,
            "message": (
                "The image is too unclear. Please retake it in better light, "
                "closer to the damage, and in focus."
            ),
        }

    with torch.no_grad():
        logits = gate_model(gate_transform(pil_img.convert("RGB")).unsqueeze(0))
        prob = torch.softmax(logits, 1)[0].numpy()

    idx = int(prob.argmax())
    conf = float(prob[idx])
    cls = gate_cfg["classes"][idx]

    # Accept-on-uncertainty: never block a possibly-real crack
    if conf < GATE_TAU or cls == "building_surface":
        return {
            "decision": "accept",
            "class": cls,
            "confidence": round(conf, 4),
        }

    if cls == "road_or_pavement":
        return {
            "decision": "reject",
            "reason": "road",
            "class": cls,
            "confidence": round(conf, 4),
            "message": (
                "A crack-like pattern was detected, but this appears to be road or "
                "pavement damage. Kompon screens building cracks — please upload a "
                "wall, column, beam, or slab photo."
            ),
        }

    return {
        "decision": "reject",
        "reason": "other",
        "class": cls,
        "confidence": round(conf, 4),
        "message": (
            "This doesn't appear to be a building surface. Please upload a clear photo "
            "of a wall, column, beam, slab, or visible building damage."
        ),
    }


# ═══════════════════════════════════════════════════════════════════
# MODEL A — Crack/damage segmentation (YOLOv8-seg, 5 classes)
# ═══════════════════════════════════════════════════════════════════

CRACK_CLASSES = ["microcrack", "structural_crack", "spalling", "rebar_corrosion", "severe_distress"]

BASE_CONCERN = {
    "microcrack":       "Low",
    "structural_crack": "High",
    "spalling":         "Moderate",
    "rebar_corrosion":  "Very High",
    "severe_distress":  "Very High",
}
TIER_ORDER = ["Very Low", "Low", "Moderate", "High", "Very High"]


def _tier_max(a, b):
    return a if TIER_ORDER.index(a) >= TIER_ORDER.index(b) else b


def load_crack_model():
    global crack_model
    weights_path = get_file_path(CRACK_WEIGHTS, "HF_MODEL_REPO_CRACK", "best.pt")
    crack_model = YOLO(weights_path)
    logger.info("Model A (crack/damage) loaded.")


def analyze_crack(result) -> list:
    """Aggregate one YOLO result into a list of detections with coverage."""
    dets = []
    if result.masks is None or len(result.masks) == 0:
        return dets
    md = result.masks.data.cpu().numpy()  # (N, h, w)
    cls_ids = result.boxes.cls.cpu().numpy().astype(int)
    confs = result.boxes.conf.cpu().numpy()
    frame = md.shape[1] * md.shape[2]
    for i in range(len(cls_ids)):
        class_name = CRACK_CLASSES[cls_ids[i]] if cls_ids[i] < len(CRACK_CLASSES) else f"class_{cls_ids[i]}"
        dets.append({
            "class": class_name,
            "confidence": round(float(confs[i]), 4),
            "coverage_pct": round(float(md[i].sum() / frame) * 100, 2),
        })
    return dets


def severity_from_detections(dets: list) -> dict:
    """Apply Kompon safety rules. NEVER returns 'safe'. Uncertainty escalates."""
    if not dets:
        return {
            "severity_tier": "Very Low",
            "reliable": True,
            "escalate": False,
            "detections": [],
            "message": (
                "No significant structural damage was detected in this image. "
                "This is only a screening result, not a safety check — if you can see "
                "damage, please still answer the location questions."
            ),
        }

    # OOD fail-safe: only tiny, low-confidence fragments
    strong = [d for d in dets if d["coverage_pct"] >= 1.0 or d["confidence"] >= 0.50]
    if not strong:
        return {
            "severity_tier": "Unclear",
            "reliable": False,
            "escalate": False,
            "detections": dets,
            "message": (
                "Couldn't get a clear read on this surface (possibly brick/mortar lines, "
                "shadows, or a low-quality photo). Please use the crack-pattern guide and "
                "answer the location questions instead of relying on the photo."
            ),
        }

    concern = "Very Low"
    detected = {}
    for d in strong:
        c = BASE_CONCERN.get(d["class"], "Moderate")
        # Coverage modulation
        if d["class"] == "spalling" and d["coverage_pct"] >= 15.0:
            c = "Very High"
        if d["class"] == "structural_crack" and d["coverage_pct"] >= 10.0:
            c = "Very High"
        concern = _tier_max(concern, c)
        detected[d["class"]] = max(detected.get(d["class"], 0.0), d["confidence"])

    escalate = TIER_ORDER.index(concern) >= TIER_ORDER.index("High")
    msg = (
        f"Visual concern: {concern}. Detected: {', '.join(sorted(detected))}. "
        "This is a screening result, not a structural safety certificate. "
    )
    if escalate:
        msg += (
            "Damage at this level — especially on a column, beam, slab, or load-bearing "
            "wall — should be inspected by a qualified structural engineer."
        )

    return {
        "severity_tier": concern,
        "reliable": True,
        "escalate": escalate,
        "detections": dets,
        "detected_classes": detected,
        "message": msg,
    }


def run_crack_analysis(pil_img: Image.Image) -> dict:
    """Run Model A on an image. Returns crack analysis dict."""
    result = crack_model.predict(pil_img, imgsz=640, conf=0.25, verbose=False)[0]
    dets = analyze_crack(result)
    severity = severity_from_detections(dets)
    return severity


# ═══════════════════════════════════════════════════════════════════
# MODEL 3 — Scenario liquefaction scoring (LightGBM regression)
# ═══════════════════════════════════════════════════════════════════

def load_scenario_model():
    global scenario_booster, scenario_feature_list, scenario_cat_cols

    # Resolve paths (local first, then HF Hub)
    model_filename = os.environ.get("HF_SCENARIO_MODEL_FILE", "scenario_model.txt")
    model_path = get_file_path(SCENARIO_MODEL, "HF_MODEL_REPO_SCENARIO", model_filename)
    features_path = get_file_path(SCENARIO_FEATURES, "HF_MODEL_REPO_SCENARIO", "scenario_feature_list.json")
    cat_cols_path = get_file_path(SCENARIO_CAT_COLS, "HF_MODEL_REPO_SCENARIO", "scenario_categorical_cols.json")

    scenario_booster = lgb.Booster(model_file=model_path)
    
    with open(features_path, "r") as f:
        scenario_feature_list = json.load(f)
        
    with open(cat_cols_path, "r") as f:
        scenario_cat_cols = json.load(f)

    logger.info(f"Model 3 (scenario) loaded. Features: {len(scenario_feature_list)}")


def predict_scenario(feature_row: dict) -> dict:
    """
    Predict scenario-adjusted liquefaction score.
    Returns score (0-100), risk class, and disclaimer.
    Verbatim from the spec — do not reword.
    """
    x = pd.DataFrame([feature_row])[scenario_feature_list]
    for col in scenario_cat_cols:
        if col in x.columns:
            x[col] = x[col].astype("category")

    score = float(scenario_booster.predict(x)[0])
    score = max(0.0, min(100.0, score))

    if score < 20:
        risk_class = "Very Low"
    elif score < 40:
        risk_class = "Low"
    elif score < 60:
        risk_class = "Moderate"
    elif score < 80:
        risk_class = "High"
    else:
        risk_class = "Very High"

    return {
        "score": round(score, 2),
        "scenario_liquefaction_score": round(score, 2),
        "scenario_risk_class": risk_class,
        "disclaimer": (
            "Screening result only — not a safety certificate. "
            "Based on a model trained on 8 earthquakes, M5.0–M6.9. "
            "Do not use for structural decisions without a licensed engineer."
        ),
    }


# ═══════════════════════════════════════════════════════════════════
# FASTAPI APP
# ═══════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load all models at startup."""
    logger.info("Loading models...")
    load_gate()
    load_crack_model()
    load_scenario_model()
    logger.info("All models loaded and ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Kompon ML Inference API",
    description="Image risk analysis and scenario liquefaction scoring for Kompon.",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── Pydantic models for scenario request ───
class ScenarioRequest(BaseModel):
    """Features for scenario liquefaction prediction."""
    vs30: float = 250.0
    elevation_m: float = 10.0
    slope_deg: float = 0.5
    dist_water_m: float = 1000.0
    water_occurrence_pct: float = 0.0
    geology_class: str = "Unknown"
    hand_m: float = 10.0
    water_max_extent: float = 0.0
    dynamic_label_name: str = "Unknown"
    magnitude: float
    depth_km: float
    dist_epicenter_km: float
    pga_g_filled: float
    pgv_cms_filled: float
    mmi_filled: float
    # Optional ground features that may come from hazard lookup
    ground_susceptibility_score: Optional[float] = None


# ─── POST /infer/image-risk ───
@app.post("/infer/image-risk")
async def infer_image_risk(image: UploadFile = File(...)):
    """
    Combined Model 0 (gate) + Model A (crack/damage).
    Accepts multipart/form-data with field 'image'.
    """
    try:
        # Read and validate the image
        contents = await image.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Empty image file.")
        if len(contents) > 16 * 1024 * 1024:  # 16MB safety limit
            raise HTTPException(status_code=400, detail="Image too large (max 16MB).")

        pil_img = Image.open(io.BytesIO(contents)).convert("RGB")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")

    # Step 1: Run gate
    gate_result = run_gate(pil_img)

    # If gate rejects, return early — don't run Model A
    if gate_result["decision"] != "accept":
        return JSONResponse(content={
            "gate": gate_result,
            "crack_analysis": None,
            "disclaimer": (
                "Screening result only — not a safety certificate. "
                "Refer High/Very High findings to a licensed engineer."
            ),
        })

    # Step 2: Run Model A crack analysis
    crack_result = run_crack_analysis(pil_img)

    return JSONResponse(content={
        "gate": gate_result,
        "crack_analysis": {
            "detections": crack_result.get("detections", []),
            "severity_tier": crack_result.get("severity_tier", "Very Low"),
            "reliable": crack_result.get("reliable", True),
            "escalate": crack_result.get("escalate", False),
            "detected_classes": crack_result.get("detected_classes", {}),
            "message": crack_result.get("message", ""),
        },
        "disclaimer": (
            "Screening result only — not a safety certificate. "
            "Refer High/Very High findings to a licensed engineer."
        ),
    })


# ─── POST /infer/scenario-score ───
@app.post("/infer/scenario-score")
async def infer_scenario_score(request: ScenarioRequest):
    """
    Model 3 scenario liquefaction scoring.
    Accepts JSON body with ground + shaking features.
    """
    try:
        feature_row = request.model_dump()
        # Remove fields not in the feature list
        feature_row.pop("ground_susceptibility_score", None)

        result = predict_scenario(feature_row)
        return JSONResponse(content=result)
    except Exception as e:
        logger.error(f"Scenario prediction error: {e}")
        raise HTTPException(
            status_code=500,
            detail=(
                "Scenario prediction failed. "
                "Do not interpret this as an indication of safety."
            ),
        )


# ─── GET /health ───
@app.get("/health")
async def health():
    """Instant 200, no model loading touched."""
    return {"status": "ok", "service": "kompon-ml-space"}
