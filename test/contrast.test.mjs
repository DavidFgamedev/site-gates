import { test } from "node:test";
import assert from "node:assert/strict";
import { runContrast, contrastRatio, luminance } from "../src/contrast.mjs";

const TOKENS = {
  paper: "#ffffff",
  paperAlt: "#f2f2f2",
  ink: "#1a1a1a",
  faint: "#9a9a9a",
};

test("ratio maths: black on white is 21:1, the WCAG maximum", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("ratio maths: a colour against itself is 1:1", () => {
  assert.equal(Math.round(contrastRatio("#4e7a6c", "#4e7a6c")), 1);
});

test("ratio is order independent", () => {
  assert.equal(contrastRatio("#1a1a1a", "#ffffff"), contrastRatio("#ffffff", "#1a1a1a"));
});

test("luminance is monotonic from black to white", () => {
  assert.ok(luminance("#000000") < luminance("#808080"));
  assert.ok(luminance("#808080") < luminance("#ffffff"));
});

test("three-digit hex is expanded, not rejected", () => {
  assert.equal(contrastRatio("#000", "#fff"), contrastRatio("#000000", "#ffffff"));
});

test("passing fixture: roles above threshold report ok", () => {
  const r = runContrast({
    tokens: TOKENS,
    roles: [{ role: "body", fg: "ink", on: ["paper", "paperAlt"], min: 4.5, size: "16px" }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.checked, 2, "one role on two grounds is two measurements");
  assert.equal(r.problems.length, 0);
});

test("failing fixture: a role below threshold is caught", () => {
  const r = runContrast({
    tokens: TOKENS,
    roles: [{ role: "faint caption", fg: "faint", on: ["paper"], min: 4.5, size: "13px" }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.problems.length, 1);
  assert.equal(r.problems[0].role, "faint caption");
  assert.ok(r.problems[0].value < 4.5);
});

test("a role passing on one ground and failing on another is caught", () => {
  // The case this gate exists for, with measured values: #767676 is 4.54 on white and
  // 4.06 on #f2f2f2. It passes on its usual surface and fails the moment the same role
  // lands on a slightly darker one.
  const r = runContrast({
    tokens: { paper: "#ffffff", paperAlt: "#f2f2f2", mid: "#767676" },
    roles: [{ role: "meta", fg: "mid", on: ["paper", "paperAlt"], min: 4.5, size: "14px" }],
  });
  assert.equal(r.ok, false);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows.filter((x) => x.ok).length, 1, "exactly one ground should pass");
  assert.equal(r.rows.filter((x) => !x.ok).length, 1, "and exactly one should fail");
});

test("the large-text threshold of 3 is honoured separately from 4.5", () => {
  // #8a8a8a on #f2f2f2 measures 3.08: clears 3:1 as large text, fails 4.5:1 as normal.
  const roles = [{ role: "heading", fg: "mid", on: ["paperAlt"], min: 3, size: "32px" }];
  const tokens = { paperAlt: "#f2f2f2", mid: "#8a8a8a" };
  const large = runContrast({ tokens, roles });
  const normal = runContrast({ tokens, roles: [{ ...roles[0], min: 4.5, size: "14px" }] });
  assert.equal(large.ok, true, "clears 3:1 as large text");
  assert.equal(normal.ok, false, "same pair fails 4.5:1 as normal text");
});

test("an unknown token is an error, not a silent pass", () => {
  assert.throws(
    () => runContrast({ tokens: TOKENS, roles: [{ role: "x", fg: "nope", on: ["paper"], min: 4.5 }] }),
    /unknown token/,
  );
});
