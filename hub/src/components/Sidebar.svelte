<script lang="ts">
  import { onMount } from "svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import CreateSpaceForm from "./CreateSpaceForm.svelte";
  import { getSpaces, loadSpaces, addSpace } from "$lib/stores/spaces.svelte";

  let { currentPath = "/" }: { currentPath?: string } = $props();

  let hubHost = $state("");
  let createOpen = $state(false);
  let pinned = $state(true);

  const spaces = $derived(getSpaces());

  onMount(async () => {
    hubHost = window.__hubHost;
    pinned = localStorage.getItem("sidebar-pinned") === "true";
    try {
      await loadSpaces();
    } catch {
      // handled by empty state
    }
  });

  function togglePin() {
    pinned = !pinned;
    localStorage.setItem("sidebar-pinned", String(pinned));
  }

  function handleCreated(space: Parameters<typeof addSpace>[0]) {
    addSpace(space);
  }

  const isActive = (path: string) => currentPath === path;
  const initial = (name: string) => name.charAt(0).toUpperCase();
  const labelClass = $derived("transition-opacity duration-200 " + (pinned ? "" : "hidden group-hover/sidebar:inline"));
  const navItemClass = $derived("pl-[14px] pr-2");
</script>

<CreateSpaceForm bind:open={createOpen} onCreated={handleCreated} />

<aside class="group/sidebar flex flex-col h-screen {pinned ? 'w-48' : 'w-14 hover:w-48'} shrink-0 border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-200 overflow-hidden">
  <div class="flex items-center h-12 px-3 shrink-0">
    <img src="/excalihub-icon.png" class="size-10 shrink-0" alt="ExcaliHub" />
    <span class={labelClass + " ml-2 text-sm font-hand font-semibold"}>
      ExcaliHub
    </span>
    <button
      onclick={togglePin}
      class={labelClass + " ml-auto flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer shrink-0"}
      title={pinned ? "Unpin sidebar" : "Pin sidebar"}
    >
      {#if pinned}
        <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m11 17-5-5 5-5"/><path d="m18 17-5-5 5-5"/></svg>
      {:else}
        <svg class="size-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m13 17 5-5-5-5"/><path d="m6 17 5-5-5-5"/></svg>
      {/if}
    </button>
  </div>

  <nav class="flex flex-col gap-0.5 px-1.5 shrink-0">
    <a
      href="/"
      class="flex items-center gap-2.5 h-8 {navItemClass} rounded-md text-sm transition-colors
        {isActive('/') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
    >
      <svg class="size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
      <span class={labelClass}>Spaces</span>
    </a>
    <a
      href="/archived"
      class="flex items-center gap-2.5 h-8 {navItemClass} rounded-md text-sm transition-colors
        {isActive('/archived') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
    >
      <svg class="size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
      <span class={labelClass}>Archived</span>
    </a>
    <a
      href="/settings"
      class="flex items-center gap-2.5 h-8 {navItemClass} rounded-md text-sm transition-colors
        {isActive('/settings') ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}"
    >
      <svg class="size-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
      <span class={labelClass}>Settings</span>
    </a>
  </nav>

  <div class="mx-3 my-2 h-px bg-sidebar-border shrink-0"></div>

  <div class="flex flex-col gap-0.5 px-1.5 overflow-y-auto flex-1 min-h-0">
    <span class={labelClass + " px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider"}>
      Spaces
    </span>
    {#each spaces as space (space.id)}
      <a
        href="http://{space.subdomain}.{hubHost}"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 h-7 px-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
      >
        <span class="size-1.5 rounded-full bg-sidebar-primary shrink-0"></span>
        <span class="size-5 rounded-md bg-sidebar-accent text-[11px] font-medium flex items-center justify-center shrink-0">
          {initial(space.name)}
        </span>
        <span class={labelClass + " truncate"}>
          {space.name}
        </span>
      </a>
    {/each}
    {#if spaces.length === 0}
      <p class={labelClass + " px-2 py-1 text-xs text-muted-foreground"}>
        No spaces yet
      </p>
    {/if}
  </div>

  <div class="mx-3 my-2 h-px bg-sidebar-border shrink-0"></div>

  <div class="flex flex-col gap-0.5 px-1.5 shrink-0">
    <button
      onclick={() => (createOpen = true)}
      class="flex items-center gap-2.5 h-8 {navItemClass} rounded-md text-sm font-medium bg-sidebar-primary text-sidebar-primary-foreground hover:opacity-90 transition-opacity cursor-pointer"
    >
      <span class="size-4 flex items-center justify-center shrink-0">+</span>
      <span class={labelClass}>Create Space</span>
    </button>
  </div>

  <div class="mx-3 my-2 h-px bg-sidebar-border shrink-0"></div>

  <div class="flex items-center h-12 px-3 shrink-0">
    <ThemeToggle />
  </div>
</aside>
