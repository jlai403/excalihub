<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import { getSpaces } from "$lib/stores/spaces.svelte";
  import { setCreateSpaceOpen, getPaletteOpen, setPaletteOpen } from "$lib/stores/ui.svelte";
  import { setThemeState } from "$lib/stores/theme.svelte";
  import { LayoutGrid, Archive, Settings, Plus, Globe, Monitor, Sun, Moon, Pin, PinOff, GitBranch } from "@lucide/svelte";

  const spaces = $derived(getSpaces());
  let open = $state(getPaletteOpen());

  $effect(() => {
    open = getPaletteOpen();
  });

  function handleOpenChange(value: boolean) {
    open = value;
    setPaletteOpen(value);
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      e.stopImmediatePropagation();
      handleOpenChange(!getPaletteOpen());
    }
  }

  $effect(() => {
    window.addEventListener("keydown", handleKeydown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeydown, true);
  });

  function close() {
    handleOpenChange(false);
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
    close();
  }
  function unpinSidebar() {
    localStorage.setItem("sidebar-pinned", "false");
    window.dispatchEvent(new Event("sidebar-pin-change"));
    close();
  }
  function selectTheme(t: "system" | "light" | "dark") {
    close();
    setThemeState(t);
  }
</script>

<Command.Dialog open={open} onOpenChange={handleOpenChange}>
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
      <Command.Item onSelect={() => selectTheme("system")}>
        <Monitor class="mr-2 size-4" /> System
      </Command.Item>
      <Command.Item onSelect={() => selectTheme("light")}>
        <Sun class="mr-2 size-4" /> Light
      </Command.Item>
      <Command.Item onSelect={() => selectTheme("dark")}>
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
