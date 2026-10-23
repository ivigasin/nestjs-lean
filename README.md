# nestjs-lean

A [NestJS](https://nestjs.com) module for the [Lean 4](https://lean-lang.org) theorem prover, built
on [lean-interact](https://www.npmjs.com/package/lean-interact). Inject `LeanService` and run Lean
commands, files and tactics from your providers and controllers.

- `LeanModule.forRoot()` / `forRootAsync()`, optionally global
- Backed by an `AutoLeanServer` (restarts on memory pressure, timeouts and crashes), a plain
  `LeanServer`, or a `LeanServerPool`
- The REPL is fetched and built while the module initializes; the server starts on the first request
  and is killed on application shutdown
- Works in CommonJS and ESM Nest apps, NestJS 11 and 12. Node.js >= 20.19

## Install

```bash
npm install nestjs-lean lean-interact
```

You also need `git` and Lean's version manager [elan](https://github.com/leanprover/elan)
(`lake` on your `PATH`):

```bash
npx lean-interact install-lean
```

## Usage

```ts
import { Module } from "@nestjs/common";
import { LeanModule } from "nestjs-lean";

@Module({
  imports: [LeanModule.forRoot({ config: { leanVersion: "v4.19.0" }, isGlobal: true })],
})
export class AppModule {}
```

```ts
import { Injectable } from "@nestjs/common";
import { LeanService } from "nestjs-lean";

@Injectable()
export class ProofService {
  constructor(private readonly lean: LeanService) {}

  async check(code: string) {
    const res = await this.lean.command(code);
    if (!("env" in res)) throw new Error(res.message); // LeanError: the REPL failed
    return { valid: !res.hasErrors(), messages: res.messages, env: res.env };
  }
}
```

Results are returned exactly as `lean-interact` gives them (`CommandResponse`,
`ProofStepResponse` or `LeanError`), so its helpers (`getErrors()`, `hasErrors()`,
`leanCodeIsValid()`, InfoTrees...) all work.

### LeanService

| Member | |
| --- | --- |
| `command(cmd \| { cmd, env, allTactics, ... }, options?)` | Run Lean code |
| `file(path \| { path, ... }, options?)` | Run a Lean file |
| `proofStep(proofState, tactic, options?)` | Apply a tactic |
| `run(request, options?)` | Run any `lean-interact` request |
| `runBatch(requests, { timeoutPerCmd, onProgress }?)` | Parallel in pool mode, sequential otherwise; a request that throws yields its `Error` |
| `server` | The underlying `AutoLeanServer` / `LeanServer` / `LeanServerPool` (started on access) |
| `config` | The `LeanREPLConfig` |
| `close()` | Kill the REPL(s); the next request starts a new server |

`options` are `lean-interact` run options: `timeout` (ms), `signal`, `verbose`, and
`addToSessionCache` in `"auto"` mode.

### Options

```ts
LeanModule.forRoot({
  config: { leanVersion: "v4.19.0" }, // LeanREPLConfig.create() options, or a LeanREPLConfig
  mode: "auto",                       // "auto" | "single" | "pool"
  serverOptions: { maxTotalMemory: 0.8, maxRestartAttempts: 5 }, // "auto" mode
  poolOptions: { numWorkers: 4 },     // "pool" mode
  isGlobal: true,
});
```

### Async configuration and projects

`lean-interact` is ESM-only. `nestjs-lean` loads it with a dynamic `import()` and exposes the
module under the `LEAN_INTERACT` token; in an async factory you can also use `loadLeanInteract()`,
for example to build a project with Mathlib:

```ts
import { ConfigModule, ConfigService } from "@nestjs/config";
import { LeanModule, loadLeanInteract } from "nestjs-lean";

LeanModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: async (cfg: ConfigService) => {
    const { TempRequireProject } = await loadLeanInteract();
    const project = await TempRequireProject.create({ leanVersion: "v4.19.0", require: "mathlib" });
    return { config: { project }, mode: cfg.get("LEAN_MODE") ?? "auto" };
  },
});
```

Types can be imported normally (`import type { CommandResponse } from "lean-interact"`).

### Shutdown

The REPL processes are killed in `onApplicationShutdown`. Call `app.enableShutdownHooks()` so this
also happens on `SIGTERM`/`SIGINT`.

## Development

```bash
npm test          # unit tests with a fake lean-interact
npm run test:e2e  # real Lean in "auto", "single" and "pool" modes (first run builds the REPL)
npm run build
```

## License

MIT
