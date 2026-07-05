import axios from "axios";

// The function schema matching OpenAI's tool calling format
export const earthquakeToolSchema = {
  type: "function",
  function: {
    name: "get_recent_earthquakes",
    description:
      "Get real, current earthquake data for a region and time window. Always use this instead of answering from memory for any question about recent or current earthquakes.",
    parameters: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: "e.g. 'Bangladesh', 'South Asia', 'worldwide'",
        },
        days: {
          type: "integer",
          description: "How many past days to look back, e.g. 7",
        },
        min_magnitude: {
          type: "number",
          description: "Minimum magnitude to include, default 4.0",
        },
      },
      required: ["region"],
    },
  },
};

/**
 * Execute the USGS fdsnws API query to get recent earthquakes
 */
export async function getRecentEarthquakes(args) {
  try {
    const days = args.days || 7;
    const minMag = args.min_magnitude || 4.0;

    // Calculate start time based on 'days'
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - days);

    // Set bounding box based on region (simple heuristic)
    let minlat = -90,
      maxlat = 90,
      minlon = -180,
      maxlon = 180;
    const regionLower = (args.region || "").toLowerCase();

    if (regionLower.includes("bangladesh")) {
      minlat = 20.5;
      maxlat = 26.7;
      minlon = 88.0;
      maxlon = 92.7;
    } else if (regionLower.includes("south asia")) {
      minlat = 5.0;
      maxlat = 40.0;
      minlon = 60.0;
      maxlon = 100.0;
    }

    const params = {
      format: "geojson",
      starttime: startTime.toISOString().split("T")[0],
      minmagnitude: minMag,
      minlatitude: minlat,
      maxlatitude: maxlat,
      minlongitude: minlon,
      maxlongitude: maxlon,
    };

    const response = await axios.get(
      "https://earthquake.usgs.gov/fdsnws/event/1/query",
      { params, timeout: 5000 }
    );

    const features = response.data.features || [];
    // Only return essential data to save tokens
    const events = features.slice(0, 10).map((f) => ({
      place: f.properties.place,
      magnitude: f.properties.mag,
      time: new Date(f.properties.time).toISOString(),
      depth_km: f.geometry.coordinates[2],
    }));

    return {
      status: "success",
      events_found: features.length,
      top_events: events,
    };
  } catch (err) {
    console.error("[EarthquakeTool] USGS API error:", err.message);
    return {
      status: "error",
      message: "Failed to retrieve live earthquake data from USGS API.",
    };
  }
}
