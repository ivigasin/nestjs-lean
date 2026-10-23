import { ConfigurableModuleBuilder } from "@nestjs/common";
import type { LeanModuleOptions } from "./lean.interfaces";

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: LEAN_MODULE_OPTIONS,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<LeanModuleOptions>()
  .setClassMethodName("forRoot")
  .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
  .build();
