<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Archive, CircleCheckBig, GitBranch, GitCommitHorizontal } from "@lucide/svelte";
  import CreateSpaceForm from "./CreateSpaceForm.svelte";
  import { getSpaces, loadSpaces, addSpace, archiveSpace } from "$lib/stores/spaces.svelte";
  import { getCreateSpaceOpen, setCreateSpaceOpen } from "$lib/stores/ui.svelte";

  type SpaceGitStatus = {
    lastCommitAt: string | null;
    lastCommitMessage: string | null;
    hasUncommittedChanges: boolean;
  };

  let loading = $state(true);
  let error: string | null = $state(null);
  let hubHost = $state("");
  let archiveTarget = $state<string | null>(null);
  let actionLoading = $state(false);
  let gitConnected = $state(false);
  let gitStatuses = $state(new Map<string, SpaceGitStatus>());

  const spaces = $derived(getSpaces());
  const createSpaceOpen = $derived(getCreateSpaceOpen());

  onMount(async () => {
    hubHost = window.__hubHost;
    try {
      await loadSpaces();
    } catch {
      error = "Failed to load spaces";
      loading = false;
      return;
    }

    const gitConfig = await fetch("/api/git/config")
      .then((r) => r.json())
      .catch(() => null);
    if (gitConfig?.connected) {
      gitConnected = true;
      const statuses = await Promise.all(
        spaces.map(async (space) => {
          const res = await fetch(`/api/spaces/${space.id}/git-status`);
          if (!res.ok) return null;
          return [space.id, (await res.json()) as SpaceGitStatus] as const;
        })
      );
      gitStatuses = new Map(
        statuses.filter((s): s is [string, SpaceGitStatus] => s !== null)
      );
    }
    loading = false;
  });

  function handleCreated(space: Parameters<typeof addSpace>[0]) {
    addSpace(space);
  }

  async function handleArchive(id: string) {
    actionLoading = true;
    await archiveSpace(id);
    archiveTarget = null;
    actionLoading = false;
  }

  function formatBackupTime(filename: string | null): string {
    if (!filename) return "Never";
    const match = filename.match(/^(\d+)-/);
    if (!match) return "Unknown";
    return new Date(parseInt(match[1])).toLocaleDateString();
  }

  function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
</script>

<CreateSpaceForm open={createSpaceOpen} onOpenChange={setCreateSpaceOpen} onCreated={handleCreated} />

<h2 class="text-2xl font-semibold mb-6">Spaces</h2>

{#if loading}
  <p class="text-muted-foreground">Loading spaces...</p>
{:else if error}
  <Card.Root>
    <Card.Content class="py-8 text-center">
      <p class="text-destructive">{error}</p>
    </Card.Content>
  </Card.Root>
{:else if spaces.length === 0}
  <Card.Root>
    <Card.Content class="py-12 text-center">
      <p class="mb-4 text-muted-foreground">No spaces yet</p>
      <Button onclick={() => setCreateSpaceOpen(true)}>Create your first space</Button>
    </Card.Content>
  </Card.Root>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Tooltip.Provider>
      {#each spaces as space (space.id)}
      <Card.Root>
        <Card.Header>
          <Card.Title>
            <a href="http://{space.subdomain}.{hubHost}" class="hover:underline">
              {space.name}
            </a>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            {space.subdomain}.{hubHost}
          </p>
          <p class="mt-2 text-xs text-muted-foreground/60">
            Created: {new Date(space.createdAt).toLocaleDateString()}
          </p>
          <p class="text-xs text-muted-foreground/60">
            Updated: {new Date(space.updatedAt).toLocaleDateString()}
          </p>
          <p class="text-xs text-muted-foreground/60">
            Last Backup: {formatBackupTime(space.latest_backup)}
          </p>
          {#if gitConnected && gitStatuses.get(space.id)}
            {@const status = gitStatuses.get(space.id)!}
            <p class="mt-1.5 flex items-center gap-1.5 text-xs">
              {#if status.lastCommitMessage}
                {#if status.hasUncommittedChanges}
                  <GitCommitHorizontal class="size-3.5 shrink-0 text-amber-500" />
                {:else}
                  <CircleCheckBig class="size-3.5 shrink-0 text-green-500" />
                {/if}
              {:else}
                <GitBranch class="size-3.5 shrink-0 text-muted-foreground/60" />
              {/if}
              {#if status.lastCommitMessage}
                <span class="text-muted-foreground/60 truncate" title={status.lastCommitMessage}>
                  {status.lastCommitMessage}
                </span>
              {:else}
                <span class="text-muted-foreground/60">No commits yet</span>
              {/if}
              {#if status.lastCommitAt}
                <Tooltip.Root>
                  <Tooltip.Trigger>
                    <span class="text-muted-foreground/60 whitespace-nowrap">
                      · {formatRelativeTime(status.lastCommitAt)}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content>
                    {new Date(status.lastCommitAt).toLocaleString()}
                  </Tooltip.Content>
                </Tooltip.Root>
              {/if}
              {#if status.lastCommitMessage && status.hasUncommittedChanges}
                <span class="text-amber-500 whitespace-nowrap">· unsaved changes</span>
              {/if}
            </p>
          {/if}
          <div class="mt-3">
            <Dialog.Root open={archiveTarget === space.id} onOpenChange={(open) => { if (!open) archiveTarget = null; }}>
              <Dialog.Trigger>
                {#snippet child({ props })}
                  <Button variant="outline" size="sm" {...props} onclick={() => (archiveTarget = space.id)}>
                    <Archive class="size-4" />
                    Archive
                  </Button>
                {/snippet}
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Archive "{space.name}"?</Dialog.Title>
                  <Dialog.Description>
                    The space will still be accessible via its URL but won't appear in the hub.
                    You can unarchive it later from the Archived page.
                  </Dialog.Description>
                </Dialog.Header>
                <Dialog.Footer>
                  <Button variant="outline" onclick={() => (archiveTarget = null)}>Cancel</Button>
                  <Button onclick={() => handleArchive(space.id)} disabled={actionLoading}>Archive</Button>
                </Dialog.Footer>
              </Dialog.Content>
            </Dialog.Root>
          </div>
        </Card.Content>
      </Card.Root>
    {/each}
    </Tooltip.Provider>
  </div>
{/if}
