/**
 * StickmenEngine — Container-scoped orchestrator.
 *
 * No singleton. Each instance owns its own canvas, navgrid, and stickmen.
 * Multiple engines on one page are fully independent.
 */

import { CanvasRenderer } from './renderer.js';
import { NavGrid } from './navgrid.js';
import { Stickman, createStickman } from './stickman.js';
import { SpeechBubbleStack } from './speech-bubble.js';
import { AnimationRegistry } from './animations/registry.js';
import type { AnimationResolver } from './animations/types.js';
import { HatRegistry } from './hats.js';
import type { HatDef } from './hats.js';
import { StickmanActions } from './actions.js';
import { StickmanPhysics } from './physics.js';
import { StickmanController } from './controller.js';
import type { ColorInput, HSL, BodyScale, Point, Renderable, PostProcessFn, StickmanSnapshot } from './types.js';
import { resolveColor } from './types.js';
import { type DeepPartial, type ResolvedStickmenConfig, type StickmenConfig, resolveConfig, DEFAULT_CONFIG } from './config.js';
import type { EventEmitter, StickmanEventMap } from '../events.js';
import type { StickmanBehavior, BehaviorInput } from './behaviors/types.js';

// ── Types ────────────────────────────────────────────────────────────

export interface SpawnOptions {
	id?: string;
	behavior?: BehaviorInput;
	color?: ColorInput;
	hat?: string | false;
	speed?: number;
	bodyScale?: Partial<BodyScale>;
	position?: Point;
	nearElement?: HTMLElement;
	proximityRadius?: number;
}

export interface StickmanEntry {
	id: string;
	fig: Stickman;
	actions: StickmanActions;
	physics: StickmanPhysics;
	controller: StickmanController;
	emitter: EventEmitter<StickmanEventMap>;
	proximityRadius: number;
	prevAnimState: string;
}

// ── Engine ───────────────────────────────────────────────────────────

export class StickmenEngine {
	private renderer: CanvasRenderer | null = null;
	private grid: NavGrid;
	private canvas: HTMLCanvasElement | null = null;
	private _container: HTMLElement | null = null;

	readonly animationRegistry: AnimationRegistry;
	readonly hatRegistry: HatRegistry;

	private stickmen = new Map<string, StickmanEntry>();
	private speechStacks = new Map<string, SpeechBubbleStack>();
	private nextId = 0;

	private _initialized = false;
	private _destroyed = false;
	private _paused = false;

	private resizeObserver: ResizeObserver | null = null;
	private mutationObserver: MutationObserver | null = null;
	private rebuildTimeout: ReturnType<typeof setTimeout> | null = null;
	private debugRenderable: Renderable | null = null;

	debug = false;
	defaultProximityThreshold = 60;

	private _postProcessFn: PostProcessFn | null = null;

	private _config: ResolvedStickmenConfig;

	constructor(config?: DeepPartial<StickmenConfig>) {
		this._config = resolveConfig(config);
		this.grid = new NavGrid(this._config);
		this.animationRegistry = new AnimationRegistry();
		this.hatRegistry = new HatRegistry();
	}

	/** Update the engine config at runtime. Triggers a navgrid rebuild and
	 *  propagates physics/stamina values to all active stickmen. */
	updateConfig(partial: DeepPartial<StickmenConfig>): void {
		this._config = resolveConfig(partial);
		this.grid.updateConfig(this._config);

		// Propagate physics and stamina to all existing stickmen
		for (const entry of this.stickmen.values()) {
			entry.physics.updateConfig(this._config.physics);
			entry.controller.updateConfig(this._config.stamina);
		}

		if (this._initialized) {
			this.rebuildGrid();
		}
	}

	get config(): ResolvedStickmenConfig {
		return this._config;
	}

	// ── Initialization ───────────────────────────────────────────────

	init(container: HTMLElement, canvas: HTMLCanvasElement): void {
		if (this._initialized) return;

		this._container = container;
		this.canvas = canvas;
		this.grid.setContainer(container);

		this.renderer = new CanvasRenderer(canvas);
		this.resizeCanvas();

		// Debug overlay — add if debug was already enabled before init
		if (this.debug) {
			this.debugRenderable = this.createDebugRenderable();
			this.renderer.addRenderable(this.debugRenderable);
		}

		// Scan grid synchronously so surfaces exist before any spawns
		this.rebuildGrid();

		this.renderer.onTick = (dt) => this.tick(dt);
		this.renderer.onPostProcess = (ctx, delta) => {
			if (!this._postProcessFn || !this.canvas) return;
			this._postProcessFn(ctx, {
				stickmen: this.collectSnapshots(),
				delta,
				canvas: this.canvas
			});
		};
		this.renderer.start();

		// Auto-rebuild on container resize
		this.resizeObserver = new ResizeObserver(() => {
			this.resizeCanvas();
			this.scheduleRebuild();
		});
		this.resizeObserver.observe(container);

		// Auto-rebuild on DOM changes within container
		this.mutationObserver = new MutationObserver(() => {
			this.scheduleRebuild();
		});
		this.mutationObserver.observe(container, { childList: true, subtree: true });

		// Deferred re-scan for late-rendering DOM elements
		setTimeout(() => {
			this.resizeCanvas();
			this.rebuildGrid();
		}, 200);

		this._initialized = true;
	}

	destroy(): void {
		if (this._destroyed) return;

		this.resizeObserver?.disconnect();
		this.mutationObserver?.disconnect();
		if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);

		this.renderer?.destroy();
		this.stickmen.clear();
		this._destroyed = true;
		this._initialized = false;
	}

	get initialized(): boolean {
		return this._initialized;
	}

	get container(): HTMLElement | null {
		return this._container;
	}

	set paused(value: boolean) {
		this._paused = value;
		if (value) {
			this.renderer?.stop();
		} else if (this._initialized) {
			this.renderer?.start();
		}
	}

	get paused(): boolean {
		return this._paused;
	}

	// ── Grid ─────────────────────────────────────────────────────────

	rebuildGrid(): void {
		this.grid.scan();

		// Update physics surface queries and bounds for all stickmen
		const query = this.grid.getSurfaceQuery();
		const bounds = this.getContainerBounds();
		for (const entry of this.stickmen.values()) {
			entry.physics.findSurface = query;
			entry.physics.surfaces = this.grid.surfaces;
			if (bounds) entry.physics.containerBounds = bounds;
		}
	}

	private getContainerBounds(): { width: number; height: number } | null {
		if (!this._container) return null;
		return {
			width: this._container.scrollWidth,
			height: this._container.scrollHeight
		};
	}

	private scheduleRebuild(): void {
		if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);
		this.rebuildTimeout = setTimeout(() => {
			this.resizeCanvas();
			this.rebuildGrid();
		}, 200);
	}

	// ── Registration ─────────────────────────────────────────────────

	registerAnimation(resolver: AnimationResolver): void {
		this.animationRegistry.register(resolver);
	}

	registerHat(hat: HatDef): void {
		this.hatRegistry.register(hat);
	}

	// ── Post-Processing ─────────────────────────────────────────────

	setPostProcess(fn: PostProcessFn | null): void {
		this._postProcessFn = fn;
	}

	private collectSnapshots(): StickmanSnapshot[] {
		const snapshots: StickmanSnapshot[] = [];
		for (const [id, entry] of this.stickmen) {
			const fig = entry.fig;
			snapshots.push({
				id,
				x: fig.x,
				y: fig.y,
				pose: fig.getCurrentPose(),
				animationId: fig.animationId,
				direction: fig.direction,
				color: fig.color,
				rotation: fig.rotation,
				active: fig.active
			});
		}
		return snapshots;
	}

	// ── Spawn / Remove ───────────────────────────────────────────────

	spawn(
		options: SpawnOptions,
		emitter: EventEmitter<StickmanEventMap>
	): StickmanEntry {
		const id = options.id ?? `stickman-${this.nextId++}`;

		// Remove existing with same ID
		if (this.stickmen.has(id)) {
			this.remove(id);
		}

		// Resolve color
		const color: HSL = options.color
			? resolveColor(options.color)
			: resolveColor('cyan');

		// Resolve hat
		let hatDef: HatDef | undefined;
		if (options.hat === false) {
			hatDef = undefined;
		} else if (options.hat) {
			hatDef = this.hatRegistry.get(options.hat);
		} else {
			hatDef = this.hatRegistry.getRandom();
		}

		// Determine spawn position
		let spawnX: number;
		let spawnY: number;

		if (options.position) {
			spawnX = options.position.x;
			spawnY = options.position.y;
		} else if (options.nearElement && this._container) {
			const elRect = options.nearElement.getBoundingClientRect();
			const cRect = this._container.getBoundingClientRect();
			spawnX = elRect.left + elRect.width / 2 - cRect.left;
			spawnY = elRect.top - cRect.top;
		} else {
			// Find a surface to spawn on
			const pos = this.findSpawnPosition();
			spawnX = pos.x;
			spawnY = pos.y;
		}

		// Create stickman with optional overrides
		const fig = createStickman(spawnX, spawnY, color, this.animationRegistry, hatDef);

		if (options.speed !== undefined) {
			// Override speed via object assignment (readonly in class, but we own it)
			(fig as { speedMultiplier: number }).speedMultiplier = options.speed;
		}
		if (options.bodyScale) {
			const clamp = (v: number) => Math.max(0.5, Math.min(v, this._config.stickman.maxBodyScale));
			const s = fig.bodyScale;
			if (options.bodyScale.legLength !== undefined) (s as { legLength: number }).legLength = clamp(options.bodyScale.legLength);
			if (options.bodyScale.armLength !== undefined) (s as { armLength: number }).armLength = clamp(options.bodyScale.armLength);
			if (options.bodyScale.headSize !== undefined) (s as { headSize: number }).headSize = clamp(options.bodyScale.headSize);
		}

		const actions = new StickmanActions(fig);
		const surfaceQuery = this.grid.getSurfaceQuery();
		const physics = new StickmanPhysics(fig, surfaceQuery, this._config.physics);
		physics.surfaces = this.grid.surfaces;
		const bounds = this.getContainerBounds();
		if (bounds) physics.containerBounds = bounds;
		const controller = new StickmanController(actions, physics, this.grid, this._config.stamina);

		if (this.debug) controller.debug = true;

		this.renderer?.addRenderable(fig);

		const entry: StickmanEntry = {
			id,
			fig,
			actions,
			physics,
			controller,
			emitter,
			proximityRadius: options.proximityRadius ?? this.defaultProximityThreshold,
			prevAnimState: 'idle'
		};

		this.stickmen.set(id, entry);
		emitter.emit('spawned', {});

		return entry;
	}

	remove(id: string): void {
		const entry = this.stickmen.get(id);
		if (!entry) return;

		entry.controller.detachCurrentBehavior();
		entry.actions.cancel();
		entry.fig.active = false;
		this.renderer?.removeRenderable(entry.fig);
		entry.emitter.emit('destroyed', {});
		this.stickmen.delete(id);

		// Speech stack is tied to fig.active — it will auto-cull from the renderer
		// on the next tick. Remove from our map so it can be GC'd.
		this.speechStacks.delete(id);
	}

	// ── Dialogue ─────────────────────────────────────────────────────

	/**
	 * Show a speech bubble above the stickman with the given id.
	 * @param durationMs - Duration in milliseconds.
	 * @param suspendPath - When true, the active path is suspended until the bubble expires.
	 */
	say(id: string, text: string, durationMs: number, suspendPath = false): void {
		const entry = this.stickmen.get(id);
		if (!entry || !this.renderer) return;

		let stack = this.speechStacks.get(id);
		if (!stack) {
			stack = new SpeechBubbleStack(entry.fig);
			this.speechStacks.set(id, stack);
			this.renderer.addRenderable(stack);
		}

		let onExpire: (() => void) | undefined;
		if (suspendPath) {
			const activePath = entry.controller.currentPath;
			activePath?.suspend();
			onExpire = () => activePath?.resume();
		}

		stack.say(text, durationMs, onExpire);
	}

	getEntry(id: string): StickmanEntry | undefined {
		return this.stickmen.get(id);
	}

	getAllIds(): string[] {
		return Array.from(this.stickmen.keys());
	}

	// ── Tick ─────────────────────────────────────────────────────────

	private tick(dt: number): void {
		if (this._paused) return;

		// Update all controllers
		for (const entry of this.stickmen.values()) {
			entry.controller.update(dt);

			// Animation state change events
			const currentAnim = entry.fig.animationId;
			if (currentAnim !== entry.prevAnimState) {
				entry.emitter.emit('statechange', {
					from: entry.prevAnimState,
					to: currentAnim
				});
				entry.prevAnimState = currentAnim;
			}
		}

		// Add new action renderables
		for (const entry of this.stickmen.values()) {
			const renderables = entry.controller.getRenderables();
			for (const r of renderables) {
				this.renderer?.addRenderable(r);
			}
		}

		// Update renderables (rope physics/fade)
		if (this.renderer) {
			for (const r of this.renderer.renderables) {
				if ('update' in r && typeof (r as { update: (dt: number) => void }).update === 'function') {
					(r as { update: (dt: number) => void }).update(dt);
				}
			}

			// Remove inactive
			this.renderer.renderables = this.renderer.renderables.filter((r) => r.active);
		}

		// Proximity detection
		this.checkProximity();
	}

	private checkProximity(): void {
		const entries = Array.from(this.stickmen.values());

		for (let i = 0; i < entries.length; i++) {
			for (let j = i + 1; j < entries.length; j++) {
				const a = entries[i];
				const b = entries[j];

				// Check if either has proximity listeners
				if (!a.emitter.hasListeners('proximity') && !b.emitter.hasListeners('proximity')) {
					continue;
				}

				const dx = a.fig.x - b.fig.x;
				const dy = a.fig.y - b.fig.y;
				const distSq = dx * dx + dy * dy;

				const threshold = Math.max(a.proximityRadius, b.proximityRadius);
				if (distSq < threshold * threshold) {
					const dist = Math.sqrt(distSq);
					a.emitter.emit('proximity', { otherId: b.id, distance: dist });
					b.emitter.emit('proximity', { otherId: a.id, distance: dist });
				}
			}
		}
	}

	// ── Canvas Sizing ────────────────────────────────────────────────

	private resizeCanvas(): void {
		if (!this._container || !this.renderer) return;

		const width = this._container.scrollWidth;
		const height = this._container.scrollHeight;
		this.renderer.resize(width, height);
	}

	private findSpawnPosition(): Point {
		if (this.grid.surfaces.length > 0) {
			// Pick a random surface and a random point on it
			const surface =
				this.grid.surfaces[Math.floor(Math.random() * this.grid.surfaces.length)];
			const x = surface.x1 + Math.random() * (surface.x2 - surface.x1);
			return { x, y: surface.y1 };
		}

		return { x: 100, y: 100 };
	}

	// ── Debug ────────────────────────────────────────────────────────

	setDebug(enabled: boolean): void {
		this.debug = enabled;
		for (const entry of this.stickmen.values()) {
			entry.controller.debug = enabled;
		}

		if (!this.renderer) return;

		if (enabled && !this.debugRenderable) {
			this.debugRenderable = this.createDebugRenderable();
			this.renderer.addRenderable(this.debugRenderable);
		} else if (!enabled && this.debugRenderable) {
			this.renderer.removeRenderable(this.debugRenderable);
			this.debugRenderable = null;
		}
	}

	private createDebugRenderable(): Renderable {
		const self = this;
		return {
			get position() {
				return { x: 0, y: 0 };
			},
			get active() {
				// Always active — lifecycle managed by setDebug add/remove
				return true;
			},
			draw(ctx: CanvasRenderingContext2D) {
				self.grid.drawDebug(ctx);

				for (const entry of self.stickmen.values()) {
					entry.controller.drawDebug(ctx);
				}
			}
		};
	}
}
