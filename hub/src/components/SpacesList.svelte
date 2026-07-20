<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";

  type Space = {
    id: string;
    name: string;
    subdomain: string;
    createdAt: string;
    status: string;
  };

  let spaces: Space[] = $state([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  const BASE_DOMAIN = window.location.hostname.split(".").slice(-2).join(".");

  onMount(() => {
    fetch("/api/spaces")
      .then((res) => res.json())
      .then((data) => {
        spaces = data.filter((s: Space) => s.status === "active");
        loading = false;
      })
      .catch(() => {
        error = "Failed to load spaces";
        loading = false;
      });
  });
</script>

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
      <Button href="/spaces/new">Create your first space</Button>
    </Card.Content>
  </Card.Root>
{:else}
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each spaces as space (space.id)}
      <Card.Root>
        <Card.Header>
          <Card.Title>
            <a href="/space?id={space.id}" class="hover:underline">
              {space.name}
            </a>
          </Card.Title>
        </Card.Header>
        <Card.Content>
          <p class="text-sm text-muted-foreground">
            {space.subdomain}.{BASE_DOMAIN}
          </p>
          <p class="mt-2 text-xs text-muted-foreground/60">
            Created: {new Date(space.createdAt).toLocaleDateString()}
          </p>
        </Card.Content>
      </Card.Root>
    {/each}
  </div>
{/if}
