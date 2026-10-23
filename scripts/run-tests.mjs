// Runs the compiled tests. `node --test` only expands globs from Node 21, so this lists the files.
//   node scripts/run-tests.mjs          unit tests (fake lean-interact, no Lean needed)
//   node scripts/run-tests.mjs --e2e    end-to-end tests against a real Lean REPL
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const dir = "build-test/test";
const e2e = process.argv.includes("--e2e");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".test.js") && f.endsWith(".e2e.test.js") === e2e)
  .map((f) => `${dir}/${f}`);

const res = spawnSync(process.execPath, ["--test", "--test-concurrency=1", ...files], { stdio: "inherit" });
process.exit(res.status ?? 1);
