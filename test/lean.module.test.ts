import "reflect-metadata";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Injectable, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  LEAN_CONFIG,
  LEAN_INTERACT,
  LeanModule,
  LeanService,
  loadLeanInteract,
  type LeanModuleOptions,
} from "../src";
import {
  FakeAutoServer,
  FakeConfig,
  FakeLeanError,
  FakePool,
  FakeServer,
  fakeLeanInteract,
} from "./fake-lean-interact";

async function compile(imports: unknown[]) {
  const moduleRef = await Test.createTestingModule({ imports: imports as never[] })
    .overrideProvider(LEAN_INTERACT)
    .useValue(fakeLeanInteract())
    .compile();
  return { moduleRef, service: moduleRef.get(LeanService) };
}

describe("LeanModule.forRoot", () => {
  it("creates the config from options and starts an AutoLeanServer lazily", async () => {
    const { moduleRef, service } = await compile([LeanModule.forRoot({ config: { leanVersion: "v4.19.0" } })]);
    const config = moduleRef.get<FakeConfig>(LEAN_CONFIG);
    assert.deepEqual(config.options, { leanVersion: "v4.19.0" });
    assert.equal(service.mode, "auto");
    assert.equal(service.started, false);

    const res = (await service.command("#eval 1")) as unknown as { request: unknown };
    assert.ok(service.server instanceof FakeAutoServer);
    assert.deepEqual(res.request, { kind: "Command", cmd: "#eval 1" });
  });

  it("uses a LeanREPLConfig instance as is", async () => {
    const config = new FakeConfig("mine");
    const { moduleRef } = await compile([LeanModule.forRoot({ config: config as never })]);
    assert.equal(moduleRef.get(LEAN_CONFIG), config);
  });

  it("selects the backend from mode and passes its options", async () => {
    const single = (await compile([LeanModule.forRoot({ mode: "single" })])).service;
    assert.ok(single.server instanceof FakeServer && !(single.server instanceof FakeAutoServer));

    const pool = (await compile([LeanModule.forRoot({ mode: "pool", poolOptions: { numWorkers: 2 } })])).service;
    assert.ok(pool.server instanceof FakePool);
    assert.deepEqual((pool.server as unknown as FakePool).options, { numWorkers: 2 });

    const auto = (await compile([LeanModule.forRoot({ serverOptions: { maxRestartAttempts: 2 } })])).service;
    assert.deepEqual((auto.server as unknown as FakeAutoServer).options, { maxRestartAttempts: 2 });
  });
});

describe("LeanModule.forRootAsync", () => {
  @Injectable()
  class Settings {
    readonly mode = "single" as const;
  }
  @Module({ providers: [Settings], exports: [Settings] })
  class SettingsModule {}

  it("builds options with an injected factory", async () => {
    const { service } = await compile([
      LeanModule.forRootAsync({
        imports: [SettingsModule],
        inject: [Settings],
        useFactory: async (s: Settings): Promise<LeanModuleOptions> => ({ mode: s.mode }),
      }),
    ]);
    assert.equal(service.mode, "single");
  });

  it("registers globally with isGlobal", async () => {
    @Injectable()
    class Consumer {
      constructor(readonly lean: LeanService) {}
    }
    @Module({ providers: [Consumer] })
    class FeatureModule {}

    const { moduleRef } = await compile([LeanModule.forRoot({ isGlobal: true }), FeatureModule]);
    assert.ok(moduleRef.get(Consumer).lean instanceof LeanService);
  });
});

describe("LeanService", () => {
  it("builds file and proof-step requests", async () => {
    const { service } = await compile([LeanModule.forRoot({})]);
    await service.file("A.lean");
    await service.proofStep(3, "rfl");
    assert.deepEqual((service.server as unknown as FakeServer).requests, [
      { kind: "FileCommand", path: "A.lean" },
      { kind: "ProofStep", proofState: 3, tactic: "rfl" },
    ]);
  });

  it("runs a batch sequentially, reporting progress and keeping errors in place", async () => {
    const { service } = await compile([LeanModule.forRoot({})]);
    const progress: string[] = [];
    const results = await service.runBatch([{ cmd: "a" }, { cmd: "throw" }, { cmd: "b" }] as never[], {
      timeoutPerCmd: 50,
      onProgress: (done, total) => progress.push(`${done}/${total}`),
    });
    assert.deepEqual(progress, ["1/3", "2/3", "3/3"]);
    assert.ok(results[1] instanceof Error);
    assert.deepEqual((results[2] as unknown as { options: unknown }).options, { verbose: undefined, timeout: 50 });
  });

  it("tells LeanError results apart and narrows their type", async () => {
    const { service } = await compile([LeanModule.forRoot({})]);
    const failed: unknown = new FakeLeanError("unknown environment");
    assert.equal(service.isError(failed), true);
    if (service.isError(failed)) assert.equal(failed.message, "unknown environment");
    assert.equal(service.isError(await service.command("#eval 1")), false);
    assert.equal(service.isError(null), false);
  });

  it("delegates batches to the pool", async () => {
    const { service } = await compile([LeanModule.forRoot({ mode: "pool" })]);
    const results = await service.runBatch([{ cmd: "a" }] as never[]);
    assert.deepEqual(results, [{ request: { cmd: "a" }, pooled: true }]);
  });

  it("kills the server on application shutdown", async () => {
    const { moduleRef, service } = await compile([LeanModule.forRoot({})]);
    const server = service.server as unknown as FakeServer;
    await moduleRef.close();
    assert.equal(server.killed, true);
    assert.equal(service.started, false);
  });

  it("closes the pool on application shutdown", async () => {
    const { moduleRef, service } = await compile([LeanModule.forRoot({ mode: "pool" })]);
    const pool = service.server as unknown as FakePool;
    await moduleRef.close();
    assert.equal(pool.closed, true);
  });

  it("loads the real, ESM-only lean-interact from CommonJS", async () => {
    const lean = await loadLeanInteract();
    assert.equal(typeof lean.LeanREPLConfig.create, "function");
    assert.equal(typeof lean.AutoLeanServer, "function");
  });
});
