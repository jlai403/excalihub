<script lang="ts">
  import { onMount } from "svelte";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let name = $state("");
  let loading = $state(false);
  let baseDomain = $state("example.com");

  let slug = $derived(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );

  onMount(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((config) => {
        baseDomain = config.baseDomain;
      })
      .catch(() => {});
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!name.trim()) return;

    loading = true;
    try {
      const res = await fetch("/api/spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create space");
      }
    } catch {
      alert("Failed to create space");
    } finally {
      loading = false;
    }
  }
</script>

<Card.Root class="max-w-md">
  <Card.Content class="pt-6">
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
          <span class="text-primary">{slug || "your-name"}.{baseDomain}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create"}
        </Button>
        <Button type="button" variant="outline" href="/">Cancel</Button>
      </div>
    </form>
  </Card.Content>
</Card.Root>
