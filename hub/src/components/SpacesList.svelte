<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import { Archive, CircleCheckBig, Download, ExternalLink, Eye, GitBranch, GitCommitHorizontal, History, Trash2 } from "@lucide/svelte";
  import { getSpaces, loadSpaces, archiveSpace } from "$lib/stores/spaces.svelte";
  import { getGitConfig, loadGitConnection } from "$lib/stores/git.svelte";
  import { setCreateSpaceOpen } from "$lib/stores/ui.svelte";
  import type { Backup } from "$lib/types";

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
  let backupsTarget = $state<{ id: string; name: string; subdomain: string } | null>(null);
  let backups = $state<Backup[]>([]);
  let backupsLoading = $state(false);
  let backupsError: string | null = $state(null);

  const backupTierOrder = [
    { tier: "daily" as const, label: "Daily" },
    { tier: "weekly" as const, label: "Weekly" },
    { tier: "monthly" as const, label: "Monthly" },
    { tier: "older" as const, label: "Older" },
  ];
  let backupsByTier = $derived(
    backupTierOrder
      .map(({ tier, label }) => ({
        tier,
        label,
        items: tier === "older" ? backups.filter((b) => !b.tier) : backups.filter((b) => b.tier === tier),
      }))
      .filter((group) => group.items.length > 0)
  );

  const gitConfig = $derived(getGitConfig());
  const spaces = $derived(getSpaces());

  onMount(async () => {
    hubHost = window.__hubHost;
    try {
      await loadSpaces();
    } catch {
      error = "Failed to load spaces";
      loading = false;
      return;
    }

    try {
      await loadGitConnection();
    } catch {
      loading = false;
      return;
    }
    const gitConfig = getGitConfig();
    if (gitConfig.connected) {
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

  function formatBackupDateTime(iso: string): string {
    const date = new Date(iso);
    return isNaN(date.getTime()) ? iso : date.toLocaleString();
  }

  async function openBackups(space: { id: string; name: string; subdomain: string }) {
    backupsTarget = { id: space.id, name: space.name, subdomain: space.subdomain };
    backups = [];
    backupsError = null;
    backupsLoading = true;
    try {
      const res = await fetch(`/api/spaces/${space.id}/backups`);
      if (!res.ok) throw new Error("Failed to load backups");
      backups = await res.json();
    } catch {
      backupsError = "Failed to load backups";
    }
    backupsLoading = false;
  }

  async function deleteBackup(filename: string) {
    const res = await fetch(
      `/api/spaces/${backupsTarget?.id}/backups/${encodeURIComponent(filename)}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      backups = backups.filter((b) => b.filename !== filename);
    }
  }

  function previewUrl(subdomain: string, filename: string): string {
    const port = window.location.port;
    const host = port ? `${hubHost}:${port}` : hubHost;
    return `http://backup.${host}/?space=${subdomain}&backup=${filename}`;
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
          <div class="mt-3 flex gap-2">
            {#if gitConnected && gitConfig.webUrl}
              <Button variant="outline" size="sm" href={gitConfig.webUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink class="size-4" /> Repo
              </Button>
            {/if}
            <Dialog.Root open={backupsTarget?.id === space.id} onOpenChange={(open) => { if (!open) backupsTarget = null; }}>
              <Dialog.Trigger>
                {#snippet child({ props })}
                  <Button variant="outline" size="sm" {...props} onclick={() => openBackups(space)} class="whitespace-nowrap" data-backups-button="true">
                    <History class="size-4" />
                    Backups
                  </Button>
                {/snippet}
              </Dialog.Trigger>
              <Dialog.Content>
                <Dialog.Header>
                  <Dialog.Title>Backups — {space.name}</Dialog.Title>
                  <Dialog.Description>
                    Preview and download backups. Restore opens inside the space.
                  </Dialog.Description>
                </Dialog.Header>
                <div class="space-y-2">
                  {#if backupsLoading}
                    <p class="text-sm text-muted-foreground">Loading backups...</p>
                  {:else if backupsError}
                    <p class="text-sm text-destructive">{backupsError}</p>
                  {:else if backups.length === 0}
                    <p class="text-sm text-muted-foreground">No backups yet</p>
                  {:else}
                    {#each backupsByTier as group (group.tier)}
                      <div class="space-y-2" data-backup-group={group.tier}>
                        <div class="text-xs font-semibold uppercase tracking-wide text-muted-foreground" data-backup-tier={group.tier}>{group.label}</div>
                        {#each group.items as backup (backup.filename)}
                          <div class="flex items-center justify-between gap-3 rounded-md border px-3 py-2" data-backup-row={backup.filename}>
                        <span class="truncate text-sm" title={backup.filename}>
                          {formatBackupDateTime(backup.createdAt)}
                        </span>
                        <span class="flex shrink-0 gap-1.5">
                          <Button variant="ghost" size="sm" href={`/api/backups/${encodeURIComponent(backup.filename)}`} download={backup.filename} data-backup-download="true">
                            <Download class="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" href={previewUrl(space.subdomain, backup.filename)} target="_blank" rel="noopener noreferrer" data-backup-preview="true">
                            <Eye class="size-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onclick={() => deleteBackup(backup.filename)} data-backup-delete="true">
                            <Trash2 class="size-4" />
                          </Button>
                        </span>
</div>
                        {/each}
                      </div>
                    {/each}
                  {/if}
                </div>
                <Dialog.Footer />
              </Dialog.Content>
            </Dialog.Root>
            <Dialog.Root open={archiveTarget === space.id} onOpenChange={(open) => { if (!open) archiveTarget = null; }}>
              <Dialog.Trigger>
                {#snippet child({ props })}
                  <Button variant="outline" size="sm" {...props} onclick={() => (archiveTarget = space.id)} class="whitespace-nowrap">
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
