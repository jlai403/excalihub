<script lang="ts">
  import { onMount } from "svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { Space } from "$lib/types";

  let {
    open = $bindable(false),
    onCreated,
  }: {
    open: boolean;
    onCreated: (space: Space) => void;
  } = $props();

  let name = $state("");
  let loading = $state(false);
  let hubHost = $state("");
  let error = $state<string | null>(null);

  let slug = $derived(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );

  onMount(() => {
    hubHost = window.__hubHost;
  });

  function reset() {
    name = "";
    error = null;
    loading = false;
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    loading = true;
    error = null;
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        const space = await res.json();
        onCreated(space);
        open = false;
        reset();
      } else {
        const err = await res.json();
        error = err.error || "Failed to create space";
      }
    } catch {
      error = "Failed to create space";
    } finally {
      loading = false;
    }
  }
</script>

<Dialog.Root {open} onOpenChange={(v) => { open = v; if (!v) reset(); }}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Create Space</Dialog.Title>
      <Dialog.Description>
        Create a new whiteboard space. It will get its own subdomain.
      </Dialog.Description>
    </Dialog.Header>
    <form onsubmit={handleSubmit} class="space-y-4">
      <div class="space-y-2">
        <Label for="name">Space Name</Label>
        <Input
          id="name"
          placeholder="e.g., my-project"
          bind:value={name}
          required
        />
        <p class="text-xs text-muted-foreground">
          This will create a space at:
          <span class="text-primary">{slug || "your-name"}.{hubHost}</span>
        </p>
      </div>
      {#if error}
        <p class="text-sm text-destructive">{error}</p>
      {/if}
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={() => { open = false; reset(); }}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
