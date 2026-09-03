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

function startContainer(privateKey: string, publicKey: string) {
  assertDocker();

  const dataDir = resolve(DATA_DIR);

  // On Linux CI the runner owns data-e2e as a different UID than the
  // container's bun user (UID 1000), so the bind-mount /data isn't writable
  // by the app and it crashes at boot (initRepos mkdirSync). Make only the
  // DIRECTORY TREE world-writable so the container can create files regardless
  // of host UID — never the file perms, so the SSH private key keeps its 0600
  // (SSH rejects world-writable keys). The dir is recreated fresh each run, so
  // this is safe ephemeral test data.
  execSync(`find ${dataDir} -type d -exec chmod 777 {} +`);

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
  seedContainerKey(privateKey, publicKey);
}

// The bind-mounted key file is owned by the host runner UID, which on Linux CI
// is a different UID than the container's bun user (UID 1000) — so the bun
// process can't write/own it and SSH refuses a 0600 key it doesn't own. The
// container itself still runs as bun (no --user root on `docker run`); only
// this one-shot seed escalates to root to write the host-owned files and then
// chowns them to UID 1000 so the app + SSH (still UID 1000) own them. Both the
// private key (0600) and public key (0644) must exist — the app's
// isSSHKeyPairGenerated() requires both, else it regenerates a new key that
// won't match the GitHub deploy key.
function seedContainerKey(privateKey: string, publicKey: string) {
  const key = privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`;
  const pub = publicKey.endsWith("\n") ? publicKey : `${publicKey}\n`;
  execSync(
    `printf %s '${key}' | docker exec -i --user root ${CONTAINER} sh -c 'umask 177 && cat > /data/git-config/id_ed25519 && chmod 600 /data/git-config/id_ed25519'`,
    { stdio: "inherit" }
  );
  execSync(
    `printf %s '${pub}' | docker exec -i --user root ${CONTAINER} sh -c 'cat > /data/git-config/id_ed25519.pub && chmod 644 /data/git-config/id_ed25519.pub'`,
    { stdio: "inherit" }
  );
  // Hand ownership to the container's bun user (UID 1000) so SSH accepts the
  // 0600 key; the running app stays UID 1000. Root is only used for this seed.
  execSync(
    `docker exec --user root ${CONTAINER} chown 1000:1000 /data/git-config/id_ed25519 /data/git-config/id_ed25519.pub`,
    { stdio: "inherit" }
  );
  console.log("[globalSetup] seeded SSH key inside container (owned by UID 1000)");
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
  reportContainerFailure();
  throw new Error("Timed out waiting for excalihub container to become ready");
}

function reportContainerFailure(): void {
  try {
    const state = execSync(
      `docker ps -a --filter name=${CONTAINER} --format '{{.Names}} {{.Status}}'`,
      { stdio: "pipe" }
    ).toString();
    console.log("[globalSetup] container state:\n" + state);
    const logs = execSync(`docker logs ${CONTAINER} 2>&1 || true`, {
      stdio: "pipe",
    })
      .toString()
      .trim();
    if (logs) console.log("[globalSetup] container logs:\n" + logs);
  } catch {
    // diagnostics are best-effort
  }
}

export default async function globalSetup() {
  killPort(8081);
  killPort(4321);
  rmSync(DATA_DIR, { recursive: true, force: true });
  mkdirSync(DATA_DIR, { recursive: true });

  // The git e2e deploy key (excalihub-e2e on jlai403/excalihub-ci) is reused
  // across runs instead of being re-registered (and re-notifying) every run.
  // The private key comes from E2E_SSH_PRIVATE_KEY (repo secret in CI,
  // 1Password via varlock locally) — never committed to the repo.
  const privateKey = process.env.E2E_SSH_PRIVATE_KEY;
  let publicKey = "";
  if (privateKey) {
    const gitConfigDir = join(DATA_DIR, "git-config");
    mkdirSync(gitConfigDir, { recursive: true });
    const keyPath = join(gitConfigDir, "id_ed25519");
    const key = privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`;
    writeFileSync(keyPath, key);
    chmodSync(keyPath, 0o600);
    publicKey = execSync(`ssh-keygen -y -f ${keyPath}`).toString().trim();
    writeFileSync(join(gitConfigDir, "id_ed25519.pub"), publicKey);
  }

  // The docker e2e config serves the app from the built image. Hand the
  // container lifecycle here (build + run + wait) instead of Playwright's
  // webServer, which can't reliably manage a container's lifecycle.
  if (process.env.E2E_DOCKER === "1") {
    startContainer(privateKey || "", publicKey);
  }
}
