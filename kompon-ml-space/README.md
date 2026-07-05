---
title: Kompon ML
emoji: 🚀
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---
# Kompon ML Inference Space

Earthquake building risk assessment — image analysis and scenario liquefaction scoring.

## API Endpoints

| Route | Method | Description |
|-------|--------|-------------|
| `/infer/image-risk` | POST | Model 0 (gate) + Model A (crack/damage segmentation) |
| `/infer/scenario-score` | POST | Model 3 (scenario liquefaction scoring) |
| `/health` | GET | Health check |

## Models

- **Model 0** — MobileNetV3-Small, 3-class image validity gate (99.88% val acc)
- **Model A** — YOLOv8s-seg, 5-class crack/damage segmentation (mask mAP50 0.725)
- **Model 3** — LightGBM regression, scenario-adjusted liquefaction score (LOEO-validated on 8 events)
