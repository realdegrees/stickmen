<script lang="ts">
	import { StickmenStage, type StickmanHandle } from '$lib/index.js';

	let stage: ReturnType<typeof StickmenStage>;
	let stickmen: StickmanHandle[] = $state([]);
	let eventLog: string[] = $state([]);
	let showDebug = $state(false);

	function log(msg: string) {
		eventLog = [...eventLog.slice(-19), msg];
	}

	function spawnWanderer() {
		const colors = ['cyan', 'violet', 'magenta', 'blue', 'green', 'orange', 'red'] as const;
		const color = colors[Math.floor(Math.random() * colors.length)];
		const fig = stage.spawn({ behavior: 'wander', color });
		fig.on('statechange', ({ from, to }) => log(`${fig.id}: ${from} -> ${to}`));
		fig.on('proximity', ({ otherId, distance }) =>
			log(`${fig.id} near ${otherId} (${Math.round(distance)}px)`)
		);
		stickmen = [...stickmen, fig];
	}

	function spawnFollower() {
		const fig = stage.spawn({ behavior: 'follow', color: 'magenta' });
		fig.on('statechange', ({ from, to }) => log(`${fig.id}: ${from} -> ${to}`));
		stickmen = [...stickmen, fig];
	}

	function clearAll() {
		stage.clear();
		stickmen = [];
	}
</script>

<div class="page">
	<header>
		<h1>stickmen</h1>
		<p>Animated stick figures that walk, climb, and explore your web pages.</p>
	</header>

	<nav class="controls">
		<button onclick={spawnWanderer}>+ Wanderer</button>
		<button onclick={spawnFollower}>+ Follower</button>
		<button onclick={clearAll}>Clear All</button>
		<label>
			<input type="checkbox" bind:checked={showDebug} />
			Debug
		</label>
	</nav>

	<StickmenStage
		bind:this={stage}
		selector="[data-walkable]"
		debug={showDebug}
		proximityThreshold={50}
	>
		<div class="demo-content">
			<div class="card" data-walkable>
				<h2>Drop-in Component</h2>
				<p>Add &lt;StickmenStage&gt; to any page. Stickmen walk on elements you mark with <code>data-walkable</code>.</p>
			</div>

			<div class="card-row">
				<div class="card small" data-walkable>
					<h3>Pathfinding</h3>
					<p>A* with jump and rope edges</p>
				</div>
				<div class="card small" data-walkable>
					<h3>Physics</h3>
					<p>Gravity, ragdoll, surface snap</p>
				</div>
				<div class="card small" data-walkable>
					<h3>Behaviors</h3>
					<p>Wander, follow, target, idle</p>
				</div>
			</div>

			<hr data-walkable />

			<div class="card wide" data-walkable>
				<h3>Pluggable Everything</h3>
				<p>Custom animations, hats, behaviors, and colors. All registerable at runtime.</p>
			</div>

			<div class="card-row">
				<div class="card small" data-walkable>
					<h3>Rope Traversal</h3>
					<p>Verlet rope physics</p>
				</div>
				<div class="card small" data-walkable>
					<h3>10 Hats</h3>
					<p>Procedurally drawn</p>
				</div>
				<div class="card small" data-walkable>
					<h3>Events</h3>
					<p>State, proximity, lifecycle</p>
				</div>
			</div>

			<hr data-walkable />

			<div class="card" data-walkable>
				<h3>Flee System</h3>
				<p>Set <code>fig.fleeFrom</code> to make stickmen run away. Works as an overlay on any behavior.</p>
			</div>
		</div>
	</StickmenStage>

	<section class="event-log">
		<h3>Event Log</h3>
		<div class="log-entries">
			{#each eventLog as entry}
				<div class="log-entry">{entry}</div>
			{/each}
			{#if eventLog.length === 0}
				<div class="log-entry dim">Spawn some stickmen to see events...</div>
			{/if}
		</div>
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
		margin-bottom: 2rem;
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

	.controls {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
		margin-bottom: 2rem;
		flex-wrap: wrap;
		align-items: center;
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

	label {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.875rem;
		color: #888;
		cursor: crosshair;
	}

	.demo-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.card {
		background: #141414;
		border: 1px solid #2a2a2a;
		border-radius: 8px;
		padding: 1.5rem;
	}

	.card h2 {
		margin: 0 0 0.5rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 1.25rem;
		color: #fff;
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

	.card-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1rem;
	}

	.card.small {
		padding: 1rem;
	}

	.card.wide {
		width: 100%;
	}

	hr {
		border: none;
		border-top: 1px solid #2a2a2a;
		margin: 0;
	}

	.event-log {
		margin-top: 2rem;
		background: #0a0a0a;
		border: 1px solid #1a1a1a;
		border-radius: 8px;
		padding: 1rem;
	}

	.event-log h3 {
		margin: 0 0 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.875rem;
		color: #666;
	}

	.log-entries {
		max-height: 200px;
		overflow-y: auto;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.75rem;
	}

	.log-entry {
		padding: 0.2rem 0;
		color: #666;
		border-bottom: 1px solid #111;
	}

	.log-entry.dim {
		color: #444;
		font-style: italic;
	}

	@media (max-width: 700px) {
		.card-row {
			grid-template-columns: 1fr;
		}
	}
</style>
