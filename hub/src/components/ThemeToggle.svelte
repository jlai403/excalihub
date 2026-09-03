<script lang="ts">
  import { Monitor, Moon, Sun } from "@lucide/svelte";
  import { type Theme, applyTheme, getTheme, setTheme } from "$lib/utils/theme";

  let theme: Theme = $state("system");

  function cycle() {
    const order: Theme[] = ["system", "light", "dark"];
    theme = order[(order.indexOf(theme) + 1) % 3];
    setTheme(theme);
  }

  $effect(() => {
    const initial = getTheme();
    theme = initial;
    applyTheme(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });
</script>

<button
  onclick={cycle}
  class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
  title="Theme: {theme}"
>
  {#if theme === "system"}
    <Monitor class="size-4" />
  {:else if theme === "light"}
    <Sun class="size-4" />
  {:else}
    <Moon class="size-4" />
  {/if}
</button>
