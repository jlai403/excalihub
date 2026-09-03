import type { GitConfig } from "$lib/types";

let _gitConfig = $state<GitConfig>({
  repoUrl: "",
  connected: false,
  connectedAt: null,
});

let _sshPublicKey = $state<string | null>(null);
let _sshError = $state<string | null>(null);

export function getGitConfig(): GitConfig {
  return _gitConfig;
}

export function getSSHPublicKey(): string | null {
  return _sshPublicKey;
}

export function getSSHError(): string | null {
  return _sshError;
}

export async function loadGitConfig(): Promise<void> {
  _sshError = null;
  const data = await fetch("/api/git/config").then((r) => r.json());
  _gitConfig = data;

  const keyRes = await fetch("/api/git/ssh-key");
  const keyData = await keyRes.json().catch(() => ({}));
  if (keyRes.ok && keyData.publicKey) {
    _sshPublicKey = keyData.publicKey;
  } else {
    _sshPublicKey = null;
    _sshError = keyData.error || "Could not load SSH public key";
  }
}

export async function connectGitRepo(
  repoUrl: string
): Promise<{ success: boolean; error?: string }> {
  const result = await fetch("/api/git/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoUrl }),
  }).then((r) => r.json());

  if (result.success) {
    await loadGitConfig();
  }

  return result;
}

export async function disconnectGitRepo(): Promise<void> {
  await fetch("/api/git/disconnect", { method: "POST" });
  await loadGitConfig();
}

export async function commitToGit(
  subdomain: string,
  excalidrawData: string,
  pngBase64: string | null,
  message: string
): Promise<{ success: boolean; error?: string }> {
  return fetch("/api/git/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subdomain, excalidrawData, pngBase64, message }),
  }).then((r) => r.json());
}
