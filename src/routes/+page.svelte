<script lang="ts">
	import { onMount } from 'svelte';
	import { StickmenStage, Behaviours, type StickmanHandle } from '$lib/index.js';
	import AnimationEditor from './AnimationEditor.svelte';
	import HatBuilder from './HatBuilder.svelte';

	// ── Stage refs ───────────────────────────────────────────────────
	let walkStage: ReturnType<typeof StickmenStage>;
	let jumpStage: ReturnType<typeof StickmenStage>;
	let ropeVStage: ReturnType<typeof StickmenStage>;
	let swingStage: ReturnType<typeof StickmenStage>;
	let playground: ReturnType<typeof StickmenStage>;

	// ── Global state ─────────────────────────────────────────────────
	let wanderers: StickmanHandle[] = $state([]);
	let followers: StickmanHandle[] = $state([]);
	let showDebug = $state(false);
	let hoveredSection: string | null = $state(null);
	let canHover = $state(true);



	function debugFor(section: string): boolean {
		return showDebug && (!canHover || hoveredSection === section);
	}

	onMount(() => {
		canHover = window.matchMedia('(hover: hover)').matches;

		walkStage.spawn({ behavior: Behaviours.Follow, color: 'cyan' });
		jumpStage.spawn({ behavior: Behaviours.Follow, color: 'violet' });
		ropeVStage.spawn({ behavior: Behaviours.Follow, color: 'orange' });
		swingStage.spawn({ behavior: Behaviours.Follow, color: 'magenta' });
	});

	function spawnWanderer() {
		const colors = ['cyan', 'violet', 'magenta', 'blue', 'green', 'orange', 'red'] as const;
		const color = colors[Math.floor(Math.random() * colors.length)];
		const fig = playground.spawn({ behavior: Behaviours.Wander, color });
		wanderers = [...wanderers, fig];
	}

	function spawnFollower() {
		const fig = playground.spawn({ behavior: Behaviours.Follow, color: 'magenta' });
		followers = [...followers, fig];
	}

	function removeWanderers() {
		wanderers.forEach(s => s.destroy());
		wanderers = [];
	}

	function removeFollowers() {
		followers.forEach(s => s.destroy());
		followers = [];
	}

</script>

<div class="page">
	<header>
		<h1>stickmen</h1>
		<p>Animated stick figures that walk, climb, and explore your web pages.</p>
	</header>

	<!-- ── Intro ──────────────────────────────────────────────────── -->

	<section class="intro">
		<p>Each section below demonstrates a different movement mechanic. Hover over a section — the stickman follows your cursor.</p>
		<label class="toggle-label">
			<span class="toggle-track">
				<input type="checkbox" bind:checked={showDebug} />
				<span class="toggle-thumb"></span>
			</span>
			<span class="toggle-text">Debug</span>
		</label>
	</section>

	<!-- ── Walking ────────────────────────────────────────────────── -->

	<section
		class="demo-section"
		role="group"
		aria-label="Walking demo"
		onmouseenter={() => hoveredSection = 'walk'}
		onmouseleave={() => hoveredSection = null}
	>
		<h2 class="demo-label">Walking</h2>
		<StickmenStage bind:this={walkStage} selector="[data-walkable]" debug={debugFor('walk')}>
			<div class="demo-walk">
				<div class="card" data-walkable="top">
					<h3>Surface Traversal</h3>
					<p>Stickmen walk along any element marked with <code>data-walkable</code>. A* pathfinding computes the shortest route across all connected surfaces.</p>
				</div>
			</div>
		</StickmenStage>
	</section>

	<!-- ── Jumping ────────────────────────────────────────────────── -->

	<section
		class="demo-section"
		role="group"
		aria-label="Jumping demo"
		onmouseenter={() => hoveredSection = 'jump'}
		onmouseleave={() => hoveredSection = null}
	>
		<h2 class="demo-label">Jumping</h2>
		<StickmenStage bind:this={jumpStage} selector="[data-walkable]" debug={debugFor('jump')}>
			<div class="demo-jump">
				<div class="jump-row">
					<div class="card small" data-walkable="top">
						<h3>Horizontal Gaps</h3>
						<p>Gaps up to 100px between surfaces are automatically bridged with jump edges.</p>
					</div>
					<div class="card small" data-walkable="top">
						<h3>Vertical Gaps</h3>
						<p>Height differences up to 64px are jumpable — stickmen leap between layers.</p>
					</div>
					<div class="card small offset-down" data-walkable="top">
						<h3>Auto Detection</h3>
						<p>Jump connections are computed from the DOM layout. No manual configuration needed.</p>
					</div>
				</div>
			</div>
		</StickmenStage>
	</section>

	<!-- ── Rope — Vertical ───────────────────────────────────────── -->

	<section
		class="demo-section"
		role="group"
		aria-label="Vertical rope demo"
		onmouseenter={() => hoveredSection = 'rope-v'}
		onmouseleave={() => hoveredSection = null}
	>
		<h2 class="demo-label">Rope — Vertical Traversal</h2>
		<StickmenStage bind:this={ropeVStage} selector="[data-walkable]" debug={debugFor('rope-v')}>
			<div class="demo-rope-v">
				<div class="card rope-card" data-walkable="bottom">
					<h3>Rappel Down</h3>
					<p>Piton-anchored descent with rope weight simulation. The rope reacts naturally to the stickman's movement.</p>
				</div>
				<div class="card rope-card" data-walkable="top">
					<h3>Rope Throw</h3>
					<p>Verlet rope physics for climbing tall vertical gaps. A piton anchors above and the stickman climbs the simulated rope.</p>
				</div>
			</div>
		</StickmenStage>
	</section>

	<!-- ── Rope — Horizontal Swing ───────────────────────────────── -->

	<section
		class="demo-section"
		role="group"
		aria-label="Horizontal rope swing demo"
		onmouseenter={() => hoveredSection = 'swing'}
		onmouseleave={() => hoveredSection = null}
	>
		<h2 class="demo-label">Rope — Horizontal Swing</h2>
		<StickmenStage bind:this={swingStage} selector="[data-walkable]" debug={debugFor('swing')}>
			<div class="demo-swing">
				<div class="platform" data-walkable="bottom">
					<h3>Rope Swing</h3>
					<p>Piton thrown to the far side. The stickman drops and swings across on a physics-simulated rope.</p>
				</div>
				<div class="platform" data-walkable="bottom">
					<h3>Landing</h3>
					<p>Natural pendulum arc carries the stickman across. After settling, they climb up to the target.</p>
				</div>
			</div>
		</StickmenStage>
	</section>

	<!-- ── Playground ─────────────────────────────────────────────── -->

	<section
		class="demo-section"
		role="group"
		aria-label="Playground"
		onmouseenter={() => hoveredSection = 'playground'}
		onmouseleave={() => hoveredSection = null}
	>
		<h2 class="demo-label">Playground</h2>
		<nav class="controls">
			<div class="control-group">
				<button onclick={spawnWanderer}>Add Wanderer</button>
			{#if wanderers.length > 0}
				<button class="delete-btn" onclick={removeWanderers} title="Remove all wanderers">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
					</button>
				{/if}
			</div>
			<div class="control-group">
				<button onclick={spawnFollower}>Add Mouse Follower</button>
				{#if followers.length > 0}
					<button class="delete-btn" onclick={removeFollowers} title="Remove all followers">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
					</button>
				{/if}
			</div>
		</nav>
		<StickmenStage
			bind:this={playground}
			selector="[data-walkable]"
			debug={debugFor('playground')}
			proximityThreshold={50}
		>
			<div class="demo-content">
				<div class="card" data-walkable>
					<h3>Getting Started</h3>
					<p>Add the component to any Svelte page. Child elements marked with <code>data-walkable</code> become surfaces.</p>
					<pre class="code-block"><code>&lt;script&gt;
  import {'{'} StickmenStage {'}'} from 'stickmen';
  let stage;
&lt;/script&gt;

&lt;StickmenStage bind:this={'{'}stage{'}'} selector="[data-walkable]"&gt;
  &lt;div data-walkable&gt;I'm a walkable surface!&lt;/div&gt;
&lt;/StickmenStage&gt;</code></pre>
				</div>

				<div class="card-row">
					<div class="card small" data-walkable>
						<h3>Spawning</h3>
						<p>Create stickmen with behavior, color, and hat options.</p>
					<pre class="code-block"><code>const fig = stage.spawn({'{'}
  behavior: Behaviours.Wander,
  color: 'cyan',
  hat: 'cowboy'
{'}'});</code></pre>
				</div>
				<div class="card small" data-walkable>
					<h3>Targeting</h3>
					<p>Navigate to a point or follow the cursor with a behavior.</p>
					<pre class="code-block"><code>fig.pathTo(300, 100);

// Or follow the cursor:
stage.spawn({'{'} behavior: Behaviours.Follow {'}'});</code></pre>
					</div>
					<div class="card small" data-walkable>
						<h3>Configuration</h3>
						<p>Customize scanning, debug overlay, and proximity events.</p>
						<pre class="code-block"><code>&lt;StickmenStage
  selector="[data-walkable]"
  debug={'{'}true{'}'}
  proximityThreshold={'{'}80{'}'}
/&gt;</code></pre>
					</div>
				</div>

				<details class="expandable" data-walkable>
					<summary data-walkable>
						<h3>Live Grid Updates</h3>
						<p>Click to reveal new surfaces — the navigation grid rebuilds automatically when the DOM changes.</p>
					</summary>
					<div class="expand-content">
						<div class="card small" data-walkable>
							<h3>Surface A</h3>
							<p>Dynamically added</p>
						</div>
						<div class="card small" data-walkable>
							<h3>Surface B</h3>
							<p>New walkable area</p>
						</div>
						<div class="card small" data-walkable>
							<h3>Surface C</h3>
							<p>Appears on expand</p>
						</div>
					</div>
				</details>

				<div class="card" data-walkable>
					<h3>Child Elements</h3>
					<p>Any element inside the stage can be a surface. Cards, headers, dividers, code blocks — if it has <code>data-walkable</code>, stickmen will walk on it. Use <code>autoDetectBorders</code> to scan visible borders automatically.</p>
				</div>
			</div>
		</StickmenStage>
	</section>

	<!-- ── Animation Editor ──────────────────────────────────────── -->

	<section id="animation-editor" class="editor-section">
		<h2 class="editor-heading">Animation Editor</h2>
		<p class="editor-sub">Author keyframe animations and copy the generated code.</p>
		<AnimationEditor />
	</section>

	<section id="hat-builder" class="editor-section">
		<h2 class="editor-heading">Hat Builder</h2>
		<p class="editor-sub">Compose custom hat accessories from shape primitives and copy the generated code.</p>
		<HatBuilder />
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #0c0c0c;
		color: #e0e0e0;
		font-family: 'Inter', system-ui, sans-serif;
	}

	.page {
		max-width: 900px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	header h1 {
		font-family: 'JetBrains Mono', monospace;
		font-size: 2.5rem;
		margin: 0;
		color: #fff;
	}

	header p {
		color: #888;
		margin: 0.5rem 0 0;
	}

	/* ── Intro ────────────────────────────────────────────────────── */

	.intro {
		text-align: center;
		margin-bottom: 2.5rem;
		padding: 1.25rem 1.5rem;
		background: #111;
		border: 1px solid #1e1e1e;
		border-radius: 8px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.intro p {
		margin: 0;
		color: #777;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	/* ── Toggle switch ────────────────────────────────────────────── */

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		cursor: crosshair;
		user-select: none;
	}

	.toggle-track {
		position: relative;
		display: inline-block;
		width: 36px;
		height: 20px;
		background: #2a2a2a;
		border-radius: 10px;
		transition: background 0.2s;
	}

	.toggle-track input {
		opacity: 0;
		width: 0;
		height: 0;
		position: absolute;
	}

	.toggle-thumb {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: #666;
		border-radius: 50%;
		transition: transform 0.2s, background 0.2s;
	}

	.toggle-track input:checked + .toggle-thumb {
		transform: translateX(16px);
		background: #8f8;
	}

	.toggle-track:has(input:checked) {
		background: #1a3a1a;
	}

	.toggle-text {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		color: #666;
		letter-spacing: 0.04em;
	}

	/* ── Demo sections ───────────────────────────────────────────── */

	.demo-section {
		margin-bottom: 2.5rem;
	}

	.demo-label {
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		font-weight: 500;
		color: #555;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin: 0 0 0.75rem;
	}

	/* ── Card base ───────────────────────────────────────────────── */

	.card {
		background: #141414;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.card h3 {
		margin: 0 0 0.5rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 1rem;
		color: #fff;
	}

	.card p {
		margin: 0;
		color: #888;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.card code {
		background: #1a1a1a;
		padding: 0.15rem 0.35rem;
		border-radius: 3px;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		color: #aaa;
	}

	.card.small {
		padding: 1rem;
	}

	/* ── Walking ──────────────────────────────────────────────────── */

	.demo-walk {
		padding-top: 40px;
	}

	/* ── Jumping ──────────────────────────────────────────────────── */

	.demo-jump {
		padding-top: 55px;
		padding-bottom: 15px;
	}

	.jump-row {
		display: flex;
		gap: 70px;
		align-items: flex-start;
	}

	.jump-row .card {
		flex: 1;
		min-width: 0;
	}

	.offset-down {
		margin-top: 45px;
	}

	/* ── Rope vertical ───────────────────────────────────────────── */

	.demo-rope-v {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 120px;
		padding-top: 40px;
	}

	.rope-card {
		width: 55%;
	}

	/* ── Rope swing ──────────────────────────────────────────────── */

	.demo-swing {
		display: flex;
		justify-content: center;
		gap: 250px;
		align-items: flex-start;
		padding-top: 50px;
		min-height: 300px;
	}

	.platform {
		background: #141414;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		padding: 1rem 1.25rem;
		width: 170px;
	}

	.platform h3 {
		margin: 0 0 0.35rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
		color: #fff;
	}

	.platform p {
		margin: 0;
		color: #888;
		font-size: 0.75rem;
		line-height: 1.4;
	}

	/* ── Playground ───────────────────────────────────────────────── */

	.controls {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		margin-bottom: 1rem;
		flex-wrap: wrap;
		align-items: center;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.delete-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.4rem;
		background: transparent;
		border: 1px solid #333;
		border-radius: 4px;
		color: #888;
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.delete-btn:hover {
		color: #ff4d4d;
		border-color: #ff4d4d;
	}

	button {
		background: #1a1a1a;
		color: #e0e0e0;
		border: 1px solid #333;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: crosshair;
		font-size: 0.875rem;
		font-family: 'JetBrains Mono', monospace;
		transition: border-color 0.2s;
	}

	button:hover {
		border-color: #666;
	}

	.demo-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.card-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	/* ── Code blocks ──────────────────────────────────────────────── */

	.code-block {
		background: #0c0c0c;
		border: 1px solid #222;
		border-radius: 6px;
		padding: 0.75rem 1rem;
		margin: 0.75rem 0 0;
		overflow-x: auto;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
		line-height: 1.6;
		color: #999;
	}

	.code-block code {
		background: none;
		padding: 0;
		border-radius: 0;
		font-size: inherit;
		color: inherit;
	}

	/* ── Expandable card ─────────────────────────────────────────── */

	.expandable {
		background: #141414;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
	}

	.expandable summary {
		padding: 1.5rem;
		cursor: crosshair;
		list-style: none;
		user-select: none;
	}

	.expandable summary::-webkit-details-marker {
		display: none;
	}

	.expandable summary h3 {
		margin: 0 0 0.5rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 1rem;
		color: #fff;
	}

	.expandable summary h3::before {
		content: '\25B8  ';
		color: #555;
	}

	.expandable[open] summary h3::before {
		content: '\25BE  ';
	}

	.expandable summary p {
		margin: 0;
		color: #888;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.expand-content {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
		padding: 0 1.5rem 1.5rem;
	}

	/* ── Animation editor section ───────────────────────────────── */

	.editor-section {
		margin-top: 3rem;
		margin-bottom: 2rem;
	}

	.editor-heading {
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.1rem;
		font-weight: 500;
		color: #ccc;
		margin: 0 0 0.35rem;
	}

	.editor-sub {
		color: #555;
		font-size: 0.85rem;
		margin: 0 0 1.25rem;
	}

	/* ── Responsive ──────────────────────────────────────────────── */

	@media (max-width: 700px) {
		.jump-row {
			flex-direction: column;
			gap: 1rem;
		}

		.offset-down {
			margin-top: 0;
		}

		.card-row,
		.expand-content {
			grid-template-columns: 1fr;
		}

		.rope-card {
			width: 80%;
		}

		.demo-swing {
			gap: 80px;
			min-height: 250px;
		}

		.platform {
			width: 120px;
		}
	}
</style>
