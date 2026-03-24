<script lang="ts">
	interface Props {
		code: string;
		isEmpty: boolean;
		filename: string;
	}

	let { code, isEmpty, filename }: Props = $props();

	async function copyCode() { await navigator.clipboard.writeText(code); }

	function downloadJson() {
		if (isEmpty) return;
		const blob = new Blob([code], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = filename; a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="ed-code">
	<div class="ed-code-hdr">
		<span class="ed-code-lbl">generated json</span>
		<div class="ed-code-actions">
			<button class="ed-copy" onclick={copyCode} disabled={isEmpty}>copy</button>
			<button class="ed-copy" onclick={downloadJson} disabled={isEmpty}>download</button>
		</div>
	</div>
	<pre class="ed-code-body">{code}</pre>
</div>

<style>
	.ed-code {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 80px;
	}

	.ed-code-hdr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.75rem;
		border-top: 1px solid #181818;
		flex-shrink: 0;
	}

	.ed-code-lbl {
		font-size: 0.6rem;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.ed-code-actions {
		display: flex;
		gap: 0.3rem;
	}

	.ed-copy {
		background: none;
		border: 1px solid #1e1e1e;
		color: #484848;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		padding: 0.12rem 0.45rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.15s, color 0.15s;
	}
	.ed-copy:hover:not(:disabled) { border-color: #383838; color: #999; }
	.ed-copy:disabled { opacity: 0.25; cursor: default; }

	.ed-code-body {
		flex: 1;
		margin: 0;
		padding: 0.5rem 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		color: #555;
		line-height: 1.6;
		white-space: pre;
		overflow: auto;
	}
</style>
