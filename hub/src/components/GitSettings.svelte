<script lang="ts">
  import { onMount } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { AlertTriangle } from "@lucide/svelte";
  import {
    getGitConfig,
    getSSHPublicKey,
    loadGitConfig,
    connectGitRepo,
    disconnectGitRepo,
  } from "$lib/stores/git.svelte";

  let gitConfig = $derived(getGitConfig());
  let sshPublicKey = $derived(getSSHPublicKey());
  let repoUrl = $state("");
  let loading = $state(false);
  let error = $state("");
  let copied = $state(false);
  let showConfirm = $state(false);
  let showDisconnectConfirm = $state(false);

  onMount(loadGitConfig);

  async function handleConnect() {
    loading = true;
    error = "";

    const result = await connectGitRepo(repoUrl);
    if (!result.success) {
      error = result.error || "Failed to connect";
    }

    loading = false;
  }

  async function handleDisconnect() {
    loading = true;
    await disconnectGitRepo();
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

      <Dialog.Root open={showDisconnectConfirm} onOpenChange={(open) => { if (!open) showDisconnectConfirm = false; }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
              <AlertTriangle class="size-5 text-destructive" />
              Disconnect repository?
            </Dialog.Title>
            <Dialog.Description>
              This will stop syncing diagrams to the remote repository. The local data
              will not be affected, but future commits will not be pushed until you reconnect.
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="outline" onclick={() => { showDisconnectConfirm = false; }}>
              Cancel
            </Button>
            <Button variant="destructive" onclick={() => { showDisconnectConfirm = false; handleDisconnect(); }}>
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <Button
        variant="destructive"
        onclick={() => { showDisconnectConfirm = true; }}
        disabled={loading}
        class="mt-4"
      >
        {loading ? "Disconnecting..." : "Disconnect"}
      </Button>
    {:else}
      <Dialog.Root open={showConfirm} onOpenChange={(open) => { if (!open) showConfirm = false; }}>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
              <AlertTriangle class="size-5 text-destructive" />
              Connect to repository?
            </Dialog.Title>
            <Dialog.Description>
              This will sync all existing spaces to the remote branch
              <code class="inline-block mx-1 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">{repoUrl}</code>.
              This may overwrite any existing content on the remote. Are you sure you want to proceed?
            </Dialog.Description>
          </Dialog.Header>
          <Dialog.Footer>
            <Button variant="outline" onclick={() => { showConfirm = false; }}>
              Cancel
            </Button>
            <Button onclick={() => { showConfirm = false; handleConnect(); }}>
              {loading ? "Connecting..." : "Connect"}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
      <form onsubmit={(e) => { e.preventDefault(); if (!repoUrl) { error = "Repository URL is required"; return; } showConfirm = true; }} class="space-y-4">
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

        <Button
          type="submit"
          disabled={loading || !repoUrl}
        >
          {loading ? "Connecting..." : "Connect"}
        </Button>
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
        <Button
          onclick={copyToClipboard}
          variant="outline"
          size="icon"
          class="absolute top-2 right-2"
          title="Copy to clipboard"
        >
          {#if copied}
            <svg class="size-4 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {:else}
            <svg class="size-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          {/if}
        </Button>
      </div>
    {:else}
      <p class="text-sm text-muted-foreground">
        Generating SSH key...
      </p>
    {/if}
  </div>
</div>
