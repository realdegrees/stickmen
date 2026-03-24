<script lang="ts">
	interface Props {
		/** List of preset keys */
		presets: { key: string; label: string }[];
		onload: (key: string) => void;
	}

	let { presets, onload }: Props = $props();
</script>

<div class="ed-section">
	<h4 class="ed-section-hdr">Presets</h4>
	<div class="ed-preset-list">
		{#each presets as p}
			<button class="ed-preset" onclick={() => onload(p.key)}>
				{p.label}
			</button>
		{/each}
	</div>
</div>

<style>
	.ed-section {
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid #181818;
		flex-shrink: 0;
	}

	.ed-section-hdr {
		font-size: 0.58rem;
		font-weight: 500;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0 0 0.55rem;
	}

	.ed-preset-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ed-preset {
		background: none;
		border: 1px solid #181818;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.26rem 0.5rem;
		text-align: left;
		cursor: crosshair;
		border-radius: 3px;
		transition: border-color 0.1s, color 0.1s;
	}
	.ed-preset:hover { border-color: #2c2c2c; color: #aaa; }
</style>
