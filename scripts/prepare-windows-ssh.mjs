import { copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { bitviseInstaller, hashFile, psQuote, validateClientIp, validateConnection } from "./windows-ssh-common.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const value = (name, fallback) => {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
};
if (args.includes("--help") || !value("--host")) {
  console.log("Usage: npm run server:ssh:prepare -- --host <server-ip> [--client-ip <your-public-ip>] [--user Administrator] [--port 22] [--ssh-only]");
  process.exit(args.includes("--help") ? 0 : 1);
}

let cache;
try {
  const configDir = join(homedir(), ".config", "timemanage-deploy");
  const keyFile = resolve(value("--key", join(homedir(), ".ssh", "timemanage_deploy")));
  const config = validateConnection({
    host: value("--host"), user: value("--user", "Administrator"), port: Number(value("--port", "22")), keyFile,
    remoteRoot: value("--remote-root", "C:\\Users\\Administrator\\Desktop"),
  });
  const clientIp = validateClientIp(value("--client-ip") ?? execFileSync("curl", ["-fsS", "--noproxy", "*", "--max-time", "15", "https://api.ipify.org"], { encoding: "utf8" }).trim());
  mkdirSync(dirname(keyFile), { recursive: true, mode: 0o700 });
  if (!existsSync(keyFile)) execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", keyFile, "-C", "timemanage-deploy"], { stdio: "inherit" });
  if (!existsSync(`${keyFile}.pub`)) throw new Error("Private key exists but its .pub file is missing; it was not overwritten.");
  const bundle = resolve(value("--output", join(homedir(), "Desktop", "TimeManage-SSH-Setup")));
  mkdirSync(bundle, { recursive: true });
  cache = mkdtempSync(join(tmpdir(), "timemanage-ssh-installer-"));
  const installer = value("--installer", join(cache, "Bitvise-SSH-Server.exe"));
  if (!value("--installer")) execFileSync("curl", ["-fL", "--retry", "2", "--max-time", "180", bitviseInstaller.url, "-o", installer], { stdio: "inherit" });
  if (hashFile(installer) !== bitviseInstaller.sha256) throw new Error("Bitvise installer checksum mismatch; no setup bundle was generated.");
  copyFileSync(installer, join(bundle, "Bitvise-SSH-Server.exe"));
  copyFileSync(`${keyFile}.pub`, join(bundle, "deploy-key.pub"));
  copyFileSync(join(root, "scripts", "windows", "setup-ssh.ps1"), join(bundle, "setup-ssh.ps1"));
  copyFileSync(join(root, "scripts", "windows", "enable-ssh.cmd"), join(bundle, "enable-ssh.cmd"));
  writeFileSync(join(bundle, "setup-config.ps1"), `@{\r\nHostName=${psQuote(config.host)}\r\nAccountName=${psQuote(config.user)}\r\nPort=${config.port}\r\nClientIp=${psQuote(clientIp)}\r\nRemoteRoot=${psQuote(config.remoteRoot)}\r\nInstallerSha256=${psQuote(bitviseInstaller.sha256)}\r\n}\r\n`);
  writeFileSync(join(bundle, "README.txt"), "\ufeffTimeManage SSH 完整安装包\r\n\r\n将整个 ZIP 拷到 Windows 服务器，全部解压后双击 enable-ssh.cmd，允许管理员提权。\r\n以下六个文件应在同一个文件夹：\r\nBitvise-SSH-Server.exe、deploy-key.pub、setup-config.ps1、setup-ssh.ps1、enable-ssh.cmd、README.txt。\r\n安装所需文件全部包含在此 ZIP 中，不依赖旧安装目录。\r\n首次安装只需输入一次 YES，接受 Bitvise Standard 30 天试用许可；组织长期使用需购买许可。\r\n脚本会完成安装、导入公钥、限制来源 IP、设置服务开机启动和 Windows 防火墙，并显示主机密钥。\r\n\r\n云安全组如未放行：TCP " + config.port + "，来源 " + clientIp + "/32。Windows 脚本不具备云账号权限。\r\n\r\n回到 Mac，在 TimeManage 项目中执行：npm run server:ssh:check\r\n首次连接核对服务器显示的主机密钥。也可把服务器生成的 server-host-keys.txt 拷回 Mac，用 --host-keys 指定。\r\n私钥保留在 Mac，安装包内只有公钥，没有服务器密码。\r\n");
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileSync(join(configDir, "config.json"), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  chmodSync(join(configDir, "config.json"), 0o600);
  const zip = `${bundle}.zip`;
  const temporaryZip = `${bundle}-${Date.now()}.zip`;
  const bundleFiles = ["Bitvise-SSH-Server.exe", "deploy-key.pub", "setup-config.ps1", "setup-ssh.ps1", "enable-ssh.cmd", "README.txt"];
  execFileSync("zip", ["-q", temporaryZip, ...bundleFiles], { cwd: bundle });
  execFileSync("unzip", ["-tq", temporaryZip]);
  renameSync(temporaryZip, zip);
  const sshOnly = args.includes("--ssh-only");
  const launcher = join(homedir(), "Desktop", sshOnly ? "check-timemanage-ssh.command" : "publish-timemanage.command");
  const shellQuote = (path) => `'${path.replaceAll("'", "'\\''")}'`;
  const shellRoot = shellQuote(root);
  const command = sshOnly ? `${shellQuote(process.execPath)} scripts/deploy-team-ssh.mjs --check` : "npm run server:ssh:check && npm run server:deploy -- --build";
  const failure = sshOnly ? "SSH 连接检查失败，请查看上面的错误信息。" : "发布失败，请查看上面的错误信息。";
  writeFileSync(launcher, `#!/bin/bash\ncd ${shellRoot} || exit 1\n${command}\nresult=$?\nif [ "$result" -ne 0 ]; then echo "${failure}"; fi\nread -r -p "按回车关闭窗口。"\nexit "$result"\n`, { mode: 0o755 });
  chmodSync(launcher, 0o755);
  console.log(`\nSSH setup: ${zip}\nClient IP: ${clientIp}/32\nPrivate key remains on this Mac: ${keyFile}\nAfter running enable-ssh.cmd on the server, double-click: ${launcher}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (cache) rmSync(cache, { recursive: true, force: true });
}
