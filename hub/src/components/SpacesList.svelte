<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import CreateSpaceForm from "./CreateSpaceForm.svelte";
  import type { Space } from "$lib/types";

  let spaces: Space[] = $state([]);
  let loading = $state(true);
  let error: string | null = $state(null);
  let hubHost = $state("");
  let createOpen = $state(false);

  onMount(async () => {
    hubHost = window.__hubHost;
    try {
      const data = await fetch("/api/spaces").then((r) => r.json());
      spaces = data.filter((s: Space) => s.status === "active");
    } catch {
      error = "Failed to load spaces";
    } finally {
      loading = false;
    }
  });

  function handleCreated(space: Space) {
    spaces = [...spaces, space];
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
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
{/if}
