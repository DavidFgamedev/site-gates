#!/usr/bin/env node
/**
 * CLI. Printing and exit codes live here; detection lives in src/.
 *
 * The split is deliberate and is what makes the gates testable: each gate is a pure
 * function over a config that returns a result, so a test can assert on what it found
 * without capturing stdout or spawning a process.
 */
import { loadConfig, section, DEFAULT_CONFIG_PATH } from "../src/config.mjs";
import { runVocabulary } from "../src/vocabulary.mjs";
import { runContrast } from "../src/contrast.mjs";
import { runMirror } from "../src/mirror.mjs";

const args = process.argv.slice(2);
const gate = args[0];
const ci = args.indexOf("--config");
const configPath = ci !== -1 ? args[ci + 1] : DEFAULT_CONFIG_PATH;

const USAGE = `site-gates <gate> [--config <path>]

  vocabulary   banned terms in file names and bodies, across a built site
  contrast     WCAG 2.1 contrast for every declared text role
  mirror       a hand-maintained list against the data it mirrors

Config defaults to ${DEFAULT_CONFIG_PATH}.`;

if (!gate || gate === "--help" || gate === "-h") {
  console.log(USAGE);
  process.exit(gate ? 0 : 1);
}

let config;
try {
  config = loadConfig(configPath);
} catch (err) {
  console.error(err.message);
  process.exit(2);
}

function vocabulary() {
  const r = runVocabulary(section(config, "vocabulary"));
  console.log(`Swept ${r.swept} publicly reachable paths across ${r.roots.join(", ") || "(no roots)"}.`);
  if (r.ok) {
    console.log("No banned vocabulary in any path name or body.");
    return 0;
  }
  console.error(`\n${r.problems.length} problem(s):\n`);
  for (const p of r.problems) {
    console.error(`  ${p.where}  ${p.term}`);
    console.error(`    ${p.file}`);
    console.error(`    ...${p.context}...\n`);
  }
  if (r.problems.some((p) => p.where === "MARKER")) {
    console.error("A MARKER problem is an unclosed sweep:allow-start. Close it at the end of");
    console.error("the text that needs the exemption, not at the end of the file: everything");
    console.error("between the markers is invisible to this sweep.\n");
  }
  console.error("A hit is either a real leak or a false positive that belongs in `allow`,");
  console.error("with a comment saying why. Do not widen a term to silence it.");
  return 1;
}

function contrast() {
  const r = runContrast(section(config, "contrast"));
  console.log("role                          fg          ground    size    ratio  min");
  console.log("-".repeat(78));
  for (const row of r.rows) {
    console.log(
      `${row.role.padEnd(29)} ${row.fg.padEnd(11)} ${row.ground.padEnd(9)} ${String(row.size).padEnd(7)} ` +
        `${row.value.toFixed(2).padStart(5)}  ${String(row.min).padStart(3)}  ${row.ok ? "ok" : "FAIL"}`,
    );
  }
  console.log("-".repeat(78));
  if (r.ok) {
    console.log(`All ${r.roles} text roles clear their threshold (${r.checked} combinations).`);
    return 0;
  }
  console.error(`\n${r.problems.length} role/ground combination(s) below threshold.`);
  console.error("Lighten the token, do not lower the bar.");
  return 1;
}

function mirror() {
  const r = runMirror(section(config, "mirror"));
  let code = 0;
  for (const p of r.pairs) {
    if (p.error) { console.error(`  ERROR  ${p.name}: ${p.error}`); code = 1; continue; }
    console.log(`${p.name}: ${p.source.length} in source, ${p.mirror.length} in mirror`);
    for (const s of p.source) console.log(`  ${p.mirror.includes(s) ? "ok  " : "MISS"}  ${s}`);
    if (p.extra.length) console.log(`  note: in mirror but not in source: ${p.extra.join(", ")}`);
    if (p.missing.length) {
      console.error(`\n  Missing from the mirror: ${p.missing.join(", ")}`);
      console.error("  These exist in the source and nothing guards them.");
      code = 1;
    }
  }
  if (code === 0) console.log(`\nAll ${r.pairs.length} mirrored list(s) in sync.`);
  return code;
}

const gates = { vocabulary, contrast, mirror };
if (!gates[gate]) {
  console.error(`Unknown gate "${gate}".\n\n${USAGE}`);
  process.exit(2);
}
try {
  process.exit(gates[gate]());
} catch (err) {
  console.error(`${gate} could not run: ${err.message}`);
  process.exit(2);
}
