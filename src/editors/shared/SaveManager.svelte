<script lang="ts">
	interface Props {
		/** Current item's ID */
		itemId: string;
		/** Is save disabled (e.g. nothing to save)? */
		saveDisabled: boolean;
		/** Sorted list of saved items */
		savedList: { id: string; label?: string }[];
		/** Callbacks */
		onsave: () => void;
		onload: (id: string) => void;
		ondelete: (id: string) => void;
		onimport: () => void;
		/** Additional settings content */
		children?: import('svelte').Snippet;
	}

	let { itemId, saveDisabled, savedList, onsave, onload, ondelete, onimport, children }: Props = $props();
</script>

<!-- Settings -->
<div class="ed-section">
	<div class="ed-section-hdr-row">
		<h4 class="ed-section-hdr">Settings</h4>
		<div class="ed-section-actions">
			<button class="ed-btn ed-btn-save" onclick={onsave} disabled={saveDisabled}>save</button>
			<button class="ed-btn" onclick={onimport}>load json</button>
		</div>
	</div>
	{#if children}
		{@render children()}
	{/if}
</div>

<!-- Saved items -->
{#if savedList.length > 0}
<div class="ed-section">
	<h4 class="ed-section-hdr">Saved</h4>
	<div class="ed-list">
		{#each savedList as entry}
			<div class="ed-saved-row">
				<button class="ed-preset ed-saved-load" onclick={() => onload(entry.id)}>
					{entry.label || entry.id}
				</button>
				<button class="ed-btn ed-btn-danger ed-saved-del" onclick={() => ondelete(entry.id)}>del</button>
			</div>
		{/each}
	</div>
</div>
{/if}

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

	.ed-section-hdr-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.55rem;
	}
	.ed-section-hdr-row .ed-section-hdr { margin-bottom: 0; }

	.ed-section-actions {
		display: flex;
		gap: 0.3rem;
	}

	.ed-btn {
		background: none;
		border: 1px solid #1e1e1e;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.18rem 0.45rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.12s, color 0.12s;
		white-space: nowrap;
	}
	.ed-btn:hover:not(:disabled) { border-color: #383838; color: #aaa; }
	.ed-btn:disabled { opacity: 0.26; cursor: default; }

	.ed-btn-save {
		color: hsl(190, 55%, 42%);
		border-color: hsl(190, 40%, 18%);
	}
	.ed-btn-save:hover:not(:disabled) {
		border-color: hsl(190, 50%, 28%);
		color: hsl(190, 70%, 62%);
	}

	.ed-btn-danger { color: #555; }
	.ed-btn-danger:hover:not(:disabled) { border-color: hsl(0,40%,28%); color: hsl(0,58%,52%); }

	.ed-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ed-saved-row {
		display: flex;
		align-items: center;
		gap: 3px;
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

	.ed-saved-load {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ed-saved-del {
		flex-shrink: 0;
		padding: 0.18rem 0.38rem;
		font-size: 0.62rem;
	}
</style>
