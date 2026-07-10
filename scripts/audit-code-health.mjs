import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const scanRoots = [
  "src",
  "team-server",
  "cli/src",
  "tests/e2e",
];

const ignoredDirectories = new Set([
  ".git",
  ".codegraph",
  "node_modules",
  "dist",
  "target",
  "bin",
  "coverage",
  "deploy",
  "playwright-report",
  "test-results",
]);

const checkedExtensions = new Set([".ts", ".tsx", ".go", ".css", ".mjs"]);

const staleCodePattern = /\b(?:legacy|deprecated)\b|\bcompat(?:ible|ibility)?\b|兼容|旧|临时|以后删除/i;
const unfinishedPattern = /\b(?:TODO|FIXME)\b/;
const oldBusinessDataPatterns = [
  "Sy" + "nc" + "State",
  "sy" + "nc" + "-server",
  "timemanage" + "-sy" + "nc",
  "TM_" + "SY" + "NC",
  "business" + "-changes",
  "business" + "-state",
  "tomb" + "stone",
  "last" + "SyncedAt",
  "lastPulled" + "Revi" + "sion",
  "deleted" + "_at",
  "state" + "\\." + "sy" + "nc",
  "同" + "步",
];
const oldBusinessDataPattern = new RegExp(`(?:${oldBusinessDataPatterns.join("|")})`, "i");

const isTestFile = (relativePath) =>
  relativePath.startsWith("tests/") ||
  /\.(test|spec)\.(ts|tsx)$/.test(relativePath) ||
  /_test\.go$/.test(relativePath);

const isRiskAllowed = (relativePath, line, rule) => {
  if (rule === "stale-code" && isTestFile(relativePath)) return true;
  if (rule === "stale-code" && /^src\/demoData/.test(relativePath)) return true;
  if (rule === "stale-code" && line.includes("版本不兼容")) return true;
  return false;
};

const thresholdsFor = (relativePath) => {
  if (relativePath.endsWith(".css")) {
    return { warning: 500, failure: 1000, kind: "style" };
  }
  if (isTestFile(relativePath)) {
    return { warning: 300, failure: 500, kind: "test" };
  }
  return { warning: 300, failure: 500, kind: "source" };
};

const collectFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];

  const files = [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectFiles(fullPath));
      }
      continue;
    }
    if (entry.isFile() && checkedExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
};

const lineCountFor = (content) => (content.length === 0 ? 0 : content.split(/\r\n|\n|\r/).length);

const formatFinding = (finding) => {
  const location = finding.line ? `${finding.path}:${finding.line}` : finding.path;
  return `${location} - ${finding.message}`;
};

const allFiles = scanRoots.flatMap((root) => collectFiles(path.join(repoRoot, root)));
const failures = [];
const warnings = [];

for (const file of allFiles) {
  const relativePath = path.relative(repoRoot, file).split(path.sep).join("/");
  const content = fs.readFileSync(file, "utf8");
  const lineCount = lineCountFor(content);
  const thresholds = thresholdsFor(relativePath);

  if (lineCount > thresholds.failure) {
    failures.push({
      path: relativePath,
      message: `${thresholds.kind} file has ${lineCount} lines; split before exceeding ${thresholds.failure}`,
    });
  } else if (lineCount > thresholds.warning) {
    warnings.push({
      path: relativePath,
      message: `${thresholds.kind} file has ${lineCount} lines; consider splitting before ${thresholds.failure}`,
    });
  }

  content.split(/\r\n|\n|\r/).forEach((line, index) => {
    if (unfinishedPattern.test(line) && !isRiskAllowed(relativePath, line, "unfinished")) {
      failures.push({
        path: relativePath,
        line: index + 1,
        message: "unfinished marker found; resolve it or document it outside code",
      });
    }
    if (staleCodePattern.test(line) && !isRiskAllowed(relativePath, line, "stale-code")) {
      failures.push({
        path: relativePath,
        line: index + 1,
        message: "stale-code marker found; delete it or add a narrow allowlist with a reason",
      });
    }
    if (oldBusinessDataPattern.test(line) && !isRiskAllowed(relativePath, line, "old-business-data")) {
      failures.push({
        path: relativePath,
        line: index + 1,
        message: "old business data marker found; use direct team backend API concepts instead",
      });
    }
  });
}

if (warnings.length > 0) {
  console.warn("Code health warnings:");
  warnings.forEach((warning) => console.warn(`  ${formatFinding(warning)}`));
}

if (failures.length > 0) {
  console.error("Code health check failed:");
  failures.forEach((failure) => console.error(`  ${formatFinding(failure)}`));
  process.exit(1);
}

console.log(`Code health check passed: ${allFiles.length} files scanned.`);
