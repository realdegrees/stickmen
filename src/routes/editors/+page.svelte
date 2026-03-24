<script lang="ts">
	import AnimationEditor from '$editors/AnimationEditor.svelte';
	import HatBuilder from '$editors/HatBuilder.svelte';
</script>

<div class="editors-page">
	<header>
		<h1>Editors</h1>
		<p class="subtitle">Author custom animations and hat accessories, then copy the generated JSON into your project.</p>
		<p class="cli-hint">
			These editors are also available locally via the CLI:
			<code>npx stickmen animation-editor</code> or
			<code>npx stickmen hat-builder</code>
		</p>
	</header>

	<section class="editor-section">
		<h2 class="editor-heading">Animation Editor</h2>
		<p class="editor-sub">Author keyframe animations and copy the generated code.</p>
		<AnimationEditor />
	</section>

	<section class="editor-section">
		<h2 class="editor-heading">Hat Builder</h2>
		<p class="editor-sub">Compose custom hat accessories from shape primitives and copy the generated code.</p>
		<HatBuilder />
	</section>
</div>

<style>
	.editors-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		margin-bottom: 2.5rem;
	}

	h1 {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.6rem;
		font-weight: 400;
		color: #e0e0e0;
		letter-spacing: -0.02em;
		margin: 0 0 0.5rem;
	}

	.subtitle {
		font-size: 0.85rem;
		color: #555;
		line-height: 1.5;
		margin: 0 0 0.75rem;
	}

	.cli-hint {
		font-size: 0.72rem;
		color: #383838;
		line-height: 1.6;
		margin: 0;
	}

	.cli-hint code {
		font-family: 'JetBrains Mono', monospace;
		background: #141414;
		border: 1px solid #1e1e1e;
		padding: 0.12rem 0.35rem;
		border-radius: 3px;
		color: #666;
		font-size: 0.68rem;
	}

	.editor-section {
		margin-bottom: 3rem;
	}

	.editor-heading {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1rem;
		font-weight: 400;
		color: #999;
		letter-spacing: -0.01em;
		margin: 0 0 0.35rem;
	}

	.editor-sub {
		font-size: 0.75rem;
		color: #444;
		margin: 0 0 1rem;
	}
</style>
