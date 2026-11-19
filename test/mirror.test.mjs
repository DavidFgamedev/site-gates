import { test } from "node:test";
import assert from "node:assert/strict";
import { runMirror } from "../src/mirror.mjs";

const pair = (dir) => ({
  pairs: [{
    name: "titles",
    source: { file: `test/fixtures/mirror/${dir}/source.js`, pattern: 'title: "([^"]+)"' },
    mirror: { file: `test/fixtures/mirror/${dir}/mirror.js`, pattern: '"([^"]+)"', between: ["const KNOWN = [", "];"] },
  }],
});

test("passing fixture: every source name present in the mirror", () => {
  const r = runMirror(pair("pass"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.pairs[0].missing, []);
  assert.deepEqual(r.pairs[0].source, ["Alpha", "Beta"]);
});

test("an extra name in the mirror is a note, not a failure", () => {
  // A mirror legitimately covers things the source does not list.
  const r = runMirror(pair("pass"));
  assert.equal(r.ok, true);
  assert.deepEqual(r.pairs[0].extra, ["Legacy"]);
});

test("failing fixture: a source name missing from the mirror fails", () => {
  const r = runMirror(pair("fail"));
  assert.equal(r.ok, false);
  assert.deepEqual(r.pairs[0].missing, ["Gamma"]);
});

test("the `between` window stops an unrelated string satisfying the check", () => {
  // Point the mirror at a window that does not contain the names.
  const r = runMirror({
    pairs: [{
      name: "titles",
      source: { file: "test/fixtures/mirror/pass/source.js", pattern: 'title: "([^"]+)"' },
      mirror: { file: "test/fixtures/mirror/pass/mirror.js", pattern: '"([^"]+)"', between: ["const ABSENT = [", "];"] },
    }],
  });
  assert.equal(r.ok, false);
  assert.match(r.pairs[0].error, /has no/);
});

test("extraction reads text, so a source that cannot be imported still works", () => {
  // source.js uses ESM export syntax and is never evaluated; it is read as text.
  assert.equal(runMirror(pair("pass")).pairs[0].source.length, 2);
});
