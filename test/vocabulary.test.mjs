import { test } from "node:test";
import assert from "node:assert/strict";
import { runVocabulary, stripAllowed } from "../src/vocabulary.mjs";

const CFG = {
  roots: [],
  textExtensions: [".html", ".js", ".txt"],
  hard: ["projectbluebird", "lorem ipsum", "skunkworks"],
  soft: ["\\btodo\\b", "\\btemp\\b"],
  allow: ["template", "temperature"],
};
const on = (dir) => runVocabulary({ ...CFG, roots: [`test/fixtures/vocabulary/${dir}`] });

test("passing fixture: a clean build reports ok", () => {
  const r = on("pass");
  assert.equal(r.ok, true, `expected clean, got: ${JSON.stringify(r.problems)}`);
  assert.equal(r.problems.length, 0);
  assert.ok(r.swept >= 2, "should actually have swept files, not silently zero");
});

test("passing fixture: swept more than zero files (a gate that reads nothing always passes)", () => {
  assert.ok(on("pass").swept > 0);
});

test("allowlist suppresses a soft term in innocent context", () => {
  // The clean fixture contains "template" and "temperature", both matching \btemp\b.
  assert.equal(on("pass").problems.filter((p) => p.where === "CONTENT (soft)").length, 0);
});

test("bracketed region exempts text that must name the banned words", () => {
  // rules.js names two hard terms inside sweep:allow markers and must not fail.
  assert.equal(on("pass").problems.filter((p) => p.file.endsWith("rules.js") && p.where === "CONTENT").length, 0);
});

test("failing fixture: a hard term in a file BODY is caught", () => {
  const r = on("fail");
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.where === "CONTENT" && p.term === "lorem ipsum"));
});

test("failing fixture: a hard term in a file NAME is caught, with an innocent body", () => {
  // This is the case a body-only grep passes. The file's content is clean.
  const hit = on("fail").problems.find((p) => p.where === "FILENAME");
  assert.ok(hit, "a banned term in the path itself must fail");
  assert.match(hit.file, /projectbluebird/);
});

test("failing fixture: a soft term outside the allowlist is caught", () => {
  assert.ok(on("fail").problems.some((p) => p.where === "CONTENT (soft)" && p.term === "\\btodo\\b"));
});

test("an unterminated allow marker is reported, not silently honoured", () => {
  assert.ok(on("fail").problems.some((p) => p.where === "MARKER"));
});

test("an unterminated allow marker does NOT widen into an exemption", () => {
  // "skunkworks" sits after the unclosed marker. It must still be found: a missing end
  // marker should cost coverage of nothing.
  const r = on("fail");
  assert.ok(
    r.problems.some((p) => p.term === "skunkworks" && p.where === "CONTENT"),
    "content after an unclosed marker must still be swept",
  );
});

test("stripAllowed keeps offsets stable so reported context stays accurate", () => {
  const body = "aaa sweep:allow-start SECRET sweep:allow-end bbb";
  const out = stripAllowed(body, "x.js", []);
  assert.equal(out.length, body.length, "blanked region must preserve length");
  assert.ok(!out.includes("SECRET"));
  assert.ok(out.startsWith("aaa ") && out.endsWith(" bbb"));
});

test("a term is matched case-insensitively", () => {
  // The failing fixture writes "Lorem ipsum" capitalised; the rule is lowercase.
  assert.ok(on("fail").problems.some((p) => p.term === "lorem ipsum"));
});
