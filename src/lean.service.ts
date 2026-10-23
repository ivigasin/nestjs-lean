import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type {
  AutoLeanServer,
  AutoRunOptions,
  Command,
  CommandLikeRequest,
  CommandResponse,
  FileCommand,
  LeanError,
  LeanREPLConfig,
  LeanServer,
  LeanServerPool,
  ProofStepLikeRequest,
  ProofStepResponse,
  REPLRequest,
  REPLResponse,
  REQUEST_KIND,
  RunBatchOptions,
} from "lean-interact";
import { LEAN_CONFIG, LEAN_INTERACT } from "./lean.constants";
import type { LeanInteract, LeanModuleOptions, LeanServerMode } from "./lean.interfaces";
import { LEAN_MODULE_OPTIONS } from "./lean.module-definition";

export type LeanBackend = LeanServer | AutoLeanServer | LeanServerPool;

type CommandFields = Omit<Command, typeof REQUEST_KIND>;
type FileFields = Omit<FileCommand, typeof REQUEST_KIND>;

/**
 * Runs requests on a Lean REPL. The server (or pool) starts on the first request and is killed
 * on application shutdown. Results are returned exactly as `lean-interact` gives them: a response
 * or a `LeanError`.
 */
@Injectable()
export class LeanService implements OnApplicationShutdown {
  private backend: LeanBackend | null = null;

  constructor(
    @Inject(LEAN_MODULE_OPTIONS) private readonly options: LeanModuleOptions,
    @Inject(LEAN_INTERACT) private readonly lean: LeanInteract,
    @Inject(LEAN_CONFIG) readonly config: LeanREPLConfig,
  ) {}

  get mode(): LeanServerMode {
    return this.options.mode ?? "auto";
  }

  /** Whether the server (or pool) has been started. */
  get started(): boolean {
    return this.backend !== null;
  }

  /** The underlying server or pool, started on first access. */
  get server(): LeanBackend {
    if (!this.backend) {
      const { LeanServer, AutoLeanServer, LeanServerPool } = this.lean;
      switch (this.mode) {
        case "single":
          this.backend = new LeanServer(this.config);
          break;
        case "pool":
          this.backend = new LeanServerPool(this.config, this.options.poolOptions);
          break;
        default:
          this.backend = new AutoLeanServer(this.config, this.options.serverOptions);
      }
    }
    return this.backend;
  }

  /** Run any request. `addToSessionCache` is honoured in `"auto"` mode only. */
  run(request: CommandLikeRequest, options?: AutoRunOptions): Promise<CommandResponse | LeanError>;
  run(request: ProofStepLikeRequest, options?: AutoRunOptions): Promise<ProofStepResponse | LeanError>;
  run(request: REPLRequest, options?: AutoRunOptions): Promise<REPLResponse | LeanError>;
  run(request: REPLRequest, options: AutoRunOptions = {}): Promise<REPLResponse | LeanError> {
    return this.server.run(request, options);
  }

  /** Run Lean code: `command("#eval 1")` or `command({ cmd, env, allTactics, ... })`. */
  command(cmd: string | CommandFields, options?: AutoRunOptions): Promise<CommandResponse | LeanError> {
    return this.run(this.lean.command(typeof cmd === "string" ? { cmd } : cmd), options);
  }

  /** Run a Lean file. */
  file(path: string | FileFields, options?: AutoRunOptions): Promise<CommandResponse | LeanError> {
    return this.run(this.lean.fileCommand(typeof path === "string" ? { path } : path), options);
  }

  /** Apply a tactic to a proof state. */
  proofStep(proofState: number, tactic: string, options?: AutoRunOptions): Promise<ProofStepResponse | LeanError> {
    return this.run(this.lean.proofStep({ proofState, tactic }), options);
  }

  /**
   * Run several requests: in parallel in `"pool"` mode, one after another otherwise. A request
   * that throws yields its `Error` in place of a result.
   */
  async runBatch(
    requests: REPLRequest[],
    options: RunBatchOptions = {},
  ): Promise<Array<REPLResponse | LeanError | Error>> {
    const server = this.server;
    if (server instanceof this.lean.LeanServerPool) return server.runBatch(requests, options);
    const results: Array<REPLResponse | LeanError | Error> = [];
    for (const request of requests) {
      try {
        results.push(await server.run(request, { verbose: options.verbose, timeout: options.timeoutPerCmd }));
      } catch (err) {
        results.push(err instanceof Error ? err : new Error(String(err)));
      }
      options.onProgress?.(results.length, requests.length);
    }
    return results;
  }

  /** Kill the REPL process(es). The next request starts a new server. */
  async close(): Promise<void> {
    const backend = this.backend;
    this.backend = null;
    if (!backend) return;
    if (backend instanceof this.lean.LeanServerPool) await backend.close();
    else await backend.kill();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.close();
  }
}
