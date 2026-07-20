<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Badge } from "$lib/components/ui/badge";
  import { Archive, Trash2 } from "@lucide/svelte";

  let { spaceId }: { spaceId: string } = $props();

  type Space = {
    id: string;
    name: string;
    subdomain: string;
    createdAt: string;
    status: string;
    latest_backup: string | null;
  };

  type Backup = {
    filename: string;
    hash: string;
    createdAt: string;
  };

  let space = $state<Space | null>(null);
  let backups = $state<Backup[]>([]);
  let loading = $state(true);
  let actionLoading = $state(false);
  let deleteOpen = $state(false);
  let archiveOpen = $state(false);
  let baseDomain = $state("example.com");

  onMount(() => {
    if (!spaceId) {
      window.location.href = "/";
      return;
    }
    Promise.all([
      fetch("/api/config").then((r) => r.json()),
      fetch(`/api/spaces/${spaceId}`).then((r) => r.json()),
      fetch(`/api/spaces/${spaceId}/backups`).then((r) => r.json()),
    ])
      .then(([config, spaceData, backupData]) => {
        if (!spaceData.id) {
          window.location.href = "/";
          return;
        }
        baseDomain = config.baseDomain;
        space = spaceData;
        backups = backupData;
        loading = false;
      })
      .catch(() => {
        window.location.href = "/";
      });
  });

  async function handleArchive() {
    actionLoading = true;
    await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    window.location.href = "/";
  }

  async function handleDelete() {
    actionLoading = true;
    await fetch(`/api/spaces/${spaceId}`, { method: "DELETE" });
    window.location.href = "/";
  }

  async function handleUnarchive() {
    actionLoading = true;
    await fetch(`/api/spaces/${spaceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    window.location.href = "/";
  }
</script>

{#if loading || !space}
  <p class="text-muted-foreground">Loading space...</p>
{:else}
  {@const isArchived = space.status === "archived"}
  <div class="space-y-6">
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-semibold">{space.name}</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          <a
            href="http://{space.subdomain}.{baseDomain}"
            class="text-primary hover:underline"
          >
            {space.subdomain}.{baseDomain}
          </a>
        </p>
        {#if isArchived}
          <Badge variant="secondary" class="mt-2">Archived</Badge>
        {/if}
      </div>
      <div class="flex gap-2">
        {#if isArchived}
          <Button variant="outline" onclick={handleUnarchive} disabled={actionLoading}>
            Unarchive
          </Button>
        {:else}
          <Dialog.Root bind:open={archiveOpen}>
            <Dialog.Trigger>
              {#snippet child({ props })}
                <Button variant="outline" {...props}>
                  <Archive class="size-4" />
                  Archive
                </Button>
              {/snippet}
            </Dialog.Trigger>
            <Dialog.Content>
              <Dialog.Header>
                <Dialog.Title>Archive this space?</Dialog.Title>
                <Dialog.Description>
                  The space will still be accessible via its URL but won't appear in the hub.
                  You can unarchive it later.
                </Dialog.Description>
              </Dialog.Header>
              <Dialog.Footer>
                <Button variant="outline" onclick={() => (archiveOpen = false)}>Cancel</Button>
                <Button onclick={handleArchive} disabled={actionLoading}>Archive</Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        {/if}

        <Dialog.Root bind:open={deleteOpen}>
          <Dialog.Trigger>
            {#snippet child({ props })}
              <Button variant="destructive" {...props}>
                <Trash2 class="size-4" />
                Delete
              </Button>
            {/snippet}
          </Dialog.Trigger>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Delete this space?</Dialog.Title>
              <Dialog.Description>
                This will permanently delete the space and all its backups. This action cannot be undone.
              </Dialog.Description>
            </Dialog.Header>
            <Dialog.Footer>
              <Button variant="outline" onclick={() => (deleteOpen = false)}>Cancel</Button>
              <Button variant="destructive" onclick={handleDelete} disabled={actionLoading}>
                Delete
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>Backups</Card.Title>
      </Card.Header>
      <Card.Content>
        {#if backups.length === 0}
          <p class="text-sm text-muted-foreground">
            No backups yet. Backups are created automatically when you edit the whiteboard.
          </p>
        {:else}
          <div class="space-y-2">
            {#each backups as backup (backup.filename)}
              <div class="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                <div class="flex items-center gap-4">
                  <span class="text-sm text-muted-foreground">
                    {new Date(backup.createdAt).toLocaleString()}
                  </span>
                  <span class="text-xs text-muted-foreground/60">
                    {backup.hash.slice(0, 8)}...
                  </span>
                </div>
                <Button variant="outline" size="sm" href="/api/backups/{backup.filename}">
                  Download
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <a href="/" class="text-sm text-muted-foreground hover:text-foreground transition-colors">
      &larr; Back to dashboard
    </a>
  </div>
{/if}
