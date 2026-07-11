import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const metadata = join(root, "app-store", "metadata", "zh-Hans");
const read = (name) => readFileSync(join(metadata, name), "utf8").trim();
const limits = {
  "name.txt": 30,
  "subtitle.txt": 30,
  "description.txt": 4000,
  "release_notes.txt": 4000,
};

for (const [name, limit] of Object.entries(limits)) {
  const value = read(name);
  if (!value) throw new Error(`${name} must not be empty.`);
  if ([...value].length > limit) throw new Error(`${name} exceeds ${limit} characters.`);
}

const keywords = read("keywords.txt");
if (Buffer.byteLength(keywords, "utf8") > 100) throw new Error("keywords.txt exceeds 100 UTF-8 bytes.");
for (const name of ["support_url.txt"]) {
  const url = new URL(read(name));
  if (url.protocol !== "https:") throw new Error(`${name} must use HTTPS.`);
}

console.log("iOS App Store metadata draft passed structural validation.");
