<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import * as Dialog from "$lib/components/ui/dialog";
  import { ArchiveRestore, Trash2 } from "@lucide/svelte";
  import type { Space } from "$lib/types";

  let spaces = $state<Space[]>([]);
  let loading = $state(true);
  let actionLoading = $state(false);
  let deleteTarget = $state<string | null>(null);
  let hubHost = $state("");

  onMount(async () => {
    hubHost = window.__hubHost;
    try {
      const data = await fetch("/api/spaces").then((r) => r.json());
      spaces = data.filter((s: Space) => s.status === "archived");
    } catch {
      // handled by loading state
    } finally {
      loading = false;
    }
  });

  async function handleUnarchive(id: string) {
    actionLoading = true;
    await fetch(`/api/spaces/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    spaces = spaces.filter((s) => s.id !== id);
    actionLoading = false;
  }

  async function handleDelete(id: string) {
    actionLoading = true;
    await fetch(`/api/spaces/${id}`, { method: "DELETE" });
    spaces = spaces.filter((s) => s.id !== id);
    deleteTarget = null;
    actionLoading = false;
  }
</script>

<div>
  <h2 class="text-2xl font-semibold mb-6">Archived Spaces</h2>

  {#if loading}
    <p class="text-muted-foreground">Loading archived spaces...</p>
  {:else if spaces.length === 0}
    <Card.Root>
      <Card.Content class="py-12 text-center">
        <p class="text-muted-foreground">No archived spaces</p>
      </Card.Content>
    </Card.Root>
  {:else}
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each spaces as space (space.id)}
        <Card.Root>
          <Card.Header>
            <Card.Title>{space.name}</Card.Title>
          </Card.Header>
          <Card.Content>
            <p class="text-sm text-muted-foreground mb-4">
              {space.subdomain}.{hubHost}
            </p>
            <p class="text-xs text-muted-foreground/60 mb-4">
              Created: {new Date(space.createdAt).toLocaleDateString()}
            </p>
            <div class="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onclick={() => handleUnarchive(space.id)}
                disabled={actionLoading}
              >
                <ArchiveRestore class="size-4" />
                Unarchive
              </Button>

              <Dialog.Root open={deleteTarget === space.id} onOpenChange={(open) => { if (!open) deleteTarget = null; }}>
                <Dialog.Trigger>
                  {#snippet child({ props })}
                    <Button variant="destructive" size="sm" {...props} onclick={() => (deleteTarget = space.id)}>
                      <Trash2 class="size-4" />
                      Delete
                    </Button>
                  {/snippet}
                </Dialog.Trigger>
                <Dialog.Content>
                  <Dialog.Header>
                    <Dialog.Title>Permanently delete "{space.name}"?</Dialog.Title>
                    <Dialog.Description>
                      This will permanently delete the space and all its backups.
                      This action cannot be undone.
                    </Dialog.Description>
                  </Dialog.Header>
                  <Dialog.Footer>
                    <Button variant="outline" onclick={() => (deleteTarget = null)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onclick={() => handleDelete(space.id)}
                      disabled={actionLoading}
                    >
                      Delete
                    </Button>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>
            </div>
          </Card.Content>
        </Card.Root>
      {/each}
    </div>
  {/if}
</div>
