<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		children,
		...restProps
	}: TooltipPrimitive.ProviderProps & { children: Snippet } = $props();
</script>

<TooltipPrimitive.Provider {...restProps}>
	{@render children?.()}
</TooltipPrimitive.Provider>
