import fs from "fs";
import path from "path";
import axios from "axios";
import os from "os";

export const DATA_DIR = path.join(os.tmpdir(), "kompon-data");

export async function fetchServingData() {
  const repoId = process.env.HF_DATASET_REPO;
  if (!repoId) {
    console.warn("[DuckDB] HF_DATASET_REPO not set. Skipping parquet download. (DuckDB will fail if files are missing locally)");
    return;
  }

  // Ensure directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const baseUrl = `https://huggingface.co/datasets/${repoId}/resolve/main`;
  
  // Hardcoded list of files to download based on the spec
  // 1 static grid, 8 scenarios
  const files = [
    "hazard_grid.parquet",
    "scenario_1.parquet",
    "scenario_2.parquet",
    "scenario_3.parquet",
    "scenario_4.parquet",
    "scenario_5.parquet",
    "scenario_6.parquet",
    "scenario_7.parquet",
    "scenario_8.parquet",
  ];

  console.log(`[DuckDB] Fetching ${files.length} parquet files from HF Datasets (${repoId})...`);

  for (const file of files) {
    const dest = path.join(DATA_DIR, file);
    if (fs.existsSync(dest)) {
      // Basic check, if exists we skip to save startup time. (In production, could check ETags)
      console.log(`[DuckDB] File ${file} already exists, skipping download.`);
      continue;
    }

    try {
      console.log(`[DuckDB] Downloading ${file}...`);
      const response = await axios({
        url: `${baseUrl}/${file}`,
        method: "GET",
        responseType: "stream"
      });

      const writer = fs.createWriteStream(dest);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });
    } catch (err) {
      console.error(`[DuckDB] Failed to download ${file}:`, err.message);
    }
  }
  
  console.log("[DuckDB] Finished fetching parquet files.");
}
