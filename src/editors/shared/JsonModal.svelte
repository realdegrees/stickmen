<script lang="ts">
	interface Props {
		title: string;
		placeholder?: string;
		onconfirm: (value: string) => void;
		oncancel: () => void;
	}

	let { title, placeholder = 'Paste JSON here...', onconfirm, oncancel }: Props = $props();

	let value = $state('');
	let textarea: HTMLTextAreaElement;

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') { oncancel(); return; }
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { submit(); return; }
	}

	function submit() {
		const trimmed = value.trim();
		if (!trimmed) return;
		onconfirm(trimmed);
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) oncancel();
	}

	// Auto-focus textarea when modal mounts
	$effect(() => {
		if (textarea) textarea.focus();
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="jm-backdrop" onclick={onBackdropClick}>
	<div class="jm-panel" role="dialog" aria-modal="true" aria-label={title}>
		<div class="jm-header">
			<span class="jm-title">{title}</span>
			<button class="jm-close" onclick={oncancel} aria-label="Close">
				<svg width="10" height="10" viewBox="0 0 10 10" fill="none">
					<line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
					<line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
				</svg>
			</button>
		</div>
		<textarea
			bind:this={textarea}
			bind:value
			class="jm-textarea"
			{placeholder}
			spellcheck="false"
			autocomplete="off"
		></textarea>
		<div class="jm-footer">
			<span class="jm-hint">ctrl+enter to confirm · esc to cancel</span>
			<div class="jm-actions">
				<button class="jm-btn jm-btn-cancel" onclick={oncancel}>cancel</button>
				<button class="jm-btn jm-btn-confirm" onclick={submit} disabled={!value.trim()}>load</button>
			</div>
		</div>
	</div>
</div>

<style>
	.jm-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.72);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		backdrop-filter: blur(2px);
		animation: jm-fade-in 0.1s ease;
	}

	@keyframes jm-fade-in {
		from { opacity: 0; }
		to   { opacity: 1; }
	}

	.jm-panel {
		background: #0d0d0d;
		border: 1px solid #252525;
		border-radius: 6px;
		width: 420px;
		max-width: calc(100vw - 2rem);
		display: flex;
		flex-direction: column;
		font-family: 'JetBrains Mono', monospace;
		box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03);
		animation: jm-slide-in 0.12s ease;
	}

	@keyframes jm-slide-in {
		from { transform: translateY(-6px); opacity: 0; }
		to   { transform: translateY(0);    opacity: 1; }
	}

	.jm-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.6rem 0.75rem 0.5rem;
		border-bottom: 1px solid #1a1a1a;
		flex-shrink: 0;
	}

	.jm-title {
		font-size: 0.6rem;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.jm-close {
		background: none;
		border: none;
		color: #333;
		cursor: crosshair;
		padding: 2px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 3px;
		transition: color 0.1s;
	}
	.jm-close:hover { color: #777; }

	.jm-textarea {
		flex: 1;
		background: #080808;
		border: none;
		border-bottom: 1px solid #1a1a1a;
		color: #8a8a8a;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		line-height: 1.65;
		padding: 0.65rem 0.75rem;
		resize: none;
		outline: none;
		min-height: 160px;
		max-height: 360px;
		overflow-y: auto;
		tab-size: 2;
	}
	.jm-textarea::placeholder {
		color: #252525;
	}
	.jm-textarea:focus {
		color: #aaa;
	}

	.jm-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.45rem 0.75rem;
		flex-shrink: 0;
	}

	.jm-hint {
		font-size: 0.52rem;
		color: #242424;
		letter-spacing: 0.04em;
	}

	.jm-actions {
		display: flex;
		gap: 0.35rem;
	}

	.jm-btn {
		background: none;
		border: 1px solid #1e1e1e;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		padding: 0.22rem 0.55rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.12s, color 0.12s;
	}

	.jm-btn-cancel {
		color: #444;
	}
	.jm-btn-cancel:hover { border-color: #333; color: #888; }

	.jm-btn-confirm {
		color: hsl(190, 55%, 42%);
		border-color: hsl(190, 40%, 18%);
	}
	.jm-btn-confirm:hover:not(:disabled) {
		border-color: hsl(190, 50%, 28%);
		color: hsl(190, 70%, 62%);
	}
	.jm-btn-confirm:disabled {
		opacity: 0.25;
		cursor: default;
	}
</style>
