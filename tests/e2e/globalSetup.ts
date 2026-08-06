import { rmSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const DATA_DIR = "./data-e2e";

function killPort(port: number) {
  const kill = () => {
    try {
      const pid = execSync(`lsof -ti :${port}`, { stdio: "pipe" })
        .toString()
        .trim();
      if (pid) process.kill(Number(pid), "SIGTERM");
    } catch {
      // nothing listening on the port
    }
  };

  kill();
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      execSync(`lsof -ti :${port}`, { stdio: "pipe" });
      execSync("sleep 0.2");
    } catch {
      return;
    }
  }
}

export default function globalSetup() {
  killPort(8081);
  killPort(4321);
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });

  // Seed the app with a stable SSH keypair so the e2e deploy key
  // (excalihub-e2e on jlai403/excalihub-ci) is reused across runs
  // instead of being re-registered (and re-notifying) every run.
  // The private key comes from E2E_SSH_PRIVATE_KEY (repo secret in CI,
  // 1Password via varlock locally) — never committed to the repo.
  const privateKey = process.env.E2E_SSH_PRIVATE_KEY;
  if (!privateKey) return;

  const gitConfigDir = join(DATA_DIR, "git-config");
  mkdirSync(gitConfigDir, { recursive: true });
  const keyPath = join(gitConfigDir, "id_ed25519");
  const key = privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`;
  writeFileSync(keyPath, key);
  chmodSync(keyPath, 0o600);
  const pubKey = execSync(`ssh-keygen -y -f ${keyPath}`).toString().trim();
  writeFileSync(join(gitConfigDir, "id_ed25519.pub"), pubKey);
}
