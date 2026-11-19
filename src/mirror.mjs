import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Catches drift between a hand-maintained list and the data it mirrors.
 *
 * Any time one file keeps a copy of names that live somewhere else, a guard list, a
 * filter, a route table, a translation key set, the copy silently goes stale the first
 * time the source is renamed. Every other check still passes: the rename is correct, the
 * build is correct, and a hole opens anyway because nothing connects the two lists.
 *
 * This reads both as TEXT and compares extracted names. Reading as text rather than
 * importing is deliberate: the source often cannot be imported by a plain Node process,
 * because it pulls in assets, JSX or framework globals, and a gate that cannot run is a
 * gate that gets deleted.
 *
 * Direction matters. A name in the source and missing from the mirror is a FAILURE: the
 * thing exists and nothing guards it. A name in the mirror and missing from the source is
 * only a NOTE, because a mirror legitimately covers things the source does not list.
 */
export function runMirror(cfg, { cwd = process.cwd() } = {}) {
  const pairs = cfg.pairs ?? [];
  const results = [];
  let failed = 0;

  for (const pair of pairs) {
    const sourceText = readFileSync(resolve(cwd, pair.source.file), "utf8");
    let mirrorText = readFileSync(resolve(cwd, pair.mirror.file), "utf8");

    /* Narrow the mirror to the declaration that matters, so an unrelated string
       elsewhere in the file cannot accidentally satisfy the check. */
    if (pair.mirror.between) {
      const [open, close] = pair.mirror.between;
      const start = mirrorText.indexOf(open);
      if (start === -1) {
        results.push({ name: pair.name, error: `Mirror file has no "${open}"`, missing: [], extra: [], source: [] });
        failed++;
        continue;
      }
      const end = mirrorText.indexOf(close, start);
      mirrorText = mirrorText.slice(start, end === -1 ? undefined : end);
    }

    const extract = (text, pattern) =>
      [...text.matchAll(new RegExp(pattern, "g"))].map((m) => m[1]).filter(Boolean);

    const source = extract(sourceText, pair.source.pattern);
    const mirror = extract(mirrorText, pair.mirror.pattern);

    const missing = source.filter((s) => !mirror.includes(s));
    const extra = mirror.filter((m) => !source.includes(m));

    if (missing.length) failed++;
    results.push({ name: pair.name, source, mirror, missing, extra, error: null });
  }

  return { ok: failed === 0, pairs: results };
}
