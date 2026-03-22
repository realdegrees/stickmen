<script lang="ts">
	import { onMount } from 'svelte';
	import { StickmenEngine, type SpawnOptions } from './engine/engine.js';
	import type { AnimationResolver } from './engine/animations/types.js';
	import type { HatDef } from './engine/hats.js';
	import type { BehaviorDef } from './engine/behaviors/types.js';
	import type { Point } from './engine/types.js';
	import { StickmanHandle } from './handle.js';
	import { EventEmitter, type StickmanEventMap } from './events.js';
	import type { Snippet } from 'svelte';

	interface Props {
		selector?: string;
		ignoreSelector?: string;
		debug?: boolean;
		paused?: boolean;
		animations?: AnimationResolver[];
		hats?: HatDef[];
		behaviors?: BehaviorDef[];
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
		behaviors = undefined,
		proximityThreshold = 60,
		children,
		class: className = ''
	}: Props = $props();

	let containerEl: HTMLElement;
	let canvasEl: HTMLCanvasElement;
	let engine: StickmenEngine | null = null;
	let handles = new Map<string, StickmanHandle>();

	// ── Reactive updates ─────────────────────────────────────────

	$effect(() => {
		if (engine) engine.setDebug(debug);
	});

	$effect(() => {
		if (engine) engine.paused = paused;
	});

	// ── Public API (via bind:this) ───────────────────────────────

	export function spawn(options: SpawnOptions = {}): StickmanHandle {
		if (!engine) throw new Error('StickmenStage not mounted yet');

		const emitter = new EventEmitter<StickmanEventMap>();
		const entry = engine.spawn(options, emitter);
		const handle = new StickmanHandle(entry.id, engine, emitter);
		handles.set(entry.id, handle);
		return handle;
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

	export function registerBehavior(behavior: BehaviorDef): void {
		engine?.registerBehavior(behavior);
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

		// Register custom behaviors
		if (behaviors) {
			for (const b of behaviors) {
				engine.registerBehavior(b);
			}
		}

		engine.setDebug(debug);
		engine.init(containerEl, canvasEl);

		// Track mouse for follow behavior
		const onMouseMove = (e: MouseEvent) => {
			if (!engine || !containerEl) return;
			const rect = containerEl.getBoundingClientRect();
			const x = e.clientX - rect.left + containerEl.scrollLeft;
			const y = e.clientY - rect.top + containerEl.scrollTop;

			for (const entry of handles.values()) {
				if (entry.alive && entry.behavior === 'follow' && entry.followTarget === null) {
					// Auto-feed mouse position to follow-behavior stickmen
					const stickmanEntry = engine.getEntry(entry.id);
					if (stickmanEntry) {
						stickmanEntry.controller.followTarget = { x, y };
					}
				}
			}
		};

		containerEl.addEventListener('mousemove', onMouseMove);

		return () => {
			containerEl.removeEventListener('mousemove', onMouseMove);
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
