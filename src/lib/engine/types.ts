// ── Color System ──────────────────────────────────────────────────────

export interface HSL {
	h: number;
	s: number;
	l: number;
}

export const COLOR_PRESETS = {
	cyan: { h: 190, s: 80, l: 60 },
	blue: { h: 220, s: 75, l: 55 },
	violet: { h: 270, s: 70, l: 60 },
	magenta: { h: 320, s: 80, l: 60 },
	red: { h: 0, s: 75, l: 55 },
	orange: { h: 30, s: 80, l: 55 },
	green: { h: 140, s: 70, l: 50 },
	white: { h: 0, s: 0, l: 85 }
} as const;

export type PresetColorName = keyof typeof COLOR_PRESETS;
export type ColorInput = PresetColorName | HSL;

export function resolveColor(input: ColorInput): HSL {
	if (typeof input === 'string') {
		const preset = COLOR_PRESETS[input];
		if (!preset) throw new Error(`Unknown color preset: ${input}`);
		return { ...preset };
	}
	return { ...input };
}

export function colorToHSL(color: HSL): string {
	return `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
}

export function colorToHSLA(color: HSL, alpha: number): string {
	return `hsla(${color.h}, ${color.s}%, ${color.l}%, ${alpha})`;
}

// ── Joint / Skeleton System ──────────────────────────────────────────

export type JointName =
	| 'head'
	| 'neck'
	| 'shoulderL'
	| 'shoulderR'
	| 'elbowL'
	| 'elbowR'
	| 'handL'
	| 'handR'
	| 'hip'
	| 'kneeL'
	| 'kneeR'
	| 'footL'
	| 'footR';

export const JOINT_NAMES: JointName[] = [
	'head',
	'neck',
	'shoulderL',
	'shoulderR',
	'elbowL',
	'elbowR',
	'handL',
	'handR',
	'hip',
	'kneeL',
	'kneeR',
	'footL',
	'footR'
];

export interface Joint {
	x: number;
	y: number;
}

export type Pose = Record<JointName, Joint>;

// Bone connections: pairs of joints to draw lines between
export const BONES: [JointName, JointName][] = [
	['head', 'neck'],
	['neck', 'shoulderL'],
	['neck', 'shoulderR'],
	['shoulderL', 'elbowL'],
	['shoulderR', 'elbowR'],
	['elbowL', 'handL'],
	['elbowR', 'handR'],
	['neck', 'hip'],
	['hip', 'kneeL'],
	['hip', 'kneeR'],
	['kneeL', 'footL'],
	['kneeR', 'footR']
];

// ── Body Dimensions ──────────────────────────────────────────────────

export const BASE_BODY = {
	headRadius: 3,
	neckLength: 2,
	torsoLength: 8,
	upperArmLength: 5,
	forearmLength: 4,
	upperLegLength: 6,
	lowerLegLength: 5,
	shoulderWidth: 4,
	hipWidth: 3,
	strokeWidth: 1.5
} as const;

export interface BodyScale {
	legLength: number;
	armLength: number;
	headSize: number;
}

export const DEFAULT_BODY_SCALE: BodyScale = {
	legLength: 1.0,
	armLength: 1.0,
	headSize: 1.0
};

/** Maximum supported body scale multiplier. NavGrid uses this to compute
 *  safety margins so the largest possible stickman fits within the container. */
export const MAX_BODY_SCALE = 1.2;

// ── Derived Body Dimensions ──────────────────────────────────────────

/** Maximum stickman height at the largest body scale */
export const STICKMAN_MAX_HEIGHT = Math.ceil(
	(BASE_BODY.upperLegLength +
		BASE_BODY.lowerLegLength +
		BASE_BODY.torsoLength +
		BASE_BODY.neckLength +
		BASE_BODY.headRadius) *
		MAX_BODY_SCALE
);

/** Half the maximum stickman width (shoulder + upper arm at largest scale) */
export const STICKMAN_HALF_WIDTH = Math.ceil(
	(BASE_BODY.shoulderWidth + BASE_BODY.upperArmLength) * MAX_BODY_SCALE
);

// ── Stickman Config ──────────────────────────────────────────────────

export interface StickmanConfig {
	color: HSL;
	speedMultiplier: number;
	hatId: string | null;
	bodyScale: BodyScale;
}

// ── Renderable Interface ─────────────────────────────────────────────

export interface Renderable {
	draw(ctx: CanvasRenderingContext2D): void;
	readonly position: { x: number; y: number };
	readonly active: boolean;
}

// ── Surface / Navigation Types ───────────────────────────────────────

export interface Surface {
	y: number;
	xMin: number;
	xMax: number;
	type: 'horizontal' | 'vertical';
}

export type SurfaceQuery = (x: number, y: number, searchRadius: number) => Surface | null;

export interface NavSurface {
	id: string;
	edge: 'top' | 'bottom';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	rect: { top: number; left: number; right: number; bottom: number; width: number; height: number };
}

export interface NavNode {
	id: string;
	x: number;
	y: number;
	surfaceId: string;
	t: number; // 0–1 parametric position along surface
}

export interface NavEdge {
	from: string;
	to: string;
	cost: number;
	type: 'walk' | 'jump' | 'rope' | 'rope-swing';
}

export interface NavPath {
	nodes: NavNode[];
	edges: NavEdge[];
	totalCost: number;
}

// ── Post-Processing ──────────────────────────────────────────────────

/** Read-only snapshot of a stickman's render state for post-processing. */
export interface StickmanSnapshot {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly pose: Readonly<Pose>;
	readonly animationId: string;
	readonly direction: 1 | -1;
	readonly color: Readonly<HSL>;
	readonly rotation: number;
	readonly active: boolean;
}

/** Frame data passed to the post-process hook. */
export interface PostProcessFrameData {
	readonly stickmen: readonly StickmanSnapshot[];
	readonly delta: number;
	readonly canvas: HTMLCanvasElement;
}

/** Post-process callback signature. Called after all renderables have drawn. */
export type PostProcessFn = (
	ctx: CanvasRenderingContext2D,
	frame: PostProcessFrameData
) => void;

// ── Geometry Helpers ─────────────────────────────────────────────────

export interface Point {
	x: number;
	y: number;
}

export function jointFromAngle(parent: Joint, angle: number, length: number): Joint {
	return {
		x: parent.x + Math.sin(angle) * length,
		y: parent.y + Math.cos(angle) * length
	};
}
