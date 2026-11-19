/**
 * WCAG 2.1 contrast for every text role in a design system.
 *
 * Checking colour pairs ad hoc misses the case that actually breaks: a role that passes
 * on its usual background and fails on another one it can also land on. So a role is
 * declared against EVERY ground it can appear over, and each combination is measured.
 * A card moved onto a different surface is exactly how a passing role quietly stops
 * passing.
 *
 * Thresholds are WCAG 2.1: 4.5:1 for normal text, 3:1 for large text, which is 24px and
 * above, or 18.66px and above when bold. The threshold lives on the role because only the
 * role knows what size it renders at.
 */

const hexToRgb = (h) => {
  const v = h.replace("#", "").trim();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) throw new Error(`Not a hex colour: "${h}"`);
  const f = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16));
};

const channel = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG relative contrast. Order independent: lighter over darker, always. */
export const contrastRatio = (a, b) => {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

export function runContrast(cfg) {
  const tokens = cfg.tokens ?? {};
  const roles = cfg.roles ?? [];
  const rows = [];
  const problems = [];

  for (const r of roles) {
    for (const groundName of r.on) {
      const fg = tokens[r.fg];
      const bg = tokens[groundName];
      if (!fg) throw new Error(`Role "${r.role}" uses unknown token "${r.fg}"`);
      if (!bg) throw new Error(`Role "${r.role}" sits on unknown token "${groundName}"`);
      const value = contrastRatio(fg, bg);
      const min = r.min ?? 4.5;
      const ok = value >= min;
      const row = { role: r.role, fg: r.fg, ground: groundName, size: r.size ?? "", value, min, ok };
      rows.push(row);
      if (!ok) problems.push(row);
    }
  }

  return { ok: problems.length === 0, checked: rows.length, roles: roles.length, rows, problems };
}
