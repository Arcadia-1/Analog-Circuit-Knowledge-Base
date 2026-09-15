<script lang="ts">
  /** Small tooltip above (x, y) inside a Plot. `translate` percentages are the tip's own size, so CSS keeps it inside the plot. */
  let { x, y, width, text }: { x: number; y: number; width: number; text: string } = $props();
</script>

<div
  class="tip"
  style:left="{x}px"
  style:top="{y - 8}px"
  style:max-width="{width - 4}px"
  style:translate="clamp({2 - x}px, -50%, calc({width - 2 - x}px - 100%)) max(-100%, {10 - y}px)"
>{text}</div>

<style>
  .tip { position: absolute; pointer-events: none; background: var(--ink); color: var(--ground); font: 12px/1.35 var(--mono); padding: 5px 8px; border-radius: 6px; width: max-content; z-index: 2; }
</style>
