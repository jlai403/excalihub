import { rmSync, mkdirSync, writeFileSync, chmodSync } from "fs";
import { join, resolve } from "path";
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

const IMAGE = "excalihub:e2e";
const CONTAINER = "excalihub-e2e";

function assertDocker() {
  try {
    execSync("docker info", { stdio: "pipe" });
  } catch {
    throw new Error(
      "test:e2e:docker requires a running Docker daemon. For local host-mode " +
        "e2e (no container), use `bun run test:e2e` instead."
    );
  }
}

function startContainer() {
  assertDocker();

  const dataDir = resolve(DATA_DIR);

  console.log("[globalSetup] building image...");
  execSync(`docker build . -t ${IMAGE}`, { stdio: "inherit" });

  console.log("[globalSetup] starting container...");
  execSync(`docker rm -f ${CONTAINER} >/dev/null 2>&1 || true`, {
    stdio: "pipe",
  });
  const run = [
    "docker run -d --rm --name",
    CONTAINER,
    "-p 8081:8081",
    "--add-host host.docker.internal:host-gateway",
    `-v ${dataDir}:/data`,
    "-e NODE_ENV=production",
    "-e PORT=8081",
    "-e HOST=0.0.0.0",
    "-e DATA_DIR=/data",
    "-e BASE_DOMAIN=localhost",
    "-e HUB_SUBDOMAIN=excalihub",
    "-e EXCALIDRAW_CONTAINER=http://host.docker.internal:8099",
    IMAGE,
  ].join(" ");
  execSync(run, { stdio: "inherit" });

  waitUntilReady();
}

function waitUntilReady() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const res = execSync("curl -sf http://localhost:8081/api/config", {
        stdio: "pipe",
        timeout: 5000,
      }).toString();
      if (res.length > 0) {
        console.log("[globalSetup] container ready");
        return;
      }
    } catch {
      // not up yet
    }
    execSync("sleep 0.5");
  }
  throw new Error("Timed out waiting for excalihub container to become ready");
}

export default async function globalSetup() {
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
  if (privateKey) {
    const gitConfigDir = join(DATA_DIR, "git-config");
    mkdirSync(gitConfigDir, { recursive: true });
    const keyPath = join(gitConfigDir, "id_ed25519");
    const key = privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`;
    writeFileSync(keyPath, key);
    chmodSync(keyPath, 0o600);
    const pubKey = execSync(`ssh-keygen -y -f ${keyPath}`).toString().trim();
    writeFileSync(join(gitConfigDir, "id_ed25519.pub"), pubKey);
  }

  // The docker e2e config serves the app from the built image. Hand the
  // container lifecycle here (build + run + wait) instead of Playwright's
  // webServer, which can't reliably manage a container's lifecycle.
  if (process.env.E2E_DOCKER === "1") {
    startContainer();
  }
}
