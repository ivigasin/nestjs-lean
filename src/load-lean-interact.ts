import type { LeanInteract } from "./lean.interfaces";

/**
 * `lean-interact` is ESM-only. With `module: nodenext` this stays a real `import()` in the
 * CommonJS output, so it loads from both CommonJS and ESM applications.
 */
export function loadLeanInteract(): Promise<LeanInteract> {
  return import("lean-interact");
}
