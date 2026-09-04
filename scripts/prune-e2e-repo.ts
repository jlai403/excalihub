#!/usr/bin/env bun
// One-off cleanup: delete every space dir from the e2e git repo so the remote
// only holds artifacts from the most recent run. Mirrors the setup prune in
// tests/e2e/globalSetup.ts but runnable on demand when the backlog has built
// up (e.g. before the recurring setup-prune existed).
//
// Requires the deploy key, normally resolved via varlock:
//   varlock run -- bun run scripts/prune-e2e-repo.ts
import { join, resolve } from "path";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const DATA_DIR = resolve("./data-e2e");
const repo = process.env.E2E_GIT_REPO ?? "jlai403/excalihub-ci";
const privateKey = process.env.E2E_SSH_PRIVATE_KEY;

if (!repo?.includes("/")) {
  console.error("E2E_GIT_REPO must be owner/repo");
  process.exit(1);
}
if (!privateKey) {
  console.error(
    "E2E_SSH_PRIVATE_KEY not set — run via: varlock run -- bun run scripts/prune-e2e-repo.ts",
  );
  process.exit(1);
}

const repoUrl = `git@github.com:${repo}.git`;
const work = join(DATA_DIR, "prune-manual");
mkdirSync(work, { recursive: true });

try {
  // Re-materialize the deploy key into data-e2e so SSH can use it.
  const gitConfigDir = join(DATA_DIR, "git-config");
  mkdirSync(gitConfigDir, { recursive: true });
  const keyPath = join(gitConfigDir, "id_ed25519");
  writeFileSync(keyPath, privateKey.endsWith("\n") ? privateKey : `${privateKey}\n`, {
    mode: 0o600,
  });
  // Derive the .pub sidecar from the private key so ssh offers the deploy
  // key's real fingerprint (a stale .pub from a prior no-key demo run would
  // otherwise be offered and rejected by GitHub).
  writeFileSync(
    join(gitConfigDir, "id_ed25519.pub"),
    `${execSync(`ssh-keygen -y -f ${keyPath}`, { stdio: "pipe" })}`,
    { mode: 0o644 },
  );

  const sshCommand = `ssh -i ${keyPath} -o IdentitiesOnly=yes -o IdentityAgent=none -o StrictHostKeyChecking=no`;

  const repoDir = join(work, "repo");
  execSync(`git clone --quiet ${repoUrl} ${repoDir}`, {
    stdio: "pipe",
    env: { ...process.env, GIT_SSH_COMMAND: sshCommand },
  });

  const entries = execSync("ls -1", { cwd: repoDir, stdio: "pipe" })
    .toString()
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const spaces = entries.filter((e) => existsSync(join(repoDir, e, "meta.json")));

  if (spaces.length === 0) {
    console.log(`No space dirs to prune in ${repo}`);
  } else {
    const quoted = spaces.map((s) => `"${s}"`).join(" ");
    execSync(`git rm -r --quiet --ignore-unmatch ${quoted}`, {
      cwd: repoDir,
      stdio: "pipe",
    });
    execSync(`git commit --quiet -m "Prune ${spaces.length} stale space dirs"`, {
      cwd: repoDir,
      stdio: "pipe",
    });
    execSync("git push origin main", {
      cwd: repoDir,
      stdio: "pipe",
      env: { ...process.env, GIT_SSH_COMMAND: sshCommand },
    });
    console.log(
      `Pruned ${spaces.length} space dir(s) from ${repo}: ${spaces.join(", ")}`,
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
