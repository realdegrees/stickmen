/**
 * StickmenConfig — Unified configuration for the stickmen engine.
 *
 * All numeric constants that previously lived as module-level `const` values
 * in navgrid.ts, physics.ts, stamina.ts, and controller.ts are consolidated
 * here into a single typed, deep-partial-overridable config object.
 *
 * Usage:
 *   <StickmenStage config={{ navgrid: { nodeSpacing: 60 }, physics: { gravity: 0.002 } }} />
 *
 * All fields are optional — unspecified values fall back to their defaults.
 * Derived navgrid values (topMargin, jumpMaxDy, tallElementThreshold,
 * ropeHorizontalMargin) are auto-computed from stickman dimensions unless
 * explicitly provided.
 */

// ── Utility Types ────────────────────────────────────────────────────

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

// ── Sub-config interfaces ────────────────────────────────────────────

export interface StickmanSizeConfig {
	/** Head circle radius in px (default: 3) */
	headRadius: number;
	/** Neck bone length in px (default: 2) */
	neckLength: number;
	/** Torso bone length in px (default: 8) */
	torsoLength: number;
	/** Upper arm bone length in px (default: 5) */
	upperArmLength: number;
	/** Forearm bone length in px (default: 4) */
	forearmLength: number;
	/** Upper leg bone length in px (default: 6) */
	upperLegLength: number;
	/** Lower leg bone length in px (default: 5) */
	lowerLegLength: number;
	/** Half shoulder span in px (default: 4) */
	shoulderWidth: number;
	/** Half hip span in px (default: 3) */
	hipWidth: number;
	/** Canvas line width for bones in px (default: 1.5) */
	strokeWidth: number;
	/**
	 * Maximum body scale multiplier applied to individual stickmen.
	 * NavGrid uses this to compute worst-case safety margins so the largest
	 * possible stickman fits within the container. (default: 1.2)
	 */
	maxBodyScale: number;
}

export interface NavGridConfig {
	/**
	 * Comma-separated list of additional CSS selectors for walkable elements.
	 * Elements with the `data-walkable` attribute are always force-included
	 * regardless of this value — use this to add extra elements by tag name,
	 * class, or any other CSS selector (e.g. `'button,.tag,hr'`).
	 */
	selector: string;
	/** CSS selector to exclude from scanning */
	ignoreSelector?: string;
	/** When true, scan all elements for visible borders (default: false) */
	autoDetectBorders: boolean;
	/** Distance in px between nav nodes placed along a surface (default: 40) */
	nodeSpacing: number;
	/** Minimum DOM element width in px to be considered as a surface (default: 15) */
	minElementWidth: number;
	/** Minimum CSS border-width in px to count as a border surface (default: 0.5) */
	minBorderWidth: number;
	/** Max horizontal gap in px between surfaces that can be jumped (default: 100) */
	jumpMaxGap: number;
	/** Interior subdivision count for jump edge placement along overlap regions (default: 4) */
	jumpConnectionSegments: number;
	/** Max horizontal gap in px between two surfaces on the same Y to merge them (default: 15) */
	surfaceMergeGap: number;
	/** Max Y difference in px between two surfaces for them to be merge-candidates (default: 2) */
	surfaceMergeYTolerance: number;
	/** Extra A* cost per intermediate surface layer a rope edge must cross (default: 150) */
	ropeLayerPenalty: number;
	/**
	 * Min distance from container top in px for a surface to be walkable.
	 * Auto-computed as stickmanMaxHeight + headRadius if not set.
	 */
	topMargin?: number;
	/**
	 * Max vertical height difference in px for a jump edge.
	 * Auto-computed as stickmanMaxHeight * 2 if not set.
	 */
	jumpMaxDy?: number;
	/**
	 * Element height threshold above which bottom edges are also registered as surfaces.
	 * Auto-computed as stickmanMaxHeight * 3 if not set.
	 */
	tallElementThreshold?: number;
	/**
	 * Max horizontal distance in px between nodes to be candidates for rope edges.
	 * Auto-computed as nodeSpacing * 0.8 if not set.
	 */
	ropeHorizontalMargin?: number;
}

export interface PhysicsConfig {
	/** Gravity acceleration per ms² during free-fall (default: 0.0012) */
	gravity: number;
	/** Horizontal velocity drag factor per frame (default: 0.998) */
	airDrag: number;
	/** Gravity for ragdoll Verlet joints (default: 0.0015) */
	ragdollGravity: number;
	/** Per-frame Verlet velocity damping (default: 0.96) */
	ragdollDamping: number;
	/** Bone distance constraint solve iterations per frame (default: 3) */
	ragdollConstraintIterations: number;
	/** Landing velocity above which ragdoll is triggered (default: 0.4) */
	ragdollImpactThreshold: number;
	/** ms feet must be on surface before recovering from ragdoll (default: 300) */
	ragdollRecoveryDelay: number;
	/** Fraction of vertical velocity reflected on surface bounce (default: 0.3) */
	ragdollRestitution: number;
	/** Max px below stickman to look for a landing surface during fall (default: 200) */
	surfaceSearchRadius: number;
	/** Squared velocity below which ragdoll is considered motionless (default: 0.5) */
	motionlessThresholdSq: number;
	/** ms a motionless ragdoll waits before force-recovering (default: 1500) */
	ragdollMotionlessTimeout: number;
	/** px beyond container boundary before triggering OOB reset (default: 50) */
	oobMargin: number;
	/**
	 * Horizontal grace distance in px added to both sides of a platform edge when
	 * deciding whether a grounded stickman has walked off. Prevents float-precision
	 * jitter from triggering a fall while the foot is still visually on the edge.
	 * Auto-computed as headRadius * maxBodyScale if not set explicitly.
	 */
	groundedEdgeGrace: number;
	/**
	 * Vertical grace distance in px used when raycasting for a surface beneath the
	 * stickman's feet. The query origin is shifted upward by this amount so that
	 * sub-pixel float drift (foot sitting fractionally above the surface) does not
	 * break the grounded check. Kept very small (default: 2) — matching the existing
	 * 2 px downward penetration tolerance in SurfaceQuery — so the stickman is never
	 * considered grounded before their feet visually reach the surface.
	 */
	groundedVerticalGrace: number;
}

export interface StaminaConfig {
	/** Stamina per second drained while sprinting (default: 0.2) */
	drainRate: number;
	/** Stamina per second regenerated while idle (default: 0.1) */
	regenBase: number;
	/** Stamina per second regenerated while moving (default: 0.2) */
	regenActive: number;
	/** Stamina level required to begin sprinting (default: 0.8) */
	sprintStart: number;
	/** Stamina level at which sprint stops (default: 0.5) */
	sprintStop: number;
	/** Consecutive walk edges required to trigger sprint intent (default: 3) */
	sprintMinWalkEdges: number;
	/** Speed multiplier when sprinting (default: 1.5) */
	sprintSpeedFactor: number;
}

// ── Top-level config ─────────────────────────────────────────────────

export interface StickmenConfig {
	/** Stickman bone dimensions and maximum body scale */
	stickman: StickmanSizeConfig;
	/** NavGrid scanning, surface detection, and pathfinding constants */
	navgrid: NavGridConfig;
	/** Physics, gravity, and ragdoll constants */
	physics: PhysicsConfig;
	/** Stamina and sprint constants */
	stamina: StaminaConfig;
}

// ── Resolved NavGrid config (derived values filled in) ──────────────

export interface ResolvedNavGridConfig extends NavGridConfig {
	/** Resolved: min distance from container top for a walkable surface */
	topMargin: number;
	/** Resolved: max vertical height difference for a jump edge */
	jumpMaxDy: number;
	/** Resolved: element height threshold for bottom-edge surfaces */
	tallElementThreshold: number;
	/** Resolved: max horizontal distance between nodes for rope edges */
	ropeHorizontalMargin: number;
}

/** Fully resolved config with all derived values computed */
export interface ResolvedStickmenConfig extends StickmenConfig {
	navgrid: ResolvedNavGridConfig;
}

// ── Defaults ─────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: StickmenConfig = {
	stickman: {
		headRadius: 3,
		neckLength: 2,
		torsoLength: 8,
		upperArmLength: 5,
		forearmLength: 4,
		upperLegLength: 6,
		lowerLegLength: 5,
		shoulderWidth: 4,
		hipWidth: 3,
		strokeWidth: 1.5,
		maxBodyScale: 1.2
	},
	navgrid: {
		selector: '',
		ignoreSelector: undefined,
		autoDetectBorders: false,
		nodeSpacing: 40,
		minElementWidth: 15,
		minBorderWidth: 0.5,
		jumpMaxGap: 100,
		jumpConnectionSegments: 4,
		surfaceMergeGap: 15,
		surfaceMergeYTolerance: 2,
		ropeLayerPenalty: 150
		// topMargin, jumpMaxDy, tallElementThreshold, ropeHorizontalMargin are derived
	},
	physics: {
		gravity: 0.0012,
		airDrag: 0.998,
		ragdollGravity: 0.0015,
		ragdollDamping: 0.96,
		ragdollConstraintIterations: 3,
		ragdollImpactThreshold: 0.4,
		ragdollRecoveryDelay: 300,
		ragdollRestitution: 0.3,
		surfaceSearchRadius: 200,
		motionlessThresholdSq: 0.5,
		ragdollMotionlessTimeout: 1500,
		oobMargin: 50,
		// Derived in resolveConfig from headRadius * maxBodyScale; placeholder here
		groundedEdgeGrace: 0,
		groundedVerticalGrace: 2
	},
	stamina: {
		drainRate: 0.2,
		regenBase: 0.1,
		regenActive: 0.2,
		sprintStart: 0.8,
		sprintStop: 0.5,
		sprintMinWalkEdges: 3,
		sprintSpeedFactor: 1.5
	}
};

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Compute the maximum stickman height in px from a stickman size config.
 * Used for NavGrid safety margins.
 */
export function computeStickmanMaxHeight(s: StickmanSizeConfig): number {
	return Math.ceil(
		(s.upperLegLength + s.lowerLegLength + s.torsoLength + s.neckLength + s.headRadius) *
			s.maxBodyScale
	);
}

/**
 * Compute the maximum stickman half-width in px from a stickman size config.
 * Used to inset walkable surface edges.
 */
export function computeStickmanHalfWidth(s: StickmanSizeConfig): number {
	return Math.ceil((s.shoulderWidth + s.upperArmLength) * s.maxBodyScale);
}

// ── resolveConfig ────────────────────────────────────────────────────

/**
 * Deep-merge a partial config with defaults and compute all derived navgrid values.
 *
 * Derived values (topMargin, jumpMaxDy, tallElementThreshold, ropeHorizontalMargin)
 * are auto-computed from stickman dimensions. If explicitly provided in the partial
 * config, the explicit value wins.
 */
export function resolveConfig(partial?: DeepPartial<StickmenConfig>): ResolvedStickmenConfig {
	// Deep merge each sub-config
	const stickman: StickmanSizeConfig = {
		...DEFAULT_CONFIG.stickman,
		...partial?.stickman
	};

	const navgridPartial: DeepPartial<NavGridConfig> = partial?.navgrid ?? {};
	const navgridBase: NavGridConfig = {
		...DEFAULT_CONFIG.navgrid,
		...navgridPartial
	};

	const physicsPartial: DeepPartial<PhysicsConfig> = partial?.physics ?? {};
	const physics: PhysicsConfig = {
		...DEFAULT_CONFIG.physics,
		...physicsPartial,
		// Auto-compute groundedEdgeGrace from head size unless explicitly overridden
		groundedEdgeGrace:
			physicsPartial.groundedEdgeGrace ??
			stickman.headRadius * stickman.maxBodyScale
	};

	const stamina: StaminaConfig = {
		...DEFAULT_CONFIG.stamina,
		...partial?.stamina
	};

	// Compute derived navgrid values from stickman dimensions
	const stickmanMaxHeight = computeStickmanMaxHeight(stickman);

	const navgrid: ResolvedNavGridConfig = {
		...navgridBase,
		topMargin: navgridPartial.topMargin ?? stickmanMaxHeight + stickman.headRadius,
		jumpMaxDy: navgridPartial.jumpMaxDy ?? stickmanMaxHeight * 2,
		tallElementThreshold: navgridPartial.tallElementThreshold ?? stickmanMaxHeight * 3,
		ropeHorizontalMargin: navgridPartial.ropeHorizontalMargin ?? navgridBase.nodeSpacing * 0.8
	};

	return { stickman, navgrid, physics, stamina };
}
