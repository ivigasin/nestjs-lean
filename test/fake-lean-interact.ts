import type { LeanInteract } from "../src";

export class FakeConfig {
  constructor(readonly options: unknown) {}
  static async create(options: unknown): Promise<FakeConfig> {
    return new FakeConfig(options);
  }
}

export class FakeServer {
  killed = false;
  readonly requests: unknown[] = [];
  constructor(
    readonly config: FakeConfig,
    readonly options?: unknown,
  ) {}
  async run(request: { cmd?: string }, options?: unknown): Promise<unknown> {
    if (request.cmd === "throw") throw new Error("boom");
    this.requests.push(request);
    return { request, options };
  }
  async kill(): Promise<void> {
    this.killed = true;
  }
}

export class FakeAutoServer extends FakeServer {}

export class FakePool {
  closed = false;
  constructor(
    readonly config: FakeConfig,
    readonly options?: unknown,
  ) {}
  async run(request: unknown): Promise<unknown> {
    return { request };
  }
  async runBatch(requests: unknown[]): Promise<unknown[]> {
    return requests.map((request) => ({ request, pooled: true }));
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

/** A stand-in for the `lean-interact` namespace: enough for LeanModule and LeanService. */
export function fakeLeanInteract(): LeanInteract {
  return {
    LeanREPLConfig: FakeConfig,
    LeanServer: FakeServer,
    AutoLeanServer: FakeAutoServer,
    LeanServerPool: FakePool,
    command: (v: object) => ({ kind: "Command", ...v }),
    fileCommand: (v: object) => ({ kind: "FileCommand", ...v }),
    proofStep: (v: object) => ({ kind: "ProofStep", ...v }),
  } as unknown as LeanInteract;
}
