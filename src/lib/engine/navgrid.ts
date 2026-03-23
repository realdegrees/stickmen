/**
 * NavGrid — Container-scoped DOM surface scanner + navigation graph.
 *
 * Scans descendant elements of a container to build walkable surfaces,
 * nodes, and edges (walk/jump/rope) for pathfinding.
 */

import type { NavSurface, NavNode, NavEdge, Surface, SurfaceQuery } from './types.js';
import { BASE_BODY, STICKMAN_MAX_HEIGHT, STICKMAN_HALF_WIDTH } from './types.js';

// ── Constants (derived from body dimensions where possible) ──────────

const ROPE_LAYER_PENALTY = 150;
const MIN_ELEMENT_WIDTH = 15;
const NODE_SPACING = 40;
const MIN_BORDER_WIDTH = 0.5;

/** Minimum distance from container top for a walkable surface.
 *  Full body height + head clearance so the stickman doesn't clip. */
const TOP_MARGIN = STICKMAN_MAX_HEIGHT + BASE_BODY.headRadius;
const JUMP_MAX_GAP = 100;
const JUMP_MAX_DY = STICKMAN_MAX_HEIGHT * 2;
const ROPE_HORIZONTAL_MARGIN = NODE_SPACING * 0.8;
const TALL_ELEMENT_THRESHOLD = STICKMAN_MAX_HEIGHT * 3;
const SURFACE_MERGE_GAP = 15;
const SURFACE_MERGE_Y_TOLERANCE = 2;

// ── Config ───────────────────────────────────────────────────────────

export interface NavGridConfig {
	/** CSS selector for walkable elements (default: '[data-walkable]') */
	selector?: string;
	/** CSS selector to exclude */
	ignoreSelector?: string;
	/** When true, scan all elements for visible borders */
	autoDetectBorders?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function isEligible(el: Element): boolean {
	if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
		return false;
	}
	const style = window.getComputedStyle(el);
	if (style.position === 'fixed' || style.position === 'sticky') {
		return false;
	}
	return true;
}

function hasVisibleBottomBorder(el: Element): boolean {
	const style = window.getComputedStyle(el);
	const width = parseFloat(style.borderBottomWidth) || 0;
	if (width < MIN_BORDER_WIDTH) return false;
	if (style.borderBottomStyle === 'none' || style.borderBottomStyle === 'hidden') return false;
	const color = style.borderBottomColor;
	if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return false;
	return true;
}

function hasVisibleBorder(el: Element): { hasTop: boolean; hasBottom: boolean } {
	const style = window.getComputedStyle(el);

	const isVisible = (w: number, s: string, c: string) => {
		if (w < MIN_BORDER_WIDTH) return false;
		if (s === 'none' || s === 'hidden') return false;
		if (c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return false;
		return true;
	};

	return {
		hasTop: isVisible(
			parseFloat(style.borderTopWidth) || 0,
			style.borderTopStyle,
			style.borderTopColor
		),
		hasBottom: isVisible(
			parseFloat(style.borderBottomWidth) || 0,
			style.borderBottomStyle,
			style.borderBottomColor
		)
	};
}

function closestNodeAtX(nodes: NavNode[], targetX: number): NavNode | null {
	if (nodes.length === 0) return null;
	if (nodes.length === 1) return nodes[0];

	let lo = 0;
	let hi = nodes.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (nodes[mid].x < targetX) lo = mid + 1;
		else hi = mid;
	}

	const right = nodes[lo];
	if (lo === 0) return right;
	const left = nodes[lo - 1];
	return Math.abs(left.x - targetX) <= Math.abs(right.x - targetX) ? left : right;
}

// ── NavGrid Class ────────────────────────────────────────────────────

export class NavGrid {
	surfaces: NavSurface[] = [];
	nodes: NavNode[] = [];
	edges: NavEdge[] = [];

	private config: NavGridConfig;
	private nodeMap = new Map<string, NavNode>();
	private adjacency = new Map<string, NavEdge[]>();

	/** The container element to scope scanning to */
	private container: HTMLElement | null = null;
	private containerRect = { left: 0, top: 0 };
	private containerSize = { width: 0, height: 0 };

	constructor(config: NavGridConfig = {}) {
		this.config = config;
	}

	/** Set the container element for scoped scanning */
	setContainer(container: HTMLElement): void {
		this.container = container;
	}

	/** Rebuild the nav grid by scanning the container's descendants */
	scan(): void {
		this.surfaces = [];
		this.nodes = [];
		this.edges = [];
		this.nodeMap.clear();
		this.adjacency.clear();

		if (!this.container) return;

		const cr = this.container.getBoundingClientRect();
		this.containerRect = {
			left: cr.left + window.scrollX,
			top: cr.top + window.scrollY
		};
		this.containerSize = { width: cr.width, height: cr.height };

		this.extractSurfaces(this.queryElements());
		this.generateNodes();
		this.connectNodes();
	}

	/** Alternative: build from raw rectangles (for demos without DOM) */
	scanRects(
		rects: {
			left: number;
			top: number;
			right: number;
			bottom: number;
			width: number;
			height: number;
		}[]
	): void {
		this.surfaces = [];
		this.nodes = [];
		this.edges = [];
		this.nodeMap.clear();
		this.adjacency.clear();
		this.containerRect = { left: 0, top: 0 };

		let surfaceId = 0;
		for (const rect of rects) {
			if (rect.width >= MIN_ELEMENT_WIDTH) {
				this.surfaces.push({
					id: `s${surfaceId++}`,
					edge: 'top',
					x1: rect.left,
					y1: rect.top,
					x2: rect.right,
					y2: rect.top,
					rect
				});
			}
		}

		this.generateNodes();
		this.connectNodes();
	}

	getSurfaceQuery(): SurfaceQuery {
		return (x: number, y: number, searchRadius: number): Surface | null => {
			let best: Surface | null = null;
			let bestDist = searchRadius;

			for (const s of this.surfaces) {
				const dist = s.y1 - y;
				if (dist >= -2 && dist < bestDist && x >= s.x1 && x <= s.x2) {
					bestDist = dist;
					best = { y: s.y1, xMin: s.x1, xMax: s.x2, type: 'horizontal' };
				}
			}

			return best;
		};
	}

	findNearestNode(x: number, y: number): NavNode | null {
		let best: NavNode | null = null;
		let bestDist = Infinity;

		for (const node of this.nodes) {
			const dx = node.x - x;
			const dy = node.y - y;
			const dist = dx * dx + dy * dy;
			if (dist < bestDist) {
				bestDist = dist;
				best = node;
			}
		}

		return best;
	}

	getEdgesFrom(nodeId: string): NavEdge[] {
		return this.adjacency.get(nodeId) ?? [];
	}

	getNode(id: string): NavNode | undefined {
		return this.nodeMap.get(id);
	}

	// ── Element Discovery ────────────────────────────────────────────

	private queryElements(): Set<Element> {
		if (!this.container) return new Set();

		const elements = new Set<Element>();
		const selector = this.config.selector ?? '[data-walkable]';

		// Scan for matching elements within the container
		for (const el of this.container.querySelectorAll(selector)) {
			elements.add(el);
		}

		// Auto-detect borders mode
		if (this.config.autoDetectBorders) {
			for (const el of this.container.querySelectorAll('*')) {
				elements.add(el);
			}
		}

		// Remove ignored elements
		if (this.config.ignoreSelector) {
			for (const el of elements) {
				if (el.matches(this.config.ignoreSelector)) elements.delete(el);
			}
		}

		return elements;
	}

	// ── Surface Extraction ───────────────────────────────────────────

	private extractSurfaces(elements: Iterable<Element>): void {
		let surfaceId = 0;
		const selector = this.config.selector ?? '[data-walkable]';

		for (const el of elements) {
			if (el.tagName === 'CANVAS') continue;
			if (!isEligible(el)) continue;

			const domRect = el.getBoundingClientRect();
			if (domRect.width < MIN_ELEMENT_WIDTH) continue;
			if (domRect.width === 0 || domRect.height === 0) continue;

			// Convert to container-relative coordinates
			const rect = {
				left: domRect.left + window.scrollX - this.containerRect.left,
				top: domRect.top + window.scrollY - this.containerRect.top,
				right: domRect.right + window.scrollX - this.containerRect.left,
				bottom: domRect.bottom + window.scrollY - this.containerRect.top,
				width: domRect.width,
				height: domRect.height
			};

			// Inset surface edges from container sides so stickmen don't overflow
			rect.left = Math.max(rect.left, STICKMAN_HALF_WIDTH);
			rect.right = Math.min(rect.right, this.containerSize.width - STICKMAN_HALF_WIDTH);
			if (rect.right - rect.left < MIN_ELEMENT_WIDTH) continue;
			rect.width = rect.right - rect.left;

			const forceInclude = el.matches(selector);

			let hasTop: boolean;
			let hasBottom: boolean;

			if (!this.config.autoDetectBorders || forceInclude) {
				hasTop = true;
				hasBottom = hasVisibleBottomBorder(el);
			} else {
				const borders = hasVisibleBorder(el);
				hasTop = borders.hasTop;
				hasBottom = borders.hasBottom;
				if (!hasTop && !hasBottom) continue;
			}

			// Per-surface top margin check — skip surfaces too close to
			// the container top where the stickman body would overflow,
			// but still allow the bottom edge of the same element
			if (hasTop && rect.top >= TOP_MARGIN) {
				this.surfaces.push({
					id: `s${surfaceId++}`,
					edge: 'top',
					x1: rect.left,
					y1: rect.top,
					x2: rect.right,
					y2: rect.top,
					rect
				});
			}

			if (hasBottom) {
				if ((!hasTop || rect.height >= TALL_ELEMENT_THRESHOLD) && rect.bottom >= TOP_MARGIN) {
					this.surfaces.push({
						id: `s${surfaceId++}`,
						edge: 'bottom',
						x1: rect.left,
						y1: rect.bottom,
						x2: rect.right,
						y2: rect.bottom,
						rect
					});
				}
			}
		}

		this.mergeSurfaces();
	}

	private mergeSurfaces(): void {
		const merged: NavSurface[] = [];
		const used = new Set<number>();
		const sorted = [...this.surfaces].sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1);

		for (let i = 0; i < sorted.length; i++) {
			if (used.has(i)) continue;

			const current = { ...sorted[i], rect: { ...sorted[i].rect } };
			used.add(i);

			for (let j = i + 1; j < sorted.length; j++) {
				if (used.has(j)) continue;
				const other = sorted[j];

				if (Math.abs(other.y1 - current.y1) > SURFACE_MERGE_Y_TOLERANCE) break;

				const gap = other.x1 - current.x2;
				if (gap > SURFACE_MERGE_GAP) continue;
				if (gap < -other.rect.width) continue;

				used.add(j);
				current.x2 = Math.max(current.x2, other.x2);
				current.rect.right = Math.max(current.rect.right, other.rect.right);
				current.rect.width = current.x2 - current.x1;
			}

			merged.push(current);
		}

		this.surfaces = merged;
	}

	// ── Node Generation ──────────────────────────────────────────────

	private generateNodes(): void {
		let nodeId = 0;

		for (const surface of this.surfaces) {
			const length = Math.abs(surface.x2 - surface.x1);
			const nodeCount = Math.max(2, Math.floor(length / NODE_SPACING) + 1);

			for (let i = 0; i < nodeCount; i++) {
				const t = i / (nodeCount - 1);
				const x = surface.x1 + (surface.x2 - surface.x1) * t;
				const y = surface.y1;

				const node: NavNode = { id: `n${nodeId++}`, x, y, surfaceId: surface.id, t };
				this.nodes.push(node);
				this.nodeMap.set(node.id, node);
			}
		}
	}

	// ── Edge Connection ──────────────────────────────────────────────

	private connectNodes(): void {
		this.connectWalkEdges();
		this.connectJumpEdges();
		this.connectRopeEdges();
	}

	private connectWalkEdges(): void {
		const bySurface = new Map<string, NavNode[]>();
		for (const node of this.nodes) {
			const list = bySurface.get(node.surfaceId) ?? [];
			list.push(node);
			bySurface.set(node.surfaceId, list);
		}

		for (const [, surfaceNodes] of bySurface) {
			surfaceNodes.sort((a, b) => a.t - b.t);
			for (let i = 0; i < surfaceNodes.length - 1; i++) {
				const a = surfaceNodes[i];
				const b = surfaceNodes[i + 1];
				const dist = Math.abs(b.x - a.x);
				this.addEdge(a.id, b.id, dist, 'walk');
			}
		}
	}

	private connectJumpEdges(): void {
		const nodesBySurface = new Map<string, NavNode[]>();
		for (const node of this.nodes) {
			let list = nodesBySurface.get(node.surfaceId);
			if (!list) {
				list = [];
				nodesBySurface.set(node.surfaceId, list);
			}
			list.push(node);
		}
		for (const list of nodesBySurface.values()) {
			list.sort((a, b) => a.x - b.x);
		}

		const MID_THRESHOLD = NODE_SPACING * 3;
		const connected = new Set<string>();

		for (let i = 0; i < this.surfaces.length; i++) {
			for (let j = i + 1; j < this.surfaces.length; j++) {
				const sA = this.surfaces[i];
				const sB = this.surfaces[j];

				const dy = Math.abs(sA.y1 - sB.y1);
				if (dy > JUMP_MAX_DY) continue;

				const aLeft = Math.min(sA.x1, sA.x2);
				const aRight = Math.max(sA.x1, sA.x2);
				const bLeft = Math.min(sB.x1, sB.x2);
				const bRight = Math.max(sB.x1, sB.x2);

				const gapLeft = Math.max(aLeft, bLeft);
				const gapRight = Math.min(aRight, bRight);
				if (gapLeft > gapRight) {
					if (gapLeft - gapRight > JUMP_MAX_GAP) continue;
				}

				const nodesA = nodesBySurface.get(sA.id);
				const nodesB = nodesBySurface.get(sB.id);
				if (!nodesA || !nodesB || nodesA.length === 0 || nodesB.length === 0) continue;

				const edgeReps: {
					srcNodes: NavNode[];
					srcX: number;
					dstNodes: NavNode[];
					edgeSide: 'left' | 'right';
				}[] = [
					{
						srcNodes: nodesA,
						srcX: nodesA[0].x,
						dstNodes: nodesB,
						edgeSide: 'left'
					},
					{
						srcNodes: nodesA,
						srcX: nodesA[nodesA.length - 1].x,
						dstNodes: nodesB,
						edgeSide: 'right'
					},
					{
						srcNodes: nodesB,
						srcX: nodesB[0].x,
						dstNodes: nodesA,
						edgeSide: 'left'
					},
					{
						srcNodes: nodesB,
						srcX: nodesB[nodesB.length - 1].x,
						dstNodes: nodesA,
						edgeSide: 'right'
					}
				];

				const nudge = NODE_SPACING;

				for (const { srcNodes, srcX, dstNodes, edgeSide } of edgeReps) {
					const nSrc = closestNodeAtX(srcNodes, srcX);
					const landingX = edgeSide === 'left' ? srcX - nudge : srcX + nudge;
					const nDst = closestNodeAtX(dstNodes, landingX);
					if (!nSrc || !nDst) continue;

					const ndx = Math.abs(nSrc.x - nDst.x);
					if (ndx > JUMP_MAX_GAP) continue;
					const ndy = Math.abs(nSrc.y - nDst.y);
					if (ndy > JUMP_MAX_DY) continue;

					const pairKey =
						nSrc.id < nDst.id ? `${nSrc.id}:${nDst.id}` : `${nDst.id}:${nSrc.id}`;
					if (connected.has(pairKey)) continue;
					connected.add(pairKey);

					const dist = Math.sqrt(ndx * ndx + ndy * ndy);
					this.addEdge(nSrc.id, nDst.id, dist * 1.5, 'jump');
				}

				// Midpoint for wide overlaps
				const regionLeft =
					Math.max(nodesA[0].x, nodesB[0].x) - JUMP_MAX_GAP;
				const regionRight =
					Math.min(nodesA[nodesA.length - 1].x, nodesB[nodesB.length - 1].x) +
					JUMP_MAX_GAP;
				if (regionRight - regionLeft > MID_THRESHOLD) {
					const mid = (regionLeft + regionRight) / 2;
					const nA = closestNodeAtX(nodesA, mid);
					const nB = closestNodeAtX(nodesB, mid);
					if (nA && nB) {
						const ndx = Math.abs(nA.x - nB.x);
						const ndy = Math.abs(nA.y - nB.y);
						if (ndx <= JUMP_MAX_GAP && ndy <= JUMP_MAX_DY) {
							const pairKey =
								nA.id < nB.id ? `${nA.id}:${nB.id}` : `${nB.id}:${nA.id}`;
							if (!connected.has(pairKey)) {
								connected.add(pairKey);
								const dist = Math.sqrt(ndx * ndx + ndy * ndy);
								this.addEdge(nA.id, nB.id, dist * 1.5, 'jump');
							}
						}
					}
				}
			}
		}
	}

	private connectRopeEdges(): void {
		for (let i = 0; i < this.nodes.length; i++) {
			for (let j = i + 1; j < this.nodes.length; j++) {
				const a = this.nodes[i];
				const b = this.nodes[j];

				if (a.surfaceId === b.surfaceId) continue;

				const dx = Math.abs(a.x - b.x);
				if (dx > ROPE_HORIZONTAL_MARGIN) continue;

				const dy = Math.abs(a.y - b.y);
				if (dy <= JUMP_MAX_DY) continue;

				const minY = Math.min(a.y, b.y);
				const maxY = Math.max(a.y, b.y);
				const checkX = (a.x + b.x) / 2;

				let blocked = false;
				for (const s of this.surfaces) {
					if (s.id === a.surfaceId || s.id === b.surfaceId) continue;
					if (s.y1 > minY + 2 && s.y1 < maxY - 2) {
						if (checkX >= s.x1 && checkX <= s.x2) {
							blocked = true;
							break;
						}
					}
				}

				if (blocked) continue;

				const skippedLayers = this.countLayersBetween(
					a.surfaceId,
					b.surfaceId,
					minY,
					maxY
				);
				if (skippedLayers > 2) continue;

				const dist = Math.sqrt(dx * dx + dy * dy);
				const cost = dist + skippedLayers * ROPE_LAYER_PENALTY;
				this.addEdge(a.id, b.id, cost, 'rope');
			}
		}
	}

	private countLayersBetween(
		surfaceIdA: string,
		surfaceIdB: string,
		minY: number,
		maxY: number
	): number {
		const ys: number[] = [];
		for (const s of this.surfaces) {
			if (s.id === surfaceIdA || s.id === surfaceIdB) continue;
			if (s.y1 > minY + 2 && s.y1 < maxY - 2) {
				ys.push(s.y1);
			}
		}
		if (ys.length === 0) return 0;

		ys.sort((a, b) => a - b);
		let layers = 1;
		let groupY = ys[0];
		for (let i = 1; i < ys.length; i++) {
			if (ys[i] - groupY > JUMP_MAX_DY) {
				layers++;
				groupY = ys[i];
			}
		}
		return layers;
	}

	private addEdge(fromId: string, toId: string, cost: number, type: NavEdge['type']): void {
		const fwd: NavEdge = { from: fromId, to: toId, cost, type };
		const rev: NavEdge = { from: toId, to: fromId, cost, type };
		this.edges.push(fwd, rev);

		const fwdList = this.adjacency.get(fromId) ?? [];
		fwdList.push(fwd);
		this.adjacency.set(fromId, fwdList);

		const revList = this.adjacency.get(toId) ?? [];
		revList.push(rev);
		this.adjacency.set(toId, revList);
	}

	// ── Debug Rendering ──────────────────────────────────────────────

	drawDebug(ctx: CanvasRenderingContext2D): void {
		ctx.save();

		for (const s of this.surfaces) {
			ctx.strokeStyle = 'rgba(0, 255, 100, 0.3)';
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			ctx.moveTo(s.x1, s.y1);
			ctx.lineTo(s.x2, s.y2);
			ctx.stroke();
		}

		for (const n of this.nodes) {
			ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
			ctx.beginPath();
			ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
			ctx.fill();
		}

		for (const e of this.edges) {
			if (e.type === 'walk') continue;
			if (e.from > e.to) continue;

			const from = this.nodeMap.get(e.from);
			const to = this.nodeMap.get(e.to);
			if (!from || !to) continue;

			ctx.strokeStyle =
				e.type === 'jump'
					? 'rgba(255, 200, 0, 0.25)'
					: 'rgba(255, 100, 200, 0.25)';
			ctx.lineWidth = 0.5;
			ctx.setLineDash([2, 4]);
			ctx.beginPath();
			ctx.moveTo(from.x, from.y);
			ctx.lineTo(to.x, to.y);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		ctx.restore();
	}
}
