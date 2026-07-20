<script lang="ts">
  import { Monitor, Moon, Sun } from "@lucide/svelte";

  type Theme = "system" | "light" | "dark";

  let theme: Theme = $state("system");

  function getSystemTheme(): "light" | "dark" {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(t: Theme) {
    const resolved = t === "system" ? getSystemTheme() : t;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }

  function cycle() {
    const order: Theme[] = ["system", "light", "dark"];
    theme = order[(order.indexOf(theme) + 1) % 3];
    localStorage.setItem("theme", theme);
    applyTheme(theme);
  }

  $effect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    theme = saved || "system";
    applyTheme(theme);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });
</script>

<button
  onclick={cycle}
  class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
