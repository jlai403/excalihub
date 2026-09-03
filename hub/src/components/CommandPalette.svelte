<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import { getSpaces } from "$lib/stores/spaces.svelte";
  import { setCreateSpaceOpen } from "$lib/stores/ui.svelte";
  import { setTheme } from "$lib/utils/theme";
  import { LayoutGrid, Archive, Settings, Plus, Globe, Monitor, Sun, Moon, Pin, PinOff, GitBranch } from "@lucide/svelte";

  let open = $state(false);
  const spaces = $derived(getSpaces());

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      open = !open;
    }
  }

  function close() {
    open = false;
  }

  function goToDashboard() {
    window.location.href = "/";
  }
  function goToArchived() {
    window.location.href = "/archived";
  }
  function goToSettings() {
    window.location.href = "/settings";
  }

  function openSpace(space: { subdomain: string }) {
    const hubHost = window.__hubHost;
    window.open(`http://${space.subdomain}.${hubHost}`, "_blank");
    close();
  }
  function createSpace() {
    close();
    setCreateSpaceOpen(true);
  }

  function pinSidebar() {
    localStorage.setItem("sidebar-pinned", "true");
    window.dispatchEvent(new Event("sidebar-pin-change"));
  }
  function unpinSidebar() {
    localStorage.setItem("sidebar-pinned", "false");
    window.dispatchEvent(new Event("sidebar-pin-change"));
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<Command.Dialog bind:open>
  <Command.Input placeholder="Type a command or search..." />
  <Command.List>
    <Command.Empty>No results found.</Command.Empty>

    <Command.Group heading="Navigate">
      <Command.Item onSelect={goToDashboard}>
        <LayoutGrid class="mr-2 size-4" /> Dashboard
      </Command.Item>
      <Command.Item onSelect={goToArchived}>
        <Archive class="mr-2 size-4" /> Archived
      </Command.Item>
      <Command.Item onSelect={goToSettings}>
        <Settings class="mr-2 size-4" /> Settings
      </Command.Item>
    </Command.Group>

    <Command.Separator />

    <Command.Group heading="Spaces">
      <Command.Item onSelect={createSpace}>
        <Plus class="mr-2 size-4" /> Create Space
      </Command.Item>
      {#each spaces as space (space.id)}
        <Command.Item onSelect={() => openSpace(space)}>
          <Globe class="mr-2 size-4" /> {space.name}
        </Command.Item>
      {/each}
    </Command.Group>

    <Command.Separator />

    <Command.Group heading="Theme">
      <Command.Item onSelect={() => setTheme("system")}>
        <Monitor class="mr-2 size-4" /> System
      </Command.Item>
      <Command.Item onSelect={() => setTheme("light")}>
        <Sun class="mr-2 size-4" /> Light
      </Command.Item>
      <Command.Item onSelect={() => setTheme("dark")}>
        <Moon class="mr-2 size-4" /> Dark
      </Command.Item>
    </Command.Group>

    <Command.Separator />

    <Command.Group heading="Sidebar">
      <Command.Item onSelect={pinSidebar}>
        <Pin class="mr-2 size-4" /> Pin
      </Command.Item>
      <Command.Item onSelect={unpinSidebar}>
        <PinOff class="mr-2 size-4" /> Unpin
      </Command.Item>
    </Command.Group>

    <Command.Separator />

    <Command.Group heading="Git">
      <Command.Item onSelect={goToSettings}>
        <GitBranch class="mr-2 size-4" /> Git Settings
      </Command.Item>
    </Command.Group>
  </Command.List>
</Command.Dialog>
