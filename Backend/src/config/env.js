import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../..");
const envPath = path.join(backendRoot, ".env");
const fallbackEnvPath = path.join(backendRoot, "env");

const selectedEnvPath = existsSync(envPath) ? envPath : fallbackEnvPath;

dotenv.config({ path: selectedEnvPath });

export { backendRoot, selectedEnvPath };
