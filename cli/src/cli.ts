#!/usr/bin/env node
import { createCliProgram } from "./program.js";

createCliProgram().parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
