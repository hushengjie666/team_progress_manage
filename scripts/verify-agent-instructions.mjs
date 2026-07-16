import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const codeGraphStart = "<!-- CODEGRAPH_START -->";
const codeGraphEnd = "<!-- CODEGRAPH_END -->";
const repositoryPathPrefixes = ["src/", "src-tauri/", "team-server/", "tests/", "scripts/", "docs/"];
const generatedPathPrefixes = [
  "deploy/",
  "dist/",
  "playwright-report/",
  "src-tauri/target/",
  "team-server/data/",
  "test-results/",
];

const occurrences = (source, value) => source.split(value).length - 1;

const documentedNpmScripts = (source) => {
  const scripts = new Set([...source.matchAll(/\bnpm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1]));
  if (/\bnpm test\b/.test(source)) scripts.add("test");
  return [...scripts].sort();
};

const documentedRepositoryPaths = (source) => [...new Set([...source.matchAll(/`([^`\n]+)`/g)]
  .map((match) => match[1])
  .filter((value) => value === "README.md" || repositoryPathPrefixes.some((prefix) => value.startsWith(prefix)))
  .filter((value) => !generatedPathPrefixes.some((prefix) => value.startsWith(prefix)))
  .filter((value) => !/[<>*]/.test(value)))]
  .sort();

export const validateAgentInstructions = ({ source, packageScripts, pathExists }) => {
  const failures = [];
  const startCount = occurrences(source, codeGraphStart);
  const endCount = occurrences(source, codeGraphEnd);

  if (startCount !== 1 || endCount !== 1) {
    failures.push(`CodeGraph markers must appear exactly once (start: ${startCount}, end: ${endCount})`);
  } else if (source.indexOf(codeGraphStart) > source.indexOf(codeGraphEnd)) {
    failures.push("CodeGraph markers are out of order");
  }

  for (const script of documentedNpmScripts(source)) {
    if (!Object.hasOwn(packageScripts, script)) failures.push(`missing npm script: ${script}`);
  }

  for (const path of documentedRepositoryPaths(source)) {
    if (!pathExists(path)) failures.push(`missing repository path: ${path}`);
  }

  return failures;
};

const main = () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const source = readFileSync(resolve(root, "AGENTS.md"), "utf8");
  const packageScripts = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).scripts ?? {};
  const failures = validateAgentInstructions({
    source,
    packageScripts,
    pathExists: (path) => existsSync(resolve(root, path)),
  });

  if (failures.length > 0) {
    console.error(`Agent instructions verification failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
    process.exit(1);
  }

  console.log("Agent instructions verification passed.");
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
