import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

/**
 * Banned vocabulary across every publicly reachable path in a build.
 *
 * Two properties matter more than the word list itself.
 *
 * It sweeps by NAME as well as by CONTENT. A grep over file bodies passes a file that is
 * merely *called* `internal-codename.js`, and a URL-addressable asset is as public as the
 * HTML that references it.
 *
 * It sweeps every configured root, not just the rendered pages. Server routes, API
 * handlers and bundled assets ship too, and a page-level sweep cannot see path-addressed
 * content by construction.
 *
 * HARD terms fail on any occurrence. SOFT terms are ordinary English or common library
 * tokens, so they fail only outside a documented allowlist: a sweep that cries wolf is
 * ignored, which is worse than no sweep.
 */

const ALLOW_START = "sweep:allow-start";
const ALLOW_END = "sweep:allow-end";

/**
 * Blanks out regions bracketed by markers, for the one legitimate case: text that must
 * name the banned vocabulary in order to forbid it, such as the rule itself.
 *
 * An unterminated start marker is a failure and is reported as one. It also does NOT
 * widen into an exemption: the remainder is swept anyway. A missing end marker should
 * cost coverage of nothing, because the failure mode that silently stops checking is the
 * one nobody notices.
 */
export function stripAllowed(body, file, problems) {
  let out = "";
  let i = 0;
  for (;;) {
    const a = body.indexOf(ALLOW_START, i);
    if (a === -1) { out += body.slice(i); break; }
    out += body.slice(i, a);
    const b = body.indexOf(ALLOW_END, a);
    if (b === -1) {
      problems.push({
        file, where: "MARKER",
        term: `${ALLOW_START} with no matching ${ALLOW_END}`,
        context: body.slice(a, a + 80).replace(/\s+/g, " "),
      });
      out += body.slice(a);
      break;
    }
    out += " ".repeat(b - a);   // keep offsets stable so context slices still line up
    i = b;
  }
  return out;
}

function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function runVocabulary(cfg, { cwd = process.cwd() } = {}) {
  const roots = cfg.roots ?? [];
  const hard = cfg.hard ?? [];
  const soft = cfg.soft ?? [];
  const allow = (cfg.allow ?? []).map((a) => a.toLowerCase());
  const text = new Set(cfg.textExtensions ?? [".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".md"]);

  const files = roots.flatMap((r) => walk(join(cwd, r)));
  const problems = [];

  for (const file of files) {
    const rel = relative(cwd, file);
    const lowerName = rel.toLowerCase();

    for (const term of hard) {
      if (lowerName.includes(term.toLowerCase())) {
        problems.push({ file: rel, term, where: "FILENAME", context: rel });
      }
    }

    if (!text.has(extname(file))) continue;

    let raw;
    try { raw = readFileSync(file, "utf8"); } catch { continue; }
    const body = stripAllowed(raw, rel, problems);
    const lower = body.toLowerCase();

    for (const term of hard) {
      const i = lower.indexOf(term.toLowerCase());
      if (i !== -1) {
        problems.push({
          file: rel, term, where: "CONTENT",
          context: body.slice(Math.max(0, i - 45), i + 45).replace(/\s+/g, " "),
        });
      }
    }

    for (const pattern of soft) {
      for (const m of lower.matchAll(new RegExp(pattern, "g"))) {
        const around = lower.slice(Math.max(0, m.index - 30), m.index + 30);
        if (allow.some((a) => around.includes(a))) continue;
        problems.push({
          file: rel, term: pattern, where: "CONTENT (soft)",
          context: body.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\s+/g, " "),
        });
      }
    }
  }

  return { ok: problems.length === 0, swept: files.length, roots, problems };
}
