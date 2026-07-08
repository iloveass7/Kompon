// Kompon — ScenarioPoint model (§3b)
// Pre-computed per-event scenario grids (Model 3 training data).
// One collection with event_id field + compound index.

import mongoose from "mongoose";

const scenarioPointSchema = new mongoose.Schema(
  {
    event_id: {
      type: String,
      required: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lon, lat]
        required: true,
      },
    },
    // Shaking features (from pre-computed GMPE grid)
    magnitude: { type: Number, required: true },
    depth_km: { type: Number, required: true },
    dist_epicenter_km: { type: Number, required: true },
    pga_g_filled: { type: Number, required: true },
    pgv_cms_filled: { type: Number, required: true },
    mmi_filled: { type: Number, required: true },
    // Ground features (mirror of hazard_points for this event's grid)
    ground_susceptibility_score: { type: Number },
    vs30: { type: Number },
    elevation_m: { type: Number },
    slope_deg: { type: Number },
    dist_water_m: { type: Number },
    water_occurrence_pct: { type: Number },
    geology_class: { type: String },
    hand_m: { type: Number },
    water_max_extent: { type: Number },
    dynamic_label_name: { type: String },
  },
  {
    collection: "scenario_points",
    timestamps: false,
  }
);

// Compound index: event_id for filtering + 2dsphere for $near
scenarioPointSchema.index({ event_id: 1, location: "2dsphere" });

const ScenarioPoint = mongoose.model("ScenarioPoint", scenarioPointSchema);

export default ScenarioPoint;
