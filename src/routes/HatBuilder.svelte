<script lang="ts">
	import { onMount } from 'svelte';
	import { DefaultHatDefs, createHat } from '$lib/index.js';
	import type { HatShape, HatLayerDef } from '$lib/index.js';
	import { createHistory } from '$lib/history.js';

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
	let selectedIdx: number | null = $state(null);
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

	function onKeyDown(e: KeyboardEvent) {
		if (document.activeElement instanceof HTMLInputElement) return;
		const mod = e.ctrlKey || e.metaKey;
		if (!mod) return;
		if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
		if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); doRedo(); }
	}

	// Drag state — plain vars (no reactivity; we mutate shapes[] to trigger re-render)
	type DragState = {
		mode: 'move' | 'resize';
		idx: number;
		startMX: number; startMY: number;
		startX: number; startY: number;
		startSize: number;
		centerX: number; centerY: number;
		// Offsets so the handle doesn't snap on grab:
		//   newSize  = dist(mouse, center)/HR  + sizeOffset
		//   newAngle = atan2(dy, dx)*180/π     + angleOffset
		sizeOffset: number;
		angleOffset: number;
	};
	let dragging: DragState | null = null;

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

	/** Reflect a shape across the vertical centre (x → −x, angle → −angle). */
	function computeMirror(s: HatShape): HatShape {
		const angle = (s as { angle?: number }).angle ?? 0;
		const m = { ...s, x: -s.x } as HatShape;
		if (s.type !== 'circle') (m as { angle?: number }).angle = -angle;
		return m;
	}

	// ── Hit testing ────────────────────────────────────────────────────

	function hitTest(mx: number, my: number): { type: 'shape' | 'handle'; idx: number } | null {
		// Handles take priority; check top-most (last) shape first
		for (let i = shapes.length - 1; i >= 0; i--) {
			const h = handleOf(shapes[i]);
			if (Math.hypot(mx - h.x, my - h.y) < 9) return { type: 'handle', idx: i };
		}
		for (let i = shapes.length - 1; i >= 0; i--) {
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

		const hit = hitTest(mx, my);
		if (hit) {
			snap(); // snapshot before any drag mutates shapes
			selectedIdx = hit.idx;
			const s = shapes[hit.idx];
			const c = centerOf(s);
			// Compute grab offsets so size/angle don't snap on the first frame
			const grabDist  = Math.hypot(mx - c.x, my - c.y);
			const grabAngle = Math.atan2(my - c.y, mx - c.x) * 180 / Math.PI;
			const shapeAngle = (s as { angle?: number }).angle ?? 0;
			dragging = {
				mode: hit.type === 'handle' ? 'resize' : 'move',
				idx: hit.idx,
				startMX: mx, startMY: my,
				startX: s.x, startY: s.y,
				startSize: s.size,
				centerX: c.x, centerY: c.y,
				sizeOffset:  s.size  - grabDist / HR,
				angleOffset: shapeAngle - grabAngle
			};
			canvasCursor = 'grabbing';
			e.preventDefault();
		} else {
			selectedIdx = null;
			dragging = null;
		}
	}

	function onWindowMouseMove(e: MouseEvent) {
		if (!dragging) {
			// Update cursor hint
			if (canvas) {
				const rect = canvas.getBoundingClientRect();
				const mx = e.clientX - rect.left;
				const my = e.clientY - rect.top;
				// Only update cursor if mouse is within canvas bounds
				if (mx >= 0 && mx <= CW && my >= 0 && my <= CH) {
					const hit = hitTest(mx, my);
					canvasCursor = hit ? (hit.type === 'handle' ? 'grab' : 'grab') : 'crosshair';
				}
			}
			return;
		}

		const rect = canvas.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		const d = dragging;
		if (d.mode === 'move') {
			const dx = (mx - d.startMX) / HR;
			const dy = (my - d.startMY) / HR;
			shapes = shapes.map((s, i) => i === d.idx
				? { ...s, x: round3(d.startX + dx), y: round3(d.startY + dy) } as HatShape
				: s
			);
		} else {
			// Resize + rotate via polar coords, offset-corrected so no snap on grab
			const dx = mx - d.centerX;
			const dy = my - d.centerY;
			const newSize  = Math.max(0.05, round3(Math.hypot(dx, dy) / HR + d.sizeOffset));
			const newAngle = round3(Math.atan2(dy, dx) * 180 / Math.PI + d.angleOffset);
			shapes = shapes.map((s, i) => {
				if (i !== d.idx) return s;
				if (s.type === 'circle') return { ...s, size: newSize } as HatShape;
				return { ...s, size: newSize, angle: newAngle } as HatShape;
			});
		}
	}

	function onWindowMouseUp() { dragging = null; canvasCursor = 'crosshair'; }

	// ── Shape management ───────────────────────────────────────────────

	function addShape() {
		snap();
		shapes  = [...shapes,  { ...SHAPE_DEFAULTS[addType] } as HatShape];
		mirrors = [...mirrors, false];
		selectedIdx = shapes.length - 1;
	}

	function deleteShapeAt(idx: number) {
		snap();
		shapes  = shapes.filter((_, i)  => i !== idx);
		mirrors = mirrors.filter((_, i) => i !== idx);
		if (selectedIdx === idx) {
			selectedIdx = shapes.length > 0 ? Math.min(idx, shapes.length - 1) : null;
		} else if (selectedIdx !== null && selectedIdx > idx) {
			selectedIdx = selectedIdx - 1;
		}
	}

	function toggleMirror(idx: number) {
		snap();
		mirrors = mirrors.map((m, i) => i === idx ? !m : m);
	}

	function updateShape(i: number, patch: Record<string, unknown>) {
		shapes = shapes.map((s, idx) => idx === i ? { ...s, ...patch } as HatShape : s);
	}

	// ── Presets ────────────────────────────────────────────────────────

	function loadPreset(key: string) {
		snap();
		const def = DefaultHatDefs[key];
		if (!def) return;
		hatId = def.id; hatLabel = def.label;
		shapes  = def.shapes.map(s => ({ ...s }) as HatShape);
		mirrors = shapes.map(() => false);
		selectedIdx = shapes.length > 0 ? 0 : null;
	}

	// ── Code generation ────────────────────────────────────────────────

	function round3(n: number) { return Math.round(n * 1000) / 1000; }

	function fmtShape(s: HatShape): string {
		const { type, x, y, size, ...rest } = s as HatShape & Record<string, unknown>;
		const pos = `x: ${round3(x as number)}, y: ${round3(y as number)}, size: ${round3(size as number)}`;
		const extras = Object.entries(rest)
			.filter(([k, v]) => v !== undefined && !(k === 'thickness' && v === 1))
			.map(([k, v]) => typeof v === 'boolean' ? `${k}: ${v}` : `${k}: ${round3(v as number)}`);
		return `    { type: '${type}', ${pos}${extras.length ? ', ' + extras.join(', ') : ''} }`;
	}

	function expandedShapeLines(): string[] {
		const lines: string[] = [];
		for (let i = 0; i < shapes.length; i++) {
			lines.push(fmtShape(shapes[i]));
			if (mirrors[i]) lines.push(fmtShape(computeMirror(shapes[i])));
		}
		return lines;
	}

	let generatedCode = $derived(
		shapes.length === 0
			? '// add shapes to generate code'
			: `createHat({\n  id: '${hatId}',\n  label: '${hatLabel}',\n  shapes: [\n${expandedShapeLines().join(',\n')}\n  ]\n})`
	);

	async function copyCode() { await navigator.clipboard.writeText(generatedCode); }

	// ── Canvas rendering ────────────────────────────────────────────────

	function setupCanvas() {
		const dpr = window.devicePixelRatio || 1;
		canvas.width = CW * dpr; canvas.height = CH * dpr;
		canvas.style.width = `${CW}px`; canvas.style.height = `${CH}px`;
	}

	function render() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;
		const dpr = window.devicePixelRatio || 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, CW, CH);

		// Grid
		ctx.strokeStyle = '#181818'; ctx.lineWidth = 1;
		for (let x = 0; x <= CW; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke(); }
		for (let y = 0; y <= CH; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke(); }

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

		// Head circle (drawn first — hat shapes will overdraw as intended)
		ctx.beginPath();
		ctx.arc(HX, HY, HR, 0, Math.PI * 2);
		ctx.fill(); ctx.stroke();

		// Hat shapes (originals)
		if (shapes.length > 0) {
			createHat({ id: hatId, label: hatLabel, shapes } satisfies HatLayerDef)
				.draw(ctx, HX, HY, HR, 0, color);
		}

		// Ghost mirror copies — drawn at reduced opacity, no handles
		const mirrorShapes = shapes.filter((_, i) => mirrors[i]).map(computeMirror);
		if (mirrorShapes.length > 0) {
			ctx.save();
			ctx.globalAlpha = 0.45;
			createHat({ id: '', label: '', shapes: mirrorShapes })
				.draw(ctx, HX, HY, HR, 0, color);
			ctx.restore();
		}

		// Selection overlay
		if (selectedIdx !== null && shapes[selectedIdx]) {
			const s = shapes[selectedIdx];
			const { x: cx, y: cy } = centerOf(s);
			const { x: hx, y: hy } = handleOf(s);

			ctx.save();

			// Dashed selection ring
			ctx.setLineDash([3, 3]);
			ctx.strokeStyle = 'rgba(255,255,255,0.18)';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(cx, cy, s.size * HR + 6, 0, Math.PI * 2);
			ctx.stroke();
			ctx.setLineDash([]);

			// Centre dot
			ctx.fillStyle = 'rgba(255,255,255,0.5)';
			ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2); ctx.fill();

			// Connector line to handle
			ctx.strokeStyle = 'rgba(255,255,255,0.15)';
			ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(hx, hy); ctx.stroke();

			// Resize handle
			ctx.strokeStyle = 'rgba(255,255,255,0.55)';
			ctx.fillStyle   = '#111';
			ctx.lineWidth   = 1;
			ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

			ctx.restore();
		}
	}

	onMount(() => {
		setupCanvas();
		render();
		return () => {};
	});

	$effect(() => {
		shapes; mirrors; hatId; hatLabel; selectedIdx;
		render();
	});
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} onkeydown={onKeyDown} />

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
						class:sel={selectedIdx === i}
						onclick={() => { selectedIdx = i; }}
						role="button" tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && (selectedIdx = i)}
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
			<div class="hb-code">
				<div class="hb-code-hdr">
					<span class="hb-micro-lbl">generated code</span>
					<button class="hb-copy" onclick={copyCode}>copy</button>
				</div>
				<pre class="hb-code-body">{generatedCode}</pre>
			</div>
		</div>

		<!-- ── RIGHT: params + settings + presets ───────────────────── -->
		<div class="hb-right">

			<!-- Shape parameters -->
			{#if selectedIdx !== null && shapes[selectedIdx]}
				{@const s = shapes[selectedIdx]}
				{@const i = selectedIdx}
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
								oninput={(e) => updateShape(i, { span: parseInt((e.target as HTMLInputElement).value) })}
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
								oninput={(e) => updateShape(i, { aspect: parseFloat((e.target as HTMLInputElement).value) })}
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
								oninput={(e) => updateShape(i, { curvature: parseFloat((e.target as HTMLInputElement).value) })}
							/>
							<span class="hb-val">{bow.toFixed(2)}</span>
						</label>
					{/if}

					<!-- Thickness — all shapes -->
					<label class="hb-field">
						<span class="hb-label">width</span>
						<input class="hb-slider" type="range" min="1" max="10" step="0.5"
							value={(s as {thickness?: number}).thickness ?? 1}
							onpointerdown={snap}
							oninput={(e) => updateShape(i, { thickness: parseFloat((e.target as HTMLInputElement).value) })}
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
			{:else}
				<div class="hb-section hb-no-sel">
					<p class="hb-no-sel-text">Click a shape in the<br>preview to edit it</p>
				</div>
			{/if}

			<!-- Settings -->
			<div class="hb-section">
				<h4 class="hb-section-hdr">Settings</h4>
				<div class="hb-field hb-field-vert">
					<label class="hb-label" for="hb-id">ID</label>
					<input id="hb-id" class="hb-input" type="text" bind:value={hatId} />
				</div>
				<div class="hb-field hb-field-vert">
					<label class="hb-label" for="hb-lbl-in">Label</label>
					<input id="hb-lbl-in" class="hb-input" type="text" bind:value={hatLabel} />
				</div>
			</div>

			<!-- Presets -->
			<div class="hb-section">
				<h4 class="hb-section-hdr">Presets</h4>
				<div class="hb-preset-list">
					{#each Object.keys(DefaultHatDefs) as key}
						<button class="hb-preset" onclick={() => loadPreset(key)}>
							{DefaultHatDefs[key].label}
						</button>
					{/each}
				</div>
			</div>
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

	/* ── Left column ── */

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

	/* ── Shape list bar ── */

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

	/* ── Code ── */

	.hb-code {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		min-height: 80px;
	}

	.hb-code-hdr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.3rem 0.75rem;
		border-top: 1px solid #181818;
		flex-shrink: 0;
	}

	.hb-copy {
		background: none;
		border: 1px solid #1e1e1e;
		color: #484848;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		padding: 0.1rem 0.4rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.15s, color 0.15s;
	}
	.hb-copy:hover { border-color: #383838; color: #999; }

	.hb-code-body {
		flex: 1;
		margin: 0;
		padding: 0.5rem 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		color: #555;
		line-height: 1.6;
		white-space: pre;
		overflow: auto;
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

	/* ── Fields ── */

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

	.hb-preset-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.hb-preset {
		background: none;
		border: 1px solid #181818;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.26rem 0.5rem;
		text-align: left;
		cursor: crosshair;
		border-radius: 3px;
		transition: border-color 0.1s, color 0.1s;
	}
	.hb-preset:hover { border-color: #2c2c2c; color: #aaa; }
</style>
