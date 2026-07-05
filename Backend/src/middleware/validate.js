// Kompon — Request validation middleware (§7)
// Zod schemas for all request inputs — server-side validation,
// never trust client-side validation alone.

import { z } from "zod";

// ─── Valid event IDs for Model 3 (the 8 trained events) ───
// These should match the event_id values loaded into the scenario_points collection.
// Update this list if the model is retrained on different events.
export const VALID_EVENT_IDS = [
  "event_1",
  "event_2",
  "event_3",
  "event_4",
  "event_5",
  "event_6",
  "event_7",
  "event_8",
];

// ─── Questionnaire schema (§6.1.1) ───
export const questionnaireSchema = z.object({
  building_age: z
    .enum(["<10y", "10-30y", ">30y", "unknown"])
    .default("unknown"),
  stories: z.enum(["1-2", "3-5", "6+"]).default("1-2"),
  soft_story: z.enum(["yes", "no", "unsure"]).default("unsure"),
  structural_material: z
    .enum(["rc_frame", "load_bearing_masonry", "informal_other"])
    .default("load_bearing_masonry"),
  foundation_settlement: z.enum(["yes", "no", "unsure"]).default("unsure"),
  prior_damage: z.enum(["yes", "no", "unsure"]).default("unsure"),
  crack_location: z
    .enum(["column_beam_joint", "load_bearing_wall", "plaster_partition", "unsure"])
    .default("unsure"),
});

// ─── Risk assessment request (§6.1) ───
export const riskAssessmentSchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional(),
  lon: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional(),
  scenario_event_id: z
    .enum(VALID_EVENT_IDS)
    .optional(),
  questionnaire: z.string().optional(), // JSON string, parsed separately
});

// ─── Safe places request (§6.3) ───
export const safePlacesSchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lon: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radius_m: z.coerce
    .number()
    .int()
    .min(100, "Minimum radius is 100m")
    .max(5000, "Maximum radius is 5000m")
    .default(1000),
  bypassCache: z.union([z.boolean(), z.string()]).optional(),
});

// ─── Fire brigade search (§6.4) ───
export const fireBrigadeSchema = z.object({
  district: z.string().min(1, "District is required").trim(),
  upazila: z.string().trim().optional(),
});

// ─── Hazard static lookup (§6.5) ───
export const hazardSchema = z.object({
  lat: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90"),
  lon: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
});

// ─── News request ───
export const newsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  country: z.string().trim().optional(),
});

// ─── Middleware factory ───
/**
 * Create an Express middleware that validates request data against a Zod schema.
 *
 * @param {z.ZodSchema} schema — Zod schema to validate against
 * @param {"query"|"body"|"params"} source — where to read the data from
 * @returns {Function} Express middleware
 */
export function validateRequest(schema, source = "query") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(400).json({
        error: "Validation failed",
        details: errors,
      });
    }

    // Replace the source data with the parsed/coerced values
    req[source] = result.data;
    next();
  };
}

export default {
  questionnaireSchema,
  riskAssessmentSchema,
  safePlacesSchema,
  fireBrigadeSchema,
  hazardSchema,
  newsSchema,
  validateRequest,
  VALID_EVENT_IDS,
};
