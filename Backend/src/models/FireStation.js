// Kompon — FireStation model (§3c)
// Fire brigade directory — Dhaka division MVP, national fallback elsewhere.

import mongoose from "mongoose";

const fireStationSchema = new mongoose.Schema(
  {
    division: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    upazila: {
      type: String,
      default: null,
    },
    station_name: {
      type: String,
      required: true,
    },
    phone_numbers: {
      type: [String],
      required: true,
    },
    source_url: {
      type: String,
      default: null,
    },
    last_verified: {
      type: String, // ISO date string, e.g. "2026-07-05"
      default: null,
    },
  },
  {
    collection: "fire_stations",
    timestamps: false,
  }
);

// Index for district + upazila search queries
fireStationSchema.index({ district: 1, upazila: 1 });

const FireStation = mongoose.model("FireStation", fireStationSchema);

export default FireStation;
