// Kompon — HazardPoint model (§3a)
// Static ground/soil liquefaction susceptibility grid (Model B).
// Clipped to demo region, loaded once via loadStaticData.js.

import mongoose from "mongoose";

const hazardPointSchema = new mongoose.Schema(
  {
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lon, lat] — GeoJSON order
        required: true,
      },
    },
    ground_susceptibility_score: {
      type: Number,
      required: true,
    },
    ground_susceptibility_class: {
      type: String,
      required: true,
    },
    vs30: {
      type: Number,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
    },
  },
  {
    collection: "hazard_points",
    timestamps: false, // static data — no need for createdAt/updatedAt
  }
);

// 2dsphere index for $near geospatial queries
hazardPointSchema.index({ location: "2dsphere" });

const HazardPoint = mongoose.model("HazardPoint", hazardPointSchema);

export default HazardPoint;
