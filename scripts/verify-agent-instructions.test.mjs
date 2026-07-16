import assert from "node:assert/strict";
import test from "node:test";

import { validateAgentInstructions } from "./verify-agent-instructions.mjs";

const source = `
<!-- CODEGRAPH_START -->
<!-- CODEGRAPH_END -->

Use \`src/example.ts\`, \`README.md\`, and npm run build. Run npm test too.
`;

test("accepts valid markers, scripts, and repository paths", () => {
  const failures = validateAgentInstructions({
    source,
    packageScripts: { build: "vite build", test: "vitest run" },
    pathExists: (path) => ["src/example.ts", "README.md"].includes(path),
  });

  assert.deepEqual(failures, []);
});

test("reports missing scripts and repository paths", () => {
  const failures = validateAgentInstructions({
    source: `${source}\nUse \`src/example.ts\` again.`,
    packageScripts: { test: "vitest run" },
    pathExists: (path) => path === "README.md",
  });

  assert.deepEqual(failures, [
    "missing npm script: build",
    "missing repository path: src/example.ts",
  ]);
});

test("reports duplicated or misordered CodeGraph markers", () => {
  const duplicateFailures = validateAgentInstructions({
    source: `${source}\n<!-- CODEGRAPH_START -->`,
    packageScripts: { build: "vite build", test: "vitest run" },
    pathExists: () => true,
  });
  const orderFailures = validateAgentInstructions({
    source: "<!-- CODEGRAPH_END -->\n<!-- CODEGRAPH_START -->",
    packageScripts: {},
    pathExists: () => true,
  });

  assert.match(duplicateFailures[0], /must appear exactly once/);
  assert.equal(orderFailures[0], "CodeGraph markers are out of order");
});

test("ignores generated, runtime, wildcard, and placeholder paths", () => {
  const failures = validateAgentInstructions({
    source: `
<!-- CODEGRAPH_START -->
<!-- CODEGRAPH_END -->
\`deploy/output.zip\` \`dist/index.html\` \`team-server/data/store.json\`
\`src/*.test.ts\` \`team-server/migrations/<version>.sql\`
`,
    packageScripts: {},
    pathExists: () => false,
  });

  assert.deepEqual(failures, []);
});
