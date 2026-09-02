<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";

	let {
		children,
		...restProps
	}: TooltipPrimitive.TriggerProps & { children: Snippet } = $props();
</script>

<TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...restProps}>
	{@render children?.()}
</TooltipPrimitive.Trigger>
