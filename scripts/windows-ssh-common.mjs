import { createHash } from "node:crypto";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve } from "node:path";

export const bitviseInstaller = {
  url: "https://dl.bitvise.com/BvSshServer-966.exe",
  sha256: "d1407f989d18f4505bf623eb1c33a68cd5c79a483214ebc1ff86bee9821293a6",
};

export const psQuote = (value) => `'${String(value).replaceAll("'", "''")}'`;
export const encodedPowerShell = (source) => Buffer.from(source, "utf16le").toString("base64");
export const hashFile = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export function validateConnection(config) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(config.host ?? "")) throw new Error("SSH host must be an IP address or hostname.");
  if (!/^[a-zA-Z0-9_-]+$/.test(config.user ?? "")) throw new Error("Use a local Windows account name.");
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error("Invalid SSH port.");
  if (!/^[A-Z]:[\\/]/i.test(config.remoteRoot ?? "") || /[\r\n\x00]/.test(config.remoteRoot)) throw new Error("remoteRoot must be an absolute Windows directory.");
  return config;
}

export function validateClientIp(value) {
  const parts = value.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
    || ["0.0.0.0", "255.255.255.255"].includes(value)) throw new Error("Supply one client public IPv4 address, without a CIDR suffix.");
  return value;
}

export function collectPackageFiles(packageDir) {
  const root = resolve(packageDir);
  const contract = JSON.parse(readFileSync(join(root, "release-contract.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+$/.test(contract.release_version) || !Number.isInteger(contract.database_schema_version)
    || !Number.isInteger(contract.api_protocol_version) || typeof contract.minimum_client_release !== "string") throw new Error("Invalid release contract.");
  const releaseText = readFileSync(join(root, "RELEASE.txt"), "utf8");
  const files = [];
  const visit = (relative) => {
    const path = join(root, relative);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`Package symlinks are not supported: ${relative}`);
    if (/[\r\n\\]/.test(relative) || relative.split("/").some((part) => part === "..")) throw new Error("Unsafe package filename.");
    if (stat.isDirectory()) {
      for (const name of readdirSync(path).sort()) visit(`${relative}/${name}`);
    } else if (stat.isFile()) {
      if (relative.toLowerCase() === "server/backend.json") throw new Error("A distributable package must not contain backend.json.");
      files.push({ path: relative, sha256: hashFile(path), size: stat.size });
    } else throw new Error(`Unsupported package entry: ${relative}`);
  };
  for (const name of ["web", "server", "RELEASE.txt", "release-contract.json"]) visit(name);
  for (const required of ["web/index.html", "server/timemanage-team.exe", "server/backend.example.json", "server/DATABASE-OPERATIONS.md"]) {
    if (!files.some((file) => file.path === required)) throw new Error(`Incomplete unified package: ${required}`);
  }
  if (!files.some((file) => /^server\/migrations\/.*\.sql$/.test(file.path))) throw new Error("Package has no database migrations.");
  return { root, contract, releaseText, files };
}

export function sftpQuote(value) {
  if (/[\r\n\x00]/.test(value)) throw new Error("Invalid SFTP path.");
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}
