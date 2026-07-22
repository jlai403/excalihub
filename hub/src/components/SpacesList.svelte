<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Archive } from "@lucide/svelte";
  import CreateSpaceForm from "./CreateSpaceForm.svelte";
  import { getSpaces, loadSpaces, addSpace, archiveSpace } from "$lib/stores/spaces.svelte";

  let loading = $state(true);
  let error: string | null = $state(null);
  let hubHost = $state("");
  let createOpen = $state(false);
  let archiveTarget = $state<string | null>(null);
  let actionLoading = $state(false);

  const spaces = $derived(getSpaces());

  onMount(async () => {
    hubHost = window.__hubHost;
    try {
      await loadSpaces();
    } catch {
      error = "Failed to load spaces";
    } finally {
      loading = false;
    }
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
</script>

<CreateSpaceForm bind:open={createOpen} onCreated={handleCreated} />

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
      <Button onclick={() => (createOpen = true)}>Create your first space</Button>
    </Card.Content>
  </Card.Root>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  </div>
{/if}
