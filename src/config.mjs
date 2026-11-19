import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DEFAULT_CONFIG_PATH = "site-gates.config.json";

/**
 * Config is a plain JSON file, loaded explicitly and never discovered by walking parent
 * directories. A gate that silently picks up a different config than you think it did is
 * worse than one that fails to start, because the first still prints a pass.
 */
export function loadConfig(path = DEFAULT_CONFIG_PATH) {
  const full = resolve(path);
  let raw;
  try {
    raw = readFileSync(full, "utf8");
  } catch {
    throw new Error(
      `No config at ${full}\n` +
        `Pass one with --config <path>, or copy examples/config.example.json to ${DEFAULT_CONFIG_PATH}.`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Config at ${full} is not valid JSON: ${err.message}`);
  }
}

/**
 * A missing section is an error, not an empty default.
 *
 * An empty vocabulary list would sweep every file and find nothing, exit 0, and read
 * exactly like a clean result. The quiet direction is the dangerous one for a guard, so
 * absence is loud here.
 */
export function section(config, name) {
  const s = config?.[name];
  if (!s) throw new Error(`Config has no "${name}" section. A gate with no rules cannot pass or fail honestly.`);
  return s;
}
