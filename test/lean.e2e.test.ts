import "reflect-metadata";
import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { Test, type TestingModule } from "@nestjs/testing";
import { LeanModule, LeanService } from "../src";

// Real Lean: needs `lake` on PATH. The first run fetches and builds the REPL (minutes).
const SETUP_TIMEOUT = 30 * 60_000;
// AutoLeanServer restarts at 80% system memory by default; a busy dev machine sits there already.
const maxTotalMemory = 0.99;

for (const mode of ["auto", "single", "pool"] as const) {
  describe(`LeanService end to end (${mode})`, { timeout: SETUP_TIMEOUT }, () => {
    let moduleRef: TestingModule;
    let lean: LeanService;

    before(async () => {
      moduleRef = await Test.createTestingModule({
        imports: [
          LeanModule.forRoot({
            mode,
            config: { verbose: true },
            serverOptions: { maxTotalMemory },
            poolOptions: { numWorkers: 2, maxTotalMemory },
          }),
        ],
      }).compile();
      moduleRef.enableShutdownHooks();
      await moduleRef.init();
      lean = moduleRef.get(LeanService);
    });

    after(async () => {
      await moduleRef?.close();
    });

    it("runs a Lean command", async () => {
      const res = await lean.command("theorem ex (n : Nat) : n = 5 → n = 5 := id");
      assert.equal(res.constructor.name, "CommandResponse", JSON.stringify(res));
      assert.equal((res as { hasErrors(): boolean }).hasErrors(), false);
    });

    it("reports Lean errors as messages", async () => {
      const res = await lean.command("theorem bad : 1 = 2 := rfl");
      assert.equal(res.constructor.name, "CommandResponse", JSON.stringify(res));
      assert.equal((res as { hasErrors(): boolean }).hasErrors(), true);
    });

    if (mode !== "pool") {
      it("closes a sorry with a proof step", async () => {
        const thm = await lean.command("theorem t (x : Nat) : x = x := sorry");
        assert.equal(thm.constructor.name, "CommandResponse");
        const proofState = (thm as { sorries: Array<{ proofState?: number }> }).sorries[0].proofState!;
        const step = await lean.proofStep(proofState, "rfl");
        assert.equal((step as { proofStatus?: string }).proofStatus, "Completed");
      });
    }

    it("runs a batch", async () => {
      const results = await lean.runBatch([
        { cmd: "#eval 1 + 1" },
        { cmd: "example : 2 + 2 = 4 := rfl" },
      ] as never[]);
      assert.deepEqual(
        results.map((r) => r.constructor.name),
        ["CommandResponse", "CommandResponse"],
      );
    });

    it("kills the REPL when the app shuts down", async () => {
      const server = lean.server as { pid?: number };
      const pid = mode === "pool" ? undefined : server.pid;
      await moduleRef.close();
      assert.equal(lean.started, false);
      if (pid !== undefined) assert.throws(() => process.kill(pid, 0));
    });
  });
}
