# nestjs-lean

NestJS module wrapping the ESM-only `lean-interact` package. The library is CommonJS on purpose:
`lean-interact` is loaded through `src/load-lean-interact.ts` (a real `import()` kept by
`module: nodenext`) and injected via the `LEAN_INTERACT` token; never import its values statically
from `src/`, only types. NestJS 12 is ESM-only too and is reached through Node's `require(esm)`.

- `npm test`: unit tests (`test/*.test.ts`) against `test/fake-lean-interact.ts`, no Lean needed
- `npm run test:e2e`: `test/*.e2e.test.ts` against a real REPL (needs `lake` on PATH)
- Tests use `node:test` on `tsc` output (Jest/Vitest struggle with decorator metadata + ESM deps)
