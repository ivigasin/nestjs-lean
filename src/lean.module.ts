import { Module } from "@nestjs/common";
import type { LeanREPLConfig } from "lean-interact";
import { LEAN_CONFIG, LEAN_INTERACT } from "./lean.constants";
import type { LeanInteract, LeanModuleOptions } from "./lean.interfaces";
import { ConfigurableModuleClass, LEAN_MODULE_OPTIONS } from "./lean.module-definition";
import { LeanService } from "./lean.service";
import { loadLeanInteract } from "./load-lean-interact";

/**
 * Provides {@link LeanService}. Register it with `LeanModule.forRoot({...})` or
 * `LeanModule.forRootAsync({ useFactory, inject })`; pass `isGlobal: true` to share it app-wide.
 */
@Module({
  providers: [
    { provide: LEAN_INTERACT, useFactory: loadLeanInteract },
    {
      provide: LEAN_CONFIG,
      inject: [LEAN_MODULE_OPTIONS, LEAN_INTERACT],
      useFactory: async (options: LeanModuleOptions, lean: LeanInteract): Promise<LeanREPLConfig> =>
        options.config instanceof lean.LeanREPLConfig ? options.config : lean.LeanREPLConfig.create(options.config),
    },
    LeanService,
  ],
  exports: [LeanService, LEAN_INTERACT, LEAN_CONFIG],
})
export class LeanModule extends ConfigurableModuleClass {}
