/**
 * A* Pathfinder with binary heap priority queue.
 */

import type { NavGrid } from './navgrid.js';
import type { NavNode, NavEdge, NavPath } from './types.js';

// ── Priority Queue (binary min-heap) ─────────────────────────────────

class MinHeap {
	private items: { id: string; priority: number }[] = [];

	get size(): number {
		return this.items.length;
	}

	push(id: string, priority: number): void {
		this.items.push({ id, priority });
		this.bubbleUp(this.items.length - 1);
	}

	pop(): string | undefined {
		if (this.items.length === 0) return undefined;
		const top = this.items[0];
		const last = this.items.pop()!;
		if (this.items.length > 0) {
			this.items[0] = last;
			this.sinkDown(0);
		}
		return top.id;
	}

	private bubbleUp(i: number): void {
		while (i > 0) {
			const parent = (i - 1) >> 1;
			if (this.items[parent].priority <= this.items[i].priority) break;
			[this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
			i = parent;
		}
	}

	private sinkDown(i: number): void {
		const len = this.items.length;
		while (true) {
			let smallest = i;
			const left = 2 * i + 1;
			const right = 2 * i + 2;

			if (left < len && this.items[left].priority < this.items[smallest].priority) {
				smallest = left;
			}
			if (right < len && this.items[right].priority < this.items[smallest].priority) {
				smallest = right;
			}

			if (smallest === i) break;
			[this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
			i = smallest;
		}
	}
}

// ── Heuristic ────────────────────────────────────────────────────────

function heuristic(a: NavNode, b: NavNode): number {
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy);
}

// ── Public API ───────────────────────────────────────────────────────

export function findPath(
	grid: NavGrid,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number
): NavPath | null {
	const startNode = grid.findNearestNode(fromX, fromY);
	const endNode = grid.findNearestNode(toX, toY);

	if (!startNode || !endNode) return null;
	if (startNode.id === endNode.id) {
		return { nodes: [startNode], edges: [], totalCost: 0 };
	}

	return astar(grid, startNode, endNode);
}

export function findRandomPath(
	grid: NavGrid,
	fromX: number,
	fromY: number,
	minDistance = 80,
	maxDistance = 800
): NavPath | null {
	const startNode = grid.findNearestNode(fromX, fromY);
	if (!startNode) return null;

	const candidates = grid.nodes.filter((n) => {
		if (n.id === startNode.id) return false;
		if (n.surfaceId === startNode.surfaceId) return false;

		const dx = n.x - startNode.x;
		const dy = n.y - startNode.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		return dist >= minDistance && dist <= maxDistance;
	});

	if (candidates.length > 0) {
		const differentY = candidates.filter((n) => Math.abs(n.y - startNode.y) > 20);
		const pool =
			differentY.length > 0 && Math.random() < 0.7 ? differentY : candidates;
		const target = pool[Math.floor(Math.random() * pool.length)];
		return astar(grid, startNode, target);
	}

	const fallback = grid.nodes.filter(
		(n) => n.id !== startNode.id && n.surfaceId !== startNode.surfaceId
	);
	if (fallback.length > 0) {
		const target = fallback[Math.floor(Math.random() * fallback.length)];
		return astar(grid, startNode, target);
	}

	const samesurf = grid.nodes.filter((n) => n.id !== startNode.id);
	if (samesurf.length === 0) return null;
	const target = samesurf[Math.floor(Math.random() * samesurf.length)];
	return astar(grid, startNode, target);
}

/**
 * Find a path AWAY from a given point.
 * Used for flee behavior.
 */
export function findPathAway(
	grid: NavGrid,
	fromX: number,
	fromY: number,
	awayFromX: number,
	awayFromY: number,
	minDistance = 100,
	maxDistance = 600
): NavPath | null {
	const startNode = grid.findNearestNode(fromX, fromY);
	if (!startNode) return null;

	// Direction away from the flee source
	const fleeAngle = Math.atan2(fromY - awayFromY, fromX - awayFromX);
	const cosFlee = Math.cos(fleeAngle);
	const sinFlee = Math.sin(fleeAngle);

	// Score candidates by how well they match the "away" direction
	const scored = grid.nodes
		.filter((n) => {
			if (n.id === startNode.id) return false;
			const dx = n.x - startNode.x;
			const dy = n.y - startNode.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			return dist >= minDistance && dist <= maxDistance;
		})
		.map((n) => {
			const dx = n.x - startNode.x;
			const dy = n.y - startNode.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			// Dot product with flee direction (higher = more aligned with "away")
			const dot = (dx / dist) * cosFlee + (dy / dist) * sinFlee;
			return { node: n, score: dot };
		})
		.filter((s) => s.score > -0.3) // exclude nodes in the direction OF the threat
		.sort((a, b) => b.score - a.score);

	// Pick from the top candidates with some randomness
	if (scored.length > 0) {
		const topN = scored.slice(0, Math.min(5, scored.length));
		const target = topN[Math.floor(Math.random() * topN.length)].node;
		return astar(grid, startNode, target);
	}

	// Fallback to any random path
	return findRandomPath(grid, fromX, fromY, minDistance, maxDistance);
}

// ── A* Implementation ────────────────────────────────────────────────

function astar(grid: NavGrid, startNode: NavNode, endNode: NavNode): NavPath | null {
	const gCost = new Map<string, number>();
	const parent = new Map<string, { nodeId: string; edge: NavEdge } | null>();
	const closedSet = new Set<string>();
	const openHeap = new MinHeap();

	gCost.set(startNode.id, 0);
	parent.set(startNode.id, null);
	openHeap.push(startNode.id, heuristic(startNode, endNode));

	let iterations = 0;
	const maxIterations = 2000;

	while (openHeap.size > 0 && iterations < maxIterations) {
		iterations++;

		const currentId = openHeap.pop();
		if (!currentId) break;

		if (closedSet.has(currentId)) continue;

		if (currentId === endNode.id) {
			return reconstructPath(grid, currentId, parent, gCost);
		}

		closedSet.add(currentId);

		const edges = grid.getEdgesFrom(currentId);
		for (const edge of edges) {
			if (closedSet.has(edge.to)) continue;

			const tentativeG = (gCost.get(currentId) ?? 0) + edge.cost;
			const existingG = gCost.get(edge.to);

			if (existingG !== undefined && tentativeG >= existingG) continue;

			const neighborNode = grid.getNode(edge.to);
			if (!neighborNode) continue;

			gCost.set(edge.to, tentativeG);
			parent.set(edge.to, { nodeId: currentId, edge });
			openHeap.push(edge.to, tentativeG + heuristic(neighborNode, endNode));
		}
	}

	return null;
}

function reconstructPath(
	grid: NavGrid,
	endId: string,
	parent: Map<string, { nodeId: string; edge: NavEdge } | null>,
	gCost: Map<string, number>
): NavPath {
	const nodes: NavNode[] = [];
	const edges: NavEdge[] = [];
	let walkId: string | null = endId;

	while (walkId) {
		const node = grid.getNode(walkId);
		if (node) nodes.unshift(node);

		const p = parent.get(walkId);
		if (p) {
			edges.unshift(p.edge);
			walkId = p.nodeId;
		} else {
			walkId = null;
		}
	}

	return {
		nodes,
		edges,
		totalCost: gCost.get(endId) ?? 0
	};
}

export function drawPath(
	ctx: CanvasRenderingContext2D,
	path: NavPath,
	color = 'rgba(255, 100, 50, 0.6)'
): void {
	if (path.nodes.length < 2) return;

	ctx.save();
	ctx.strokeStyle = color;
	ctx.lineWidth = 1;
	ctx.setLineDash([3, 3]);
	ctx.beginPath();
	ctx.moveTo(path.nodes[0].x, path.nodes[0].y);
	for (let i = 1; i < path.nodes.length; i++) {
		ctx.lineTo(path.nodes[i].x, path.nodes[i].y);
	}
	ctx.stroke();
	ctx.setLineDash([]);

	const target = path.nodes[path.nodes.length - 1];
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.arc(target.x, target.y, 3, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}
