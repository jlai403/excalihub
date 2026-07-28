<script lang="ts">
  import { onMount } from "svelte";
  import {
    getGitConfig,
    getSSHPublicKey,
    loadGitConfig,
    connectGitRepo,
    disconnectGitRepo,
  } from "$lib/stores/git.svelte";

  let gitConfig = $state(getGitConfig());
  let sshPublicKey = $state(getSSHPublicKey());
  let repoUrl = $state("");
  let loading = $state(false);
  let error = $state("");
  let copied = $state(false);

  onMount(async () => {
    await loadGitConfig();
    gitConfig = getGitConfig();
    sshPublicKey = getSSHPublicKey();
    repoUrl = gitConfig.repoUrl;
  });

  async function handleConnect() {
    if (!repoUrl) {
      error = "Repository URL is required";
      return;
    }

    loading = true;
    error = "";

    const result = await connectGitRepo(repoUrl);
    if (result.success) {
      gitConfig = getGitConfig();
    } else {
      error = result.error || "Failed to connect";
    }

    loading = false;
  }

  async function handleDisconnect() {
    loading = true;
    await disconnectGitRepo();
    gitConfig = getGitConfig();
    repoUrl = "";
    loading = false;
  }

  function copyToClipboard() {
    if (sshPublicKey) {
      navigator.clipboard.writeText(sshPublicKey);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }
</script>

<div class="space-y-6">
  <div class="rounded-lg border border-border bg-card p-6">
    <h2 class="text-lg font-medium mb-4">Git Integration</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Connect to a GitHub repository to commit and push your diagrams. The server
      generates an SSH key automatically — add the public key below as a deploy
      key in your repository.
    </p>

    {#if gitConfig.connected}
      <div class="flex items-center gap-2 mb-4">
        <span class="size-2 rounded-full bg-green-500"></span>
        <span class="text-sm font-medium">Connected</span>
        {#if gitConfig.connectedAt}
          <span class="text-xs text-muted-foreground">
            since {new Date(gitConfig.connectedAt).toLocaleString()}
          </span>
        {/if}
      </div>

      <div class="space-y-2">
        <label class="text-sm font-medium">Repository</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 px-3 py-2 rounded-md bg-muted text-sm font-mono">
            {gitConfig.repoUrl}
          </code>
        </div>
      </div>

      <button
        onclick={handleDisconnect}
        disabled={loading}
        class="mt-4 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-md transition-colors disabled:opacity-50"
      >
        {loading ? "Disconnecting..." : "Disconnect"}
      </button>
    {:else}
      <form onsubmit={(e) => { e.preventDefault(); handleConnect(); }} class="space-y-4">
        <div class="space-y-2">
          <label for="repoUrl" class="text-sm font-medium">
            Repository URL
          </label>
          <input
            id="repoUrl"
            type="text"
            bind:value={repoUrl}
            placeholder="git@github.com:user/repo.git"
            disabled={loading}
            class="w-full px-3 py-2 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground disabled:opacity-50"
          />
          <p class="text-xs text-muted-foreground">
            SSH format: git@github.com:user/repo.git
          </p>
        </div>

        {#if error}
          <p class="text-sm text-destructive">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading || !repoUrl}
          class="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? "Connecting..." : "Connect"}
        </button>
      </form>
    {/if}
  </div>

  <div class="rounded-lg border border-border bg-card p-6">
    <h2 class="text-lg font-medium mb-4">SSH Public Key</h2>
    <p class="text-sm text-muted-foreground mb-4">
      Add this key as a deploy key in your GitHub repository settings with
      write access.
    </p>

    {#if sshPublicKey}
      <div class="relative">
        <pre class="p-3 rounded-md bg-muted text-xs font-mono break-all whitespace-pre-wrap">{sshPublicKey}</pre>
        <button
          onclick={copyToClipboard}
          class="absolute top-2 right-2 p-2 rounded-md hover:bg-background transition-colors"
          title="Copy to clipboard"
        >
          {#if copied}
            <svg class="size-4 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {:else}
            <svg class="size-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          {/if}
        </button>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">
        SSH key will be generated when you connect to a repository.
      </p>
    {/if}
  </div>
</div>
