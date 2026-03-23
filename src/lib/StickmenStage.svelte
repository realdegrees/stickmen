<script lang="ts">
	import { onMount } from 'svelte';
	import { StickmenEngine, type SpawnOptions } from './engine/engine.js';
	import type { AnimationResolver } from './engine/animations/types.js';
	import type { HatDef } from './engine/hats.js';
	import type { PostProcessFn } from './engine/types.js';
	import { StickmanHandle } from './handle.js';
	import { EventEmitter, type StickmanEventMap } from './events.js';
	import { WanderBehavior } from './engine/behaviors/defaults.js';
	import type { BehaviorInput, StickmanBehavior } from './engine/behaviors/types.js';
	import type { Snippet } from 'svelte';

	function resolveBehavior(input: BehaviorInput | undefined): StickmanBehavior {
		if (!input) return new WanderBehavior();
		if (typeof input === 'function') return new (input as new () => StickmanBehavior)();
		return input;
	}

	interface Props {
		selector?: string;
		ignoreSelector?: string;
		debug?: boolean;
		paused?: boolean;
		animations?: AnimationResolver[];
		hats?: HatDef[];
		postProcess?: PostProcessFn;
		proximityThreshold?: number;
		children?: Snippet;
		class?: string;
	}

	let {
		selector = '[data-walkable]',
		ignoreSelector = undefined,
		debug = false,
		paused = false,
		animations = undefined,
		hats = undefined,
		postProcess = undefined,
		proximityThreshold = 60,
		children,
		class: className = ''
	}: Props = $props();

	let containerEl: HTMLElement;
	let canvasEl: HTMLCanvasElement;
	let engine: StickmenEngine | null = $state(null);
	let handles = new Map<string, StickmanHandle>();

	// ── Reactive updates ─────────────────────────────────────────

	$effect(() => {
		if (engine) engine.setDebug(debug);
	});

	$effect(() => {
		if (engine) engine.paused = paused;
	});

	$effect(() => {
		if (engine) engine.setPostProcess(postProcess ?? null);
	});

	// ── Public API (via bind:this) ───────────────────────────────

	export function spawn(options: SpawnOptions = {}): StickmanHandle {
		if (!engine) throw new Error('StickmenStage not mounted yet');

		const emitter = new EventEmitter<StickmanEventMap>();
		const entry = engine.spawn(options, emitter);
		const handle = new StickmanHandle(entry.id, engine, emitter);
		handles.set(entry.id, handle);

		// Attach behavior now that handle exists (needed for BehaviorHandle.container).
		// Accepts a class constructor or instance; defaults to WanderBehavior.
		entry.controller.attachBehavior(resolveBehavior(options.behavior), handle);

		return handle;
	}

	export function getContainer(): HTMLElement {
		return containerEl;
	}

	export function clear(): void {
		if (!engine) return;
		for (const id of engine.getAllIds()) {
			const handle = handles.get(id);
			if (handle) handle.destroy();
		}
		handles.clear();
	}

	export function rebuild(): void {
		engine?.rebuildGrid();
	}

	export function getAll(): StickmanHandle[] {
		return Array.from(handles.values()).filter((h) => h.alive);
	}

	export function get(id: string): StickmanHandle | undefined {
		const handle = handles.get(id);
		return handle?.alive ? handle : undefined;
	}

	export function registerAnimation(resolver: AnimationResolver): void {
		engine?.registerAnimation(resolver);
	}

	export function registerHat(hat: HatDef): void {
		engine?.registerHat(hat);
	}

	// ── Lifecycle ────────────────────────────────────────────────

	onMount(() => {
		engine = new StickmenEngine({
			selector,
			ignoreSelector,
		});

		engine.defaultProximityThreshold = proximityThreshold;

		// Register custom animations
		if (animations) {
			for (const anim of animations) {
				engine.registerAnimation(anim);
			}
		}

		// Register custom hats
		if (hats) {
			for (const hat of hats) {
				engine.registerHat(hat);
			}
		}

		engine.init(containerEl, canvasEl);
		engine.setDebug(debug);

		return () => {
			clear();
			engine?.destroy();
			engine = null;
		};
	});
</script>

<div
	bind:this={containerEl}
	class="stickmen-stage {className}"
	style="position: relative; overflow: hidden;"
>
	<canvas
		bind:this={canvasEl}
		style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 9999;"
	></canvas>
	{#if children}
		{@render children()}
	{/if}
</div>
