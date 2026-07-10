import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const trackedFiles = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((path) => !path.startsWith(".git/"));

const retiredProtocol = String.fromCharCode(109, 99, 112);
const forbidden = [
  `${retiredProtocol}-server`,
  `timemanage-${retiredProtocol}`,
  `TM_${retiredProtocol.toUpperCase()}`,
  ["TimeManage", "Mcp"].join(""),
  ["@modelcontextprotocol", "/sdk"].join(""),
  `TimeManage ${retiredProtocol.toUpperCase()}`,
];
const findings = [];

for (const path of trackedFiles) {
  let content;
  try {
    content = readFileSync(resolve(repoRoot, path), "utf8");
  } catch {
    continue;
  }
  for (const token of forbidden) {
    if (path.toLowerCase().includes(token.toLowerCase()) || content.toLowerCase().includes(token.toLowerCase())) {
      findings.push(`${path}: contains retired CLI architecture token`);
      break;
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join("\n"));
  process.exit(1);
}

console.log(`CLI architecture check passed: ${trackedFiles.length} tracked files scanned.`);
