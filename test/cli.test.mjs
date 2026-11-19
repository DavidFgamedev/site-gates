import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

/**
 * End to end, through the actual CLI.
 *
 * The unit tests above prove each gate detects what it claims. These prove the exit code
 * reaches the shell, which is the only thing CI reads. A gate that finds a problem and
 * still exits 0 is indistinguishable from a clean run.
 */
const run = (gate, cfg) =>
  spawnSync("node", ["bin/site-gates.mjs", gate, "--config", `test/fixtures/configs/${cfg}.json`], {
    encoding: "utf8",
  });

for (const gate of ["vocabulary", "contrast", "mirror"]) {
  test(`${gate}: exits 0 on the passing fixture`, () => {
    const r = run(gate, "pass");
    assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  });

  test(`${gate}: exits 1 on the failing fixture`, () => {
    const r = run(gate, "fail");
    assert.equal(r.status, 1, `expected failure, got ${r.status}\n${r.stdout}`);
  });

  test(`${gate}: failure explains itself on stderr`, () => {
    const r = run(gate, "fail");
    assert.ok((r.stderr + r.stdout).trim().length > 0, "a failing gate must say why");
  });
}

test("a missing config exits 2, distinct from a gate failure", () => {
  const r = spawnSync("node", ["bin/site-gates.mjs", "vocabulary", "--config", "nope.json"], { encoding: "utf8" });
  assert.equal(r.status, 2, "config errors must not look like a clean pass or a gate failure");
  assert.match(r.stderr, /No config at/);
});

test("an unknown gate name exits 2 rather than silently doing nothing", () => {
  const r = spawnSync("node", ["bin/site-gates.mjs", "nonsense"], { encoding: "utf8" });
  assert.equal(r.status, 2);
});
