import type * as LeanInteractModule from "lean-interact";
import type {
  AutoLeanServerOptions,
  LeanREPLConfig,
  LeanREPLConfigOptions,
  LeanServerPoolOptions,
} from "lean-interact";

/** The `lean-interact` module namespace. */
export type LeanInteract = typeof LeanInteractModule;

/**
 * Which server backs {@link LeanService}:
 * - `"auto"`: one `AutoLeanServer` (restarts on memory pressure, timeouts and crashes)
 * - `"single"`: one plain `LeanServer`
 * - `"pool"`: a `LeanServerPool` of `AutoLeanServer` workers
 */
export type LeanServerMode = "auto" | "single" | "pool";

export interface LeanModuleOptions {
  /**
   * Options for `LeanREPLConfig.create()`, or a config you created yourself. The REPL is fetched
   * and built while the module initializes, which can take minutes the first time.
   */
  config?: LeanREPLConfigOptions | LeanREPLConfig;
  /** Default `"auto"`. */
  mode?: LeanServerMode;
  /** Options for the `AutoLeanServer` in `"auto"` mode. */
  serverOptions?: AutoLeanServerOptions;
  /** Options for the `LeanServerPool` in `"pool"` mode. */
  poolOptions?: LeanServerPoolOptions;
}
