<script lang="ts">
	import { onMount } from 'svelte';
	import { DefaultHatDefs, createHat, mirrorHatShape } from '$lib/index.js';
	import type { HatShape, HatLayerDef } from '$lib/index.js';
	import { createHistory } from './shared/history.js';
	import { createUndoRedoHandler } from './shared/keyboard.js';
	import { setupHiDpiCanvas, clearCanvas, drawGrid } from './shared/canvas-utils.js';
	import JsonModal from './shared/JsonModal.svelte';
	import CodeOutput from './shared/CodeOutput.svelte';
	import SaveManager from './shared/SaveManager.svelte';
	import PresetList from './shared/PresetList.svelte';

	// ── Canvas constants ───────────────────────────────────────────────
	const CW = 200, CH = 200;
	const HX = CW / 2;   // head centre X
	const HY = 128;       // head centre Y
	const HR = 28;        // head radius in canvas px
	const NECK_LEN = 34;
	const HAT_O_Y = HY - HR; // hat-space origin y in canvas (= crown)

	// ── Shape catalogue ────────────────────────────────────────────────

	type ShapeType = HatShape['type'];
	const SHAPE_TYPES: ShapeType[] = ['line', 'circle', 'arc', 'rect', 'triangle', 'curve'];

	const SHAPE_DEFAULTS: Record<ShapeType, HatShape> = {
		line:     { type: 'line',     x: 0, y: -0.5, size: 1.5, angle: 0 },
		circle:   { type: 'circle',   x: 0, y: -1.2, size: 0.7 },
		arc:      { type: 'arc',      x: 0, y:  0,   size: 1.2 },
		rect:     { type: 'rect',     x: 0, y: -1.0, size: 0.9 },
		triangle: { type: 'triangle', x: 0, y: -0.8, size: 0.9 },
		curve:    { type: 'curve',    x: 0, y:  0,   size: 1.5 }
	};

	// ── State ─────────────────────────────────────────────────────────

	let shapes: HatShape[]  = $state([]);
	let mirrors: boolean[]  = $state([]); // parallel to shapes; mirror[i] = draw reflected copy of shapes[i]
	let selectedIdxs: number[] = $state([]);
	const selectedIdx = $derived(selectedIdxs.at(-1) ?? null);
	let hatId    = $state('my-hat');
	let hatLabel = $state('My Hat');
	let addType: ShapeType = $state('arc');
	let canvas: HTMLCanvasElement;
	let canvasCursor = $state('crosshair');

	// ── Undo / Redo ────────────────────────────────────────────────────

	let canUndo = $state(false);
	let canRedo = $state(false);

	const history = createHistory(
		() => ({
			shapes:  shapes.map(s => ({ ...s }) as HatShape),
			mirrors: [...mirrors],
			hatId, hatLabel
		}),
		(snap) => {
			shapes   = snap.shapes;
			mirrors  = snap.mirrors;
			hatId    = snap.hatId;
			hatLabel = snap.hatLabel;
		}
	);

	function snap() { history.snapshot(); syncHistory(); }
	function doUndo() { history.undo(); syncHistory(); }
	function doRedo() { history.redo(); syncHistory(); }
	function syncHistory() { canUndo = history.canUndo(); canRedo = history.canRedo(); }

	const onKeyDown = createUndoRedoHandler(doUndo, doRedo);

	// Drag state — discriminated union; plain var (no reactivity needed)
	type DragState =
		| { kind: 'single'; mode: 'move' | 'resize';
			idx: number; startMX: number; startMY: number;
			startX: number; startY: number; startSize: number;
			centerX: number; centerY: number;
			sizeOffset: number; angleOffset: number }
		| { kind: 'multi-move';
			idxs: number[]; startMX: number; startMY: number;
			startShapes: { x: number; y: number }[] }
		| { kind: 'multi-resize';
			idxs: number[];
			startShapes: { x: number; y: number; size: number; angle: number; cx: number; cy: number }[];
			groupCX: number; groupCY: number;
			grabDist: number; grabAngle: number };
	let dragging: DragState | null = null;

	// Marquee drag-select state
	type Marquee = { x0: number; y0: number; x1: number; y1: number; additive: boolean };
	let marquee: Marquee | null = $state(null);

	// ── Canvas coordinate helpers ──────────────────────────────────────

	/** Shape centre in canvas logical space. */
	function centerOf(s: HatShape) {
		return { x: HX + s.x * HR, y: HAT_O_Y + s.y * HR };
	}

	/** Handle position — orbits at the shape's current angle for non-circles. */
	function handleOf(s: HatShape) {
		const c = centerOf(s);
		const dist = s.size * HR + 7;
		if (s.type === 'circle') return { x: c.x + dist, y: c.y };
		const rad = ((s as { angle?: number }).angle ?? 0) * Math.PI / 180;
		return { x: c.x + dist * Math.cos(rad), y: c.y + dist * Math.sin(rad) };
	}

	/** Canvas-space centroid of all currently selected shapes. */
	function groupCenter() {
		const cs = selectedIdxs.map(i => centerOf(shapes[i]));
		return {
			x: cs.reduce((s, c) => s + c.x, 0) / cs.length,
			y: cs.reduce((s, c) => s + c.y, 0) / cs.length
		};
	}

	/** Position of the single group resize handle (right side of group bounding circle). */
	function groupHandlePos() {
		const gc = groupCenter();
		const maxReach = Math.max(...selectedIdxs.map(i => {
			const c = centerOf(shapes[i]);
			return Math.hypot(c.x - gc.x, c.y - gc.y) + shapes[i].size * HR + 7;
		}));
		return { x: gc.x + Math.max(maxReach, 20), y: gc.y, gc };
	}

	// ── Hit testing ────────────────────────────────────────────────────

	function hitTest(mx: number, my: number, skip: number[] = []): { type: 'shape' | 'handle'; idx: number } | null {
		if (selectedIdxs.length > 1) {
			const gh = groupHandlePos();
			if (Math.hypot(mx - gh.x, my - gh.y) < 9) return { type: 'handle', idx: -1 };
			for (let i = shapes.length - 1; i >= 0; i--) {
				if (skip.includes(i)) continue;
				const c = centerOf(shapes[i]);
				const threshold = Math.max(shapes[i].size * HR * 0.9, 12);
				if (Math.hypot(mx - c.x, my - c.y) < threshold) return { type: 'shape', idx: i };
			}
			return null;
		}
		for (let i = shapes.length - 1; i >= 0; i--) {
			if (skip.includes(i)) continue;
			const h = handleOf(shapes[i]);
			if (Math.hypot(mx - h.x, my - h.y) < 9) return { type: 'handle', idx: i };
		}
		for (let i = shapes.length - 1; i >= 0; i--) {
			if (skip.includes(i)) continue;
			const c = centerOf(shapes[i]);
			const threshold = Math.max(shapes[i].size * HR * 0.9, 12);
			if (Math.hypot(mx - c.x, my - c.y) < threshold) return { type: 'shape', idx: i };
		}
		return null;
	}

	// ── Canvas interaction ─────────────────────────────────────────────

	function onCanvasMouseDown(e: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const ctrl = e.ctrlKey || e.metaKey;

		if (ctrl) {
			const hitUnder = hitTest(mx, my, selectedIdxs);
			if (hitUnder && hitUnder.idx >= 0) {
				selectedIdxs = [...selectedIdxs, hitUnder.idx];
			} else {
				const hitAny = hitTest(mx, my);
				if (hitAny && hitAny.idx >= 0 && selectedIdxs.includes(hitAny.idx)) {
					selectedIdxs = selectedIdxs.filter(i => i !== hitAny.idx);
				} else {
					marquee = { x0: mx, y0: my, x1: mx, y1: my, additive: true };
				}
			}
			e.preventDefault();
			return;
		}

		const hit = hitTest(mx, my);

		if (!hit) {
			marquee = { x0: mx, y0: my, x1: mx, y1: my, additive: false };
			return;
		}

		const isMulti = selectedIdxs.length > 1;

		if (isMulti && hit.idx === -1) {
			snap();
			const gh = groupHandlePos();
			const { gc } = gh;
			dragging = {
				kind: 'multi-resize',
				idxs: [...selectedIdxs],
				startShapes: selectedIdxs.map(i => {
					const c = centerOf(shapes[i]);
					return { x: shapes[i].x, y: shapes[i].y, size: shapes[i].size,
					         angle: (shapes[i] as { angle?: number }).angle ?? 0,
					         cx: c.x, cy: c.y };
				}),
				groupCX: gc.x, groupCY: gc.y,
				grabDist: Math.hypot(mx - gc.x, my - gc.y),
				grabAngle: Math.atan2(my - gc.y, mx - gc.x) * 180 / Math.PI
			};
			canvasCursor = 'grabbing';
			e.preventDefault();

		} else if (isMulti && selectedIdxs.includes(hit.idx)) {
			snap();
			dragging = {
				kind: 'multi-move',
				idxs: [...selectedIdxs],
				startMX: mx, startMY: my,
				startShapes: selectedIdxs.map(i => ({ x: shapes[i].x, y: shapes[i].y }))
			};
			canvasCursor = 'grabbing';
			e.preventDefault();

		} else {
			snap();
			selectedIdxs = [hit.idx];
			const s = shapes[hit.idx];
			const c = centerOf(s);
			const grabDist  = Math.hypot(mx - c.x, my - c.y);
			const grabAngle = Math.atan2(my - c.y, mx - c.x) * 180 / Math.PI;
			const shapeAngle = (s as { angle?: number }).angle ?? 0;
			dragging = {
				kind: 'single',
				mode: hit.type === 'handle' ? 'resize' : 'move',
				idx: hit.idx, startMX: mx, startMY: my,
				startX: s.x, startY: s.y, startSize: s.size,
				centerX: c.x, centerY: c.y,
				sizeOffset:  s.size  - grabDist / HR,
				angleOffset: shapeAngle - grabAngle
			};
			canvasCursor = 'grabbing';
			e.preventDefault();
		}
	}

	/** Snap a value to a step if shift is held. */
	function snapTo(val: number, step: number, shift: boolean): number {
		return shift ? Math.round(val / step) * step : val;
	}

	function onWindowMouseMove(e: MouseEvent) {
		if (marquee) {
			const rect = canvas.getBoundingClientRect();
			marquee = { ...marquee,
				x1: e.clientX - rect.left,
				y1: e.clientY - rect.top
			};
			return;
		}

		if (!dragging) {
			if (canvas) {
				const rect = canvas.getBoundingClientRect();
				const mx = e.clientX - rect.left;
				const my = e.clientY - rect.top;
				if (mx >= 0 && mx <= CW && my >= 0 && my <= CH) {
					const hit = hitTest(mx, my);
					const ctrl = e.ctrlKey || e.metaKey;
					canvasCursor = hit ? (ctrl ? 'pointer' : 'grab') : 'crosshair';
				}
			}
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		const shift = e.shiftKey;
		const d = dragging;

		if (d.kind === 'single') {
			if (d.mode === 'move') {
				const dx = (mx - d.startMX) / HR;
				const dy = (my - d.startMY) / HR;
				const nx = snapTo(d.startX + dx, 0.25, shift);
				const ny = snapTo(d.startY + dy, 0.25, shift);
				shapes = shapes.map((s, i) => i === d.idx
					? { ...s, x: round3(nx), y: round3(ny) } as HatShape
					: s
				);
			} else {
				const ddx = mx - d.centerX;
				const ddy = my - d.centerY;
				const rawSize  = Math.max(0.05, Math.hypot(ddx, ddy) / HR + d.sizeOffset);
				const rawAngle = Math.atan2(ddy, ddx) * 180 / Math.PI + d.angleOffset;
				const newSize  = round3(snapTo(rawSize,  0.25, shift));
				const newAngle = round3(snapTo(rawAngle, 15,   shift));
				shapes = shapes.map((s, i) => {
					if (i !== d.idx) return s;
					if (s.type === 'circle') return { ...s, size: newSize } as HatShape;
					return { ...s, size: newSize, angle: newAngle } as HatShape;
				});
			}

		} else if (d.kind === 'multi-move') {
			const dx = (mx - d.startMX) / HR;
			const dy = (my - d.startMY) / HR;
			shapes = shapes.map((s, i) => {
				const si = d.idxs.indexOf(i);
				if (si < 0) return s;
				const ss = d.startShapes[si];
				return { ...s,
					x: round3(snapTo(ss.x + dx, 0.25, shift)),
					y: round3(snapTo(ss.y + dy, 0.25, shift))
				} as HatShape;
			});

		} else {
			const newDist  = Math.hypot(mx - d.groupCX, my - d.groupCY);
			const newAngle = Math.atan2(my - d.groupCY, mx - d.groupCX) * 180 / Math.PI;
			const scale    = d.grabDist > 0 ? Math.max(0.05, newDist / d.grabDist) : 1;
			let   angleDelta = newAngle - d.grabAngle;
			if (shift) angleDelta = Math.round(angleDelta / 15) * 15;
			const rad = angleDelta * Math.PI / 180;
			const cos = Math.cos(rad), sin = Math.sin(rad);

			shapes = shapes.map((s, i) => {
				const si = d.idxs.indexOf(i);
				if (si < 0) return s;
				const ss = d.startShapes[si];
				const relX = ss.cx - d.groupCX;
				const relY = ss.cy - d.groupCY;
				const newCX = d.groupCX + (relX * cos - relY * sin) * scale;
				const newCY = d.groupCY + (relX * sin + relY * cos) * scale;
				const newX    = round3((newCX - HX) / HR);
				const newY    = round3((newCY - HAT_O_Y) / HR);
				const newSize = round3(Math.max(0.05, ss.size * scale));
				const newAng  = round3(ss.angle + angleDelta);
				if (s.type === 'circle') return { ...s, x: newX, y: newY, size: newSize } as HatShape;
				return { ...s, x: newX, y: newY, size: newSize, angle: newAng } as HatShape;
			});
		}
	}

	function onWindowMouseUp() {
		dragging = null;
		canvasCursor = 'crosshair';

		if (marquee) {
			const m = marquee;
			marquee = null;
			const left   = Math.min(m.x0, m.x1);
			const right  = Math.max(m.x0, m.x1);
			const top    = Math.min(m.y0, m.y1);
			const bottom = Math.max(m.y0, m.y1);
			const tiny   = (right - left) < 4 && (bottom - top) < 4;

			if (tiny) {
				if (!m.additive) selectedIdxs = [];
			} else {
				const hits = shapes
					.map((s, i) => ({ i, c: centerOf(s) }))
					.filter(({ c }) => c.x >= left && c.x <= right && c.y >= top && c.y <= bottom)
					.map(({ i }) => i);
				selectedIdxs = m.additive
					? [...new Set([...selectedIdxs, ...hits])]
					: hits;
			}
		}
	}

	// ── Shape management ───────────────────────────────────────────────

	function addShape() {
		snap();
		shapes  = [...shapes,  { ...SHAPE_DEFAULTS[addType] } as HatShape];
		mirrors = [...mirrors, false];
		selectedIdxs = [shapes.length - 1];
	}

	function deleteShapeAt(idx: number) {
		snap();
		shapes  = shapes.filter((_, i)  => i !== idx);
		mirrors = mirrors.filter((_, i) => i !== idx);
		selectedIdxs = selectedIdxs
			.filter(i => i !== idx)
			.map(i => i > idx ? i - 1 : i);
	}

	function toggleMirror(idx: number) {
		snap();
		mirrors = mirrors.map((m, i) => i === idx ? !m : m);
	}

	function updateShape(i: number, patch: Record<string, unknown>) {
		shapes = shapes.map((s, idx) => idx === i ? { ...s, ...patch } as HatShape : s);
	}

	function updateShapes(idxs: number[], patch: Record<string, unknown>) {
		shapes = shapes.map((s, idx) => idxs.includes(idx) ? { ...s, ...patch } as HatShape : s);
	}

	// ── Saved hats (localStorage) ──────────────────────────────────────

	const LS_KEY = 'stickmen:saved-hats';
	let savedHats: Record<string, { id: string; label: string; shapes: HatShape[]; mirrors?: boolean[] }> = $state({});
	function loadSavedFromStorage() {
		try {
			const raw = localStorage.getItem(LS_KEY);
			if (raw) savedHats = JSON.parse(raw);
		} catch { savedHats = {}; }
	}

	function persistSaved() {
		localStorage.setItem(LS_KEY, JSON.stringify(savedHats));
	}

	function saveHat() {
		const existing = savedHats[hatId];
		if (existing && !window.confirm(`Overwrite saved hat "${hatId}"?`)) return;
		savedHats = {
			...savedHats,
			[hatId]: {
				id: hatId,
				label: hatLabel,
				shapes: shapes.map(s => ({ ...s }) as HatShape),
				mirrors: [...mirrors]
			}
		};
		persistSaved();
	}

	function loadSaved(id: string) {
		const def = savedHats[id];
		if (!def) return;
		snap();
		hatId = def.id; hatLabel = def.label;
		shapes  = def.shapes.map(s => ({ ...s }) as HatShape);
		mirrors = def.mirrors ? [...def.mirrors] : shapes.map(() => false);
		selectedIdxs = shapes.length > 0 ? [0] : [];
	}

	function deleteSaved(id: string) {
		const next = { ...savedHats };
		delete next[id];
		savedHats = next;
		persistSaved();
	}

	let showJsonModal = $state(false);

	function importFromJson() { showJsonModal = true; }

	function onJsonConfirm(raw: string) {
		showJsonModal = false;
		try {
			const def = JSON.parse(raw);
			if (!def || typeof def !== 'object' || !def.id || !def.label || !Array.isArray(def.shapes)) {
				alert('Invalid hat JSON: expected { id, label, shapes }');
				return;
			}
			snap();
			hatId = def.id; hatLabel = def.label;
			shapes  = (def.shapes as HatShape[]).map(s => ({ ...s }) as HatShape);
			mirrors = shapes.map(() => false);
			selectedIdxs = shapes.length > 0 ? [0] : [];
		} catch {
			alert('Failed to parse JSON.');
		}
	}

	// ── Presets ────────────────────────────────────────────────────────

	const presetItems = Object.keys(DefaultHatDefs).map(key => ({
		key,
		label: DefaultHatDefs[key].label
	}));

	function loadPreset(key: string) {
		snap();
		const def = DefaultHatDefs[key];
		if (!def) return;
		hatId = def.id; hatLabel = def.label;
		shapes  = def.shapes.map(s => ({ ...s }) as HatShape);
		mirrors = shapes.map(() => false);
		selectedIdxs = shapes.length > 0 ? [0] : [];
	}

	// ── Code generation ────────────────────────────────────────────────

	function round3(n: number) { return Math.round(n * 1000) / 1000; }

	function cleanShape(s: HatShape): object {
		const { type, x, y, size, ...rest } = s as HatShape & Record<string, unknown>;
		const out: Record<string, unknown> = {
			type,
			x: round3(x as number),
			y: round3(y as number),
			size: round3(size as number)
		};
		for (const [k, v] of Object.entries(rest)) {
			if (v === undefined) continue;
			if (k === 'thickness' && v === 1) continue;
			out[k] = typeof v === 'number' ? round3(v) : v;
		}
		return out;
	}

	function expandedShapes(): object[] {
		const out: object[] = [];
		for (let i = 0; i < shapes.length; i++) {
			out.push(cleanShape(shapes[i]));
			if (mirrors[i]) out.push(cleanShape(mirrorHatShape(shapes[i])));
		}
		return out;
	}

	let generatedCode = $derived(
		shapes.length === 0
			? '// add shapes to generate code'
			: JSON.stringify({ id: hatId, label: hatLabel, shapes: expandedShapes() }, null, 2)
	);

	// ── Derived data for SaveManager ──────────────────────────────────

	let savedList = $derived(
		Object.values(savedHats)
			.sort((a, b) => a.id.localeCompare(b.id))
			.map(e => ({ id: e.id, label: e.label }))
	);

	// ── Canvas rendering ────────────────────────────────────────────────

	function render() {
		if (!canvas) return;
		const ctx = clearCanvas(canvas, CW, CH);
		drawGrid(ctx, CW, CH);

		// Head-level guide
		ctx.strokeStyle = '#1c1c1c'; ctx.setLineDash([2, 5]);
		ctx.beginPath(); ctx.moveTo(0, HY); ctx.lineTo(CW, HY); ctx.stroke();
		ctx.setLineDash([]);

		const color = 'hsl(190,65%,52%)';
		ctx.strokeStyle = color;
		ctx.fillStyle   = 'hsla(190,65%,52%,0.18)';
		ctx.lineWidth   = 1.5;
		ctx.lineCap     = 'round'; ctx.lineJoin = 'round';

		// Neck
		ctx.beginPath();
		ctx.moveTo(HX, HY + HR); ctx.lineTo(HX, HY + HR + NECK_LEN);
		ctx.stroke();

		// Head circle
		ctx.beginPath();
		ctx.arc(HX, HY, HR, 0, Math.PI * 2);
		ctx.fill(); ctx.stroke();

		// Hat shapes (originals)
		if (shapes.length > 0) {
			createHat({ id: hatId, label: hatLabel, shapes } satisfies HatLayerDef)
				.draw(ctx, HX, HY, HR, 0, color);
		}

		// Ghost mirror copies
		const mirrorShapes = shapes.filter((_, i) => mirrors[i]).map(mirrorHatShape);
		if (mirrorShapes.length > 0) {
			ctx.save();
			ctx.globalAlpha = 0.45;
			createHat({ id: '', label: '', shapes: mirrorShapes })
				.draw(ctx, HX, HY, HR, 0, color);
			ctx.restore();
		}

		// Glow pass — redraw selected shapes in amber
		if (selectedIdxs.length > 0) {
			const selShapes = selectedIdxs.map(i => shapes[i]).filter(Boolean) as HatShape[];
			ctx.save();
			ctx.shadowBlur  = 12;
			ctx.shadowColor = 'hsl(38,95%,60%)';
			createHat({ id: '', label: '', shapes: selShapes })
				.draw(ctx, HX, HY, HR, 0, 'hsl(38,90%,65%)');
			ctx.restore();
		}

		if (selectedIdxs.length > 1) {
			const gh = groupHandlePos();
			const gc = gh.gc;
			const groupRadius = gh.x - gc.x;

			ctx.save();
			ctx.setLineDash([3, 3]);
			ctx.strokeStyle = 'rgba(255,255,255,0.20)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(gc.x, gc.y, groupRadius, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);

			ctx.fillStyle = 'rgba(255,255,255,0.50)';
			ctx.beginPath(); ctx.arc(gc.x, gc.y, 2.5, 0, Math.PI * 2); ctx.fill();

			ctx.strokeStyle = 'rgba(255,255,255,0.15)';
			ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(gc.x, gc.y); ctx.lineTo(gh.x, gh.y); ctx.stroke();

			ctx.strokeStyle = 'rgba(255,255,255,0.55)';
			ctx.fillStyle   = '#111';
			ctx.lineWidth   = 1;
			ctx.beginPath(); ctx.arc(gh.x, gh.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

			ctx.restore();

		} else {
			for (const si of selectedIdxs) {
				if (!shapes[si]) continue;
				const s = shapes[si];
				const { x: cx, y: cy } = centerOf(s);
				const { x: hx, y: hy } = handleOf(s);

				ctx.save();
				ctx.setLineDash([3, 3]);
				ctx.strokeStyle = 'rgba(255,255,255,0.22)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.arc(cx, cy, s.size * HR + 6, 0, Math.PI * 2);
				ctx.stroke();
				ctx.setLineDash([]);

				ctx.fillStyle = 'rgba(255,255,255,0.55)';
				ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

				ctx.strokeStyle = 'rgba(255,255,255,0.15)';
				ctx.lineWidth = 1;
				ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();

				ctx.strokeStyle = 'rgba(255,255,255,0.55)';
				ctx.fillStyle   = '#111';
				ctx.lineWidth   = 1;
				ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
				ctx.restore();
			}
		}

		// Marquee
		if (marquee) {
			const rx = Math.min(marquee.x0, marquee.x1);
			const ry = Math.min(marquee.y0, marquee.y1);
			const rw = Math.abs(marquee.x1 - marquee.x0);
			const rh = Math.abs(marquee.y1 - marquee.y0);
			ctx.save();
			ctx.setLineDash([3, 3]);
			ctx.strokeStyle = 'rgba(255,255,255,0.40)';
			ctx.fillStyle   = 'rgba(255,255,255,0.04)';
			ctx.lineWidth   = 1;
			ctx.strokeRect(rx, ry, rw, rh);
			ctx.fillRect(rx, ry, rw, rh);
			ctx.setLineDash([]);
			ctx.restore();
		}
	}

	onMount(() => {
		loadSavedFromStorage();
		setupHiDpiCanvas(canvas, CW, CH);
		render();
		return () => {};
	});

	$effect(() => {
		shapes; mirrors; hatId; hatLabel; selectedIdxs; marquee;
		render();
	});
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} onkeydown={onKeyDown} />

{#if showJsonModal}
	<JsonModal
		title="load hat json"
		placeholder={'{\n  "id": "my-hat",\n  "label": "My Hat",\n  "shapes": [...]\n}'}
		onconfirm={onJsonConfirm}
		oncancel={() => showJsonModal = false}
	/>
{/if}

<div class="hb">
	<div class="hb-layout">

		<!-- ── LEFT: canvas + shape list + code ─────────────────────── -->
		<div class="hb-left">

			<!-- Preview canvas -->
			<div class="hb-canvas-wrap">
				<canvas
					bind:this={canvas}
					style="cursor: {canvasCursor}"
					onmousedown={onCanvasMouseDown}
				></canvas>
			</div>

			<!-- Shape list -->
			<div class="hb-shapes-bar">
				<span class="hb-micro-lbl">shapes</span>
				<div class="hb-shapes-ctrls">
					<select class="hb-sel" bind:value={addType}>
						{#each SHAPE_TYPES as t}<option value={t}>{t}</option>{/each}
					</select>
					<button class="hb-btn" onclick={addShape}>+</button>
					<div class="hb-divider"></div>
					<button class="hb-btn" onclick={doUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">undo</button>
					<button class="hb-btn" onclick={doRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">redo</button>
				</div>
			</div>

			<div class="hb-shape-list">
				{#each shapes as s, i}
					<div
						class="hb-shape-row"
						class:sel={selectedIdxs.includes(i)}
						onclick={(e) => {
							if (e.ctrlKey || e.metaKey) {
								if (selectedIdxs.includes(i)) selectedIdxs = selectedIdxs.filter(x => x !== i);
								else selectedIdxs = [...selectedIdxs, i];
							} else {
								selectedIdxs = [i];
							}
						}}
						role="button" tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && (selectedIdxs = [i])}
					>
						<span class="hb-shape-type">{s.type}</span>
						<span class="hb-shape-pos">{round3(s.x)}, {round3(s.y)}</span>
						<div class="hb-row-actions">
							<button
								class="hb-mirror-btn"
								class:active={mirrors[i]}
								onclick={(e) => { e.stopPropagation(); toggleMirror(i); }}
							>mirror</button>
							<button
								class="hb-del-btn"
								onclick={(e) => { e.stopPropagation(); deleteShapeAt(i); }}
							>del</button>
						</div>
					</div>
				{/each}
				{#if shapes.length === 0}
					<div class="hb-empty">add shapes to start</div>
				{/if}
			</div>

			<!-- Code -->
			<CodeOutput code={generatedCode} isEmpty={shapes.length === 0} filename="{hatId}.json" />
		</div>

		<!-- ── RIGHT: params + settings + presets ───────────────────── -->
		<div class="hb-right">

			<!-- Shape parameters -->
			{#if selectedIdxs.length === 0}
				<div class="hb-section hb-no-sel">
					<p class="hb-no-sel-text">Click a shape to edit it<br><span class="hb-no-sel-hint">ctrl+click to multi-select</span></p>
				</div>
			{:else if selectedIdxs.length === 1}
				{@const s = shapes[selectedIdxs[0]]}
				{@const i = selectedIdxs[0]}
				{#if s}
				<div class="hb-section">
					<h4 class="hb-section-hdr">{s.type}</h4>

					<!-- Fill — circle, arc, rect, triangle -->
					{#if s.type === 'circle' || s.type === 'arc' || s.type === 'rect' || s.type === 'triangle'}
						{@const filled = (s as {fill?: boolean}).fill ?? false}
						<label class="hb-field">
							<span class="hb-label">fill</span>
							<input type="checkbox" checked={filled}
								onchange={(e) => updateShape(i, { fill: (e.target as HTMLInputElement).checked })} />
						</label>
					{/if}

					<!-- Arc: span -->
					{#if s.type === 'arc'}
						{@const sp = (s as {span?: number}).span ?? 180}
						<label class="hb-field">
							<span class="hb-label">span</span>
							<input class="hb-slider" type="range" min="10" max="360" step="5"
								value={sp}
								onpointerdown={snap}
								oninput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); updateShape(i, { span: e.shiftKey ? Math.round(v / 15) * 15 : v }); }}
							/>
							<span class="hb-val">{sp}°</span>
						</label>
					{/if}

					<!-- Rect: aspect -->
					{#if s.type === 'rect'}
						{@const asp = (s as {aspect?: number}).aspect ?? 1}
						<label class="hb-field">
							<span class="hb-label">aspect</span>
							<input class="hb-slider" type="range" min="0.1" max="5" step="0.05"
								value={asp}
								onpointerdown={snap}
								oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShape(i, { aspect: e.shiftKey ? Math.round(v * 2) / 2 : v }); }}
							/>
							<span class="hb-val">{asp.toFixed(2)}</span>
						</label>
					{/if}

					<!-- Curve: curvature -->
					{#if s.type === 'curve'}
						{@const bow = (s as {curvature?: number}).curvature ?? 0.5}
						<label class="hb-field">
							<span class="hb-label">bow</span>
							<input class="hb-slider" type="range" min="-2" max="2" step="0.05"
								value={bow}
								onpointerdown={snap}
								oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShape(i, { curvature: e.shiftKey ? Math.round(v * 4) / 4 : v }); }}
							/>
							<span class="hb-val">{bow.toFixed(2)}</span>
						</label>
					{/if}

					<!-- Thickness -->
					<label class="hb-field">
						<span class="hb-label">width</span>
						<input class="hb-slider" type="range" min="1" max="10" step="0.5"
							value={(s as {thickness?: number}).thickness ?? 1}
							onpointerdown={snap}
							oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShape(i, { thickness: e.shiftKey ? Math.round(v) : v }); }}
						/>
						<span class="hb-val">{(s as {thickness?: number}).thickness ?? 1}px</span>
					</label>

					<!-- Read-only position/size hints -->
					<div class="hb-hint-row">
						<span class="hb-hint-key">pos</span>
						<span class="hb-hint-val">{round3(s.x)}, {round3(s.y)}</span>
						<span class="hb-hint-action">drag figure</span>
					</div>
					<div class="hb-hint-row">
						<span class="hb-hint-key">size</span>
						<span class="hb-hint-val">{round3(s.size)} hr</span>
						<span class="hb-hint-action">drag handle ○</span>
					</div>
				</div>
				{/if}
			{:else}
				<!-- Multi-select panel -->
				{@const ref = shapes[selectedIdxs[0]]}
				{@const allFillable = selectedIdxs.every(i => { const t = shapes[i]?.type; return t === 'circle' || t === 'arc' || t === 'rect' || t === 'triangle'; })}
				{@const sharedType = selectedIdxs.every(i => shapes[i]?.type === ref?.type) ? ref?.type : null}
				{#if ref}
				<div class="hb-section">
					<h4 class="hb-section-hdr">{selectedIdxs.length} shapes</h4>

					{#if allFillable}
						{@const allFilled = selectedIdxs.every(i => (shapes[i] as {fill?: boolean}).fill ?? false)}
						<label class="hb-field">
							<span class="hb-label">fill</span>
							<input type="checkbox" checked={allFilled}
								onchange={(e) => updateShapes(selectedIdxs, { fill: (e.target as HTMLInputElement).checked })} />
						</label>
					{/if}

					{#if sharedType === 'arc'}
						{@const sp = (ref as {span?: number}).span ?? 180}
						<label class="hb-field">
							<span class="hb-label">span</span>
							<input class="hb-slider" type="range" min="10" max="360" step="5"
								value={sp}
								onpointerdown={snap}
								oninput={(e) => { const v = parseInt((e.target as HTMLInputElement).value); updateShapes(selectedIdxs, { span: e.shiftKey ? Math.round(v / 15) * 15 : v }); }}
							/>
							<span class="hb-val">{sp}°</span>
						</label>
					{/if}

					{#if sharedType === 'rect'}
						{@const asp = (ref as {aspect?: number}).aspect ?? 1}
						<label class="hb-field">
							<span class="hb-label">aspect</span>
							<input class="hb-slider" type="range" min="0.1" max="5" step="0.05"
								value={asp}
								onpointerdown={snap}
								oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShapes(selectedIdxs, { aspect: e.shiftKey ? Math.round(v * 2) / 2 : v }); }}
							/>
							<span class="hb-val">{asp.toFixed(2)}</span>
						</label>
					{/if}

					{#if sharedType === 'curve'}
						{@const bow = (ref as {curvature?: number}).curvature ?? 0.5}
						<label class="hb-field">
							<span class="hb-label">bow</span>
							<input class="hb-slider" type="range" min="-2" max="2" step="0.05"
								value={bow}
								onpointerdown={snap}
								oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShapes(selectedIdxs, { curvature: e.shiftKey ? Math.round(v * 4) / 4 : v }); }}
							/>
							<span class="hb-val">{bow.toFixed(2)}</span>
						</label>
					{/if}

					<label class="hb-field">
						<span class="hb-label">width</span>
						<input class="hb-slider" type="range" min="1" max="10" step="0.5"
							value={(ref as {thickness?: number}).thickness ?? 1}
							onpointerdown={snap}
							oninput={(e) => { const v = parseFloat((e.target as HTMLInputElement).value); updateShapes(selectedIdxs, { thickness: e.shiftKey ? Math.round(v) : v }); }}
						/>
						<span class="hb-val">{(ref as {thickness?: number}).thickness ?? 1}px</span>
					</label>
				</div>
				{/if}
			{/if}

			<!-- Settings + Saved -->
			<SaveManager
				itemId={hatId}
				saveDisabled={shapes.length === 0}
				{savedList}
				onsave={saveHat}
				onload={loadSaved}
				ondelete={deleteSaved}
				onimport={importFromJson}
			>
				<div class="hb-field hb-field-vert">
					<label class="hb-label" for="hb-id">ID</label>
					<input id="hb-id" class="hb-input" type="text" bind:value={hatId} />
				</div>
				<div class="hb-field hb-field-vert">
					<label class="hb-label" for="hb-lbl-in">Label</label>
					<input id="hb-lbl-in" class="hb-input" type="text" bind:value={hatLabel} />
				</div>
			</SaveManager>

			<!-- Presets -->
			<PresetList presets={presetItems} onload={loadPreset} />
		</div>
	</div>
</div>

<style>
	.hb {
		background: #0d0d0d;
		border: 1px solid #1a1a1a;
		border-radius: 6px;
		overflow: hidden;
		font-family: 'JetBrains Mono', monospace;
		color: #c8c8c8;
		font-size: 0.75rem;
	}

	.hb-layout {
		display: grid;
		grid-template-columns: 1fr 220px;
		min-height: 460px;
	}

	.hb-left {
		display: flex;
		flex-direction: column;
		border-right: 1px solid #1a1a1a;
		overflow: hidden;
	}

	.hb-canvas-wrap {
		display: flex;
		justify-content: center;
		padding: 0.75rem;
		background: #0a0a0a;
		border-bottom: 1px solid #181818;
		flex-shrink: 0;
	}

	.hb-canvas-wrap canvas {
		display: block;
		border-radius: 3px;
		border: 1px solid #1c1c1c;
	}

	.hb-shapes-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0.75rem;
		border-bottom: 1px solid #181818;
		flex-shrink: 0;
	}

	.hb-shapes-ctrls {
		display: flex;
		gap: 0.3rem;
		align-items: center;
	}

	.hb-divider {
		width: 1px;
		height: 12px;
		background: #222;
		margin: 0 0.1rem;
	}

	.hb-micro-lbl {
		font-size: 0.58rem;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.hb-shape-list {
		max-height: 96px;
		overflow-y: auto;
		flex-shrink: 0;
		border-bottom: 1px solid #181818;
	}

	.hb-shape-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.2rem 0.75rem;
		cursor: pointer;
		border-bottom: 1px solid #121212;
		transition: background 0.1s;
	}

	.hb-shape-row:hover { background: rgba(255,255,255,0.02); }
	.hb-shape-row.sel   { background: rgba(255,255,255,0.04); border-left: 2px solid hsl(190,50%,30%); }

	.hb-shape-type { font-size: 0.7rem; color: #888; flex-shrink: 0; }
	.hb-shape-pos  { font-size: 0.6rem; color: #333; flex: 1; padding: 0 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.hb-row-actions {
		display: flex;
		gap: 3px;
		align-items: center;
		flex-shrink: 0;
	}

	.hb-mirror-btn,
	.hb-del-btn {
		background: none;
		border: 1px solid #1e1e1e;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.6rem;
		line-height: 1;
		padding: 0.15rem 0.4rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.1s, color 0.1s, background 0.1s;
	}

	.hb-mirror-btn { color: #555; }
	.hb-mirror-btn:hover  { border-color: #333; color: #aaa; }
	.hb-mirror-btn.active { color: hsl(190,65%,50%); border-color: hsl(190,40%,24%); background: hsla(190,60%,30%,0.12); }

	.hb-del-btn { color: #555; }
	.hb-del-btn:hover { border-color: hsl(0,40%,28%); color: hsl(0,58%,52%); }

	.hb-empty {
		padding: 0.5rem 0.75rem;
		font-size: 0.65rem;
		color: #2a2a2a;
	}

	/* ── Right column ── */

	.hb-right {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: #0c0c0c;
	}

	.hb-section {
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid #181818;
		flex-shrink: 0;
	}

	.hb-section-hdr {
		font-size: 0.58rem;
		font-weight: 500;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0 0 0.55rem;
	}

	.hb-no-sel {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 80px;
	}

	.hb-no-sel-text {
		font-size: 0.65rem;
		color: #2a2a2a;
		text-align: center;
		line-height: 1.7;
		margin: 0;
	}

	.hb-no-sel-hint {
		font-size: 0.58rem;
		color: #222;
	}

	.hb-field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.3rem;
	}

	.hb-field-vert {
		flex-direction: column;
		align-items: stretch;
		gap: 0.2rem;
	}

	.hb-label {
		font-size: 0.62rem;
		color: #484848;
		min-width: 40px;
		flex-shrink: 0;
	}

	.hb-slider {
		flex: 1;
		accent-color: hsl(190,55%,38%);
		height: 3px;
		min-width: 0;
	}

	.hb-val {
		font-size: 0.6rem;
		color: #555;
		min-width: 36px;
		text-align: right;
	}

	.hb-hint-row {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-top: 0.35rem;
		padding-top: 0.35rem;
		border-top: 1px solid #141414;
	}

	.hb-hint-key    { font-size: 0.58rem; color: #353535; min-width: 28px; }
	.hb-hint-val    { font-size: 0.58rem; color: #444; flex: 1; }
	.hb-hint-action { font-size: 0.55rem; color: #2e2e2e; text-align: right; white-space: nowrap; }

	.hb-sel {
		background: #111;
		border: 1px solid #1e1e1e;
		color: #888;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.18rem 0.28rem;
		border-radius: 3px;
	}
	.hb-sel:focus { outline: none; border-color: hsl(190,50%,25%); }

	.hb-btn {
		background: none;
		border: 1px solid #1e1e1e;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.18rem 0.45rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.12s, color 0.12s;
		white-space: nowrap;
	}
	.hb-btn:hover:not(:disabled) { border-color: #383838; color: #aaa; }
	.hb-btn:disabled { opacity: 0.26; cursor: default; }

	.hb-input {
		background: #111;
		border: 1px solid #1e1e1e;
		color: #aaa;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.22rem 0.35rem;
		border-radius: 3px;
		width: 100%;
		box-sizing: border-box;
	}
	.hb-input:focus { outline: none; border-color: hsl(190,45%,23%); }
</style>
