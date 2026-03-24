<script lang="ts">
	import { onMount } from 'svelte';
	import { DefaultAnimations } from '$lib/index.js';
	import { anglesToPose, resolveAnglesAtTime } from '$lib/engine/animations/resolver.js';
	import { BASE_BODY, BONES } from '$lib/engine/types.js';
	import type { AnimKeyframe, JointAngles, EasingType, Pose } from '$lib/index.js';
	import { createHistory } from '$lib/history.js';

	// ── Types ─────────────────────────────────────────────────────────

	type RequiredAngles = Required<JointAngles>;
	const EASINGS: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'step'];

	const DEFAULT_ANGLES: RequiredAngles = {
		torso: 0, head: 0,
		shoulderL: 11, elbowL: 6,
		shoulderR: -11, elbowR: -6,
		hipL: 3, kneeL: 0,
		hipR: -3, kneeR: 0
	};
	const DEF_SCALE = { legLength: 1, armLength: 1, headSize: 1 };

	// ── State ─────────────────────────────────────────────────────────

	let angles: RequiredAngles = $state({ ...DEFAULT_ANGLES });
	let offsetX = $state(0);
	let offsetY = $state(0);
	let keyframes: AnimKeyframe[] = $state([]);
	let selectedKfIdx: number | null = $state(null);
	let scrubTime = $state(0);
	let animId = $state('my-animation');
	let animType: 'cyclic' | 'oneshot' = $state('cyclic');
	let frameCount = $state(28);
	let playing = $state(false);
	let playSpeed = $state(1.0);
	let playRafId = 0;
	let playLastTime = 0;

	// Four mini canvas refs
	let canvasLoop: HTMLCanvasElement;
	let canvasPrev: HTMLCanvasElement;
	let canvasCurrent: HTMLCanvasElement;
	let canvasNext: HTMLCanvasElement;

	// Independent loop RAF state (plain vars — no reactivity needed)
	let loopPhase = 0;
	let loopRafId = 0;
	let loopLastTime = 0;

	// LOOP canvas reference animation ('' = show current edit)
	let loopRef = $state('');

	// ── Undo / Redo ────────────────────────────────────────────────────

	let canUndo = $state(false);
	let canRedo = $state(false);

	const history = createHistory(
		() => ({
			keyframes: keyframes.map(kf => ({
				...kf,
				joints: kf.joints ? { ...kf.joints } : undefined,
				offset: kf.offset ? { ...kf.offset } : undefined
			})),
			animId, animType, frameCount
		}),
		(snap) => {
			keyframes  = snap.keyframes;
			animId     = snap.animId;
			animType   = snap.animType;
			frameCount = snap.frameCount;
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

	type DragTarget =
		| { type: 'knob'; key: string; cx: number; cy: number; angleOffset: number }
		| { type: 'offset'; rect: DOMRect };
	let dragTarget: DragTarget | null = $state(null);

	// Mini canvas constants
	// body vertical extent: legLen(11) + torso(8) + neck(2) + head(3) = 24 local units
	// at MSCALE=3.6 → 86px; head top ≈ 14px from canvas top; feet at MCY=112
	const MW = 110, MH = 148;
	const MCX = MW / 2;
	const MCY = 112; // feet Y position
	const MSCALE = 3.6;

	// ── Angle helpers ─────────────────────────────────────────────────

	function norm(deg: number): number {
		let d = ((deg % 360) + 360) % 360;
		return d > 180 ? d - 360 : d;
	}

	function displayAngle(key: string): number {
		switch (key) {
			case 'head':   return angles.torso + angles.head;
			case 'elbowL': return angles.shoulderL + angles.elbowL;
			case 'elbowR': return angles.shoulderR + angles.elbowR;
			case 'kneeL':  return angles.hipL + angles.kneeL;
			case 'kneeR':  return angles.hipR + angles.kneeR;
			default:       return angles[key as keyof RequiredAngles];
		}
	}

	function setKnobAngle(key: string, deg: number) {
		const d = norm(deg);
		switch (key) {
			case 'torso':     angles = { ...angles, torso:     d }; break;
			case 'head':      angles = { ...angles, head:      norm(d - angles.torso) }; break;
			case 'shoulderL': angles = { ...angles, shoulderL: d }; break;
			case 'elbowL':    angles = { ...angles, elbowL:    norm(d - angles.shoulderL) }; break;
			case 'shoulderR': angles = { ...angles, shoulderR: d }; break;
			case 'elbowR':    angles = { ...angles, elbowR:    norm(d - angles.shoulderR) }; break;
			case 'hipL':      angles = { ...angles, hipL:      d }; break;
			case 'kneeL':     angles = { ...angles, kneeL:     norm(d - angles.hipL) }; break;
			case 'hipR':      angles = { ...angles, hipR:      d }; break;
			case 'kneeR':     angles = { ...angles, kneeR:     norm(d - angles.hipR) }; break;
		}
	}

	// ── Drag ──────────────────────────────────────────────────────────

	function onKnobMouseDown(e: MouseEvent, key: string) {
		e.preventDefault();
		snap(); // snapshot before drag auto-upserts keyframes
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		// Compute grab offset so the knob doesn't snap on first drag frame
		const grabAngle = Math.atan2(e.clientX - cx, e.clientY - cy) * 180 / Math.PI;
		const angleOffset = displayAngle(key) - grabAngle;
		dragTarget = { type: 'knob', key, cx, cy, angleOffset };
	}

	function onOffsetMouseDown(e: MouseEvent) {
		e.preventDefault();
		snap();
		dragTarget = { type: 'offset', rect: (e.currentTarget as HTMLElement).getBoundingClientRect() };
	}

	function onWindowMouseMove(e: MouseEvent) {
		if (!dragTarget) return;
		if (dragTarget.type === 'knob') {
			const dx = e.clientX - dragTarget.cx;
			const dy = e.clientY - dragTarget.cy;
			let deg = Math.atan2(dx, dy) * 180 / Math.PI + dragTarget.angleOffset;
			if (e.shiftKey) deg = Math.round(deg / 15) * 15;
			setKnobAngle(dragTarget.key, deg);
		} else {
			const { rect } = dragTarget;
			let ox = Math.max(-20, Math.min(20, ((e.clientX - rect.left) / rect.width - 0.5) * 40));
			let oy = Math.max(-12, Math.min(4,  (0.5 - (e.clientY - rect.top) / rect.height) * 32));
			if (e.shiftKey) { ox = Math.round(ox); oy = Math.round(oy); }
			offsetX = ox;
			offsetY = oy;
		}
		// Auto-upsert keyframe at current scrub position on every drag move
		upsertCurrentPose();
	}

	function onWindowMouseUp() { dragTarget = null; }

	// ── Keyframe management ───────────────────────────────────────────

	function upsertCurrentPose() {
		const kf: AnimKeyframe = {
			t: parseFloat(scrubTime.toFixed(3)),
			joints: { ...angles },
			offset: { x: offsetX, y: offsetY },
			easing: 'ease-in-out'
		};
		const existing = keyframes.findIndex(k => Math.abs(k.t - kf.t) < 0.01);
		if (existing >= 0) {
			keyframes = keyframes.map((k, i) => i === existing ? kf : k);
			selectedKfIdx = existing;
		} else {
			keyframes = [...keyframes, kf].sort((a, b) => a.t - b.t);
			selectedKfIdx = keyframes.findIndex(k => Math.abs(k.t - kf.t) < 0.01);
		}
	}

	/** Called by the + keyframe button — snapshots first. Drag auto-upsert skips this. */
	function addKeyframeManual() { snap(); upsertCurrentPose(); }

	function deleteKeyframe() {
		snap();
		if (selectedKfIdx === null) return;
		keyframes = keyframes.filter((_, i) => i !== selectedKfIdx);
		selectedKfIdx = null;
	}

	function selectKeyframe(idx: number) {
		selectedKfIdx = idx;
		const kf = keyframes[idx];
		scrubTime = kf.t;
		if (kf.joints) angles = { ...DEFAULT_ANGLES, ...kf.joints } as RequiredAngles;
		offsetX = kf.offset?.x ?? 0;
		offsetY = kf.offset?.y ?? 0;
	}

	function updateSelectedEasing(easing: EasingType) {
		snap();
		if (selectedKfIdx === null) return;
		keyframes = keyframes.map((k, i) => i === selectedKfIdx ? { ...k, easing } : k);
	}

	// ── Presets ───────────────────────────────────────────────────────

	function loadPreset(key: keyof typeof DefaultAnimations) {
		snap();
		const def = DefaultAnimations[key];
		animId = def.id; animType = def.type; frameCount = def.frameCount;
		keyframes = def.keyframes.map(kf => ({
			...kf,
			joints: { ...kf.joints },
			offset: kf.offset ? { ...kf.offset } : undefined
		}));
		selectedKfIdx = null; scrubTime = 0;
		if (keyframes.length > 0) selectKeyframe(0);
	}

	// ── Code generation ───────────────────────────────────────────────

	function round1(n: number) { return Math.round(n * 10) / 10; }

	function fmtKf(kf: AnimKeyframe): string {
		const parts: string[] = [`t: ${round1(kf.t)}`];
		if (kf.easing && kf.easing !== 'linear') parts.push(`easing: '${kf.easing}'`);
		if (kf.joints) {
			const jp = Object.entries(kf.joints)
				.filter(([, v]) => v !== undefined)
				.map(([k, v]) => `${k}: ${round1(v as number)}`);
			if (jp.length) parts.push(`joints: { ${jp.join(', ')} }`);
		}
		if (kf.offset && (kf.offset.x || kf.offset.y)) {
			const op: string[] = [];
			if (kf.offset.x) op.push(`x: ${round1(kf.offset.x)}`);
			if (kf.offset.y) op.push(`y: ${round1(kf.offset.y)}`);
			if (op.length) parts.push(`offset: { ${op.join(', ')} }`);
		}
		return `    { ${parts.join(', ')} }`;
	}

	let generatedCode = $derived(
		keyframes.length === 0
			? '// drag a knob to add keyframes'
			: `createKeyframeAnimation({\n  id: '${animId}',\n  type: '${animType}',\n  frameCount: ${frameCount},\n  keyframes: [\n${keyframes.map(fmtKf).join(',\n')}\n  ]\n})`
	);

	async function copyCode() { await navigator.clipboard.writeText(generatedCode); }

	// ── Canvas rendering ──────────────────────────────────────────────

	function setupCanvas(c: HTMLCanvasElement) {
		const dpr = window.devicePixelRatio || 1;
		c.width = MW * dpr; c.height = MH * dpr;
		c.style.width = `${MW}px`; c.style.height = `${MH}px`;
	}

	function bgMini(ctx: CanvasRenderingContext2D) {
		const dpr = window.devicePixelRatio || 1;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, MW, MH);
		ctx.strokeStyle = '#181818'; ctx.lineWidth = 1;
		for (let x = 0; x <= MW; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MH); ctx.stroke(); }
		for (let y = 0; y <= MH; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MW, y); ctx.stroke(); }
		ctx.strokeStyle = '#252525'; ctx.setLineDash([3, 3]);
		ctx.beginPath(); ctx.moveTo(0, MCY); ctx.lineTo(MW, MCY); ctx.stroke();
		ctx.setLineDash([]);
	}

	function drawFig(ctx: CanvasRenderingContext2D, pose: Pose, alpha = 1, hue = 190) {
		ctx.save();
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = `hsl(${hue}, 65%, 58%)`;
		ctx.fillStyle = `hsla(${hue}, 65%, 58%, 0.22)`;
		ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		for (const [from, to] of BONES) {
			const a = { x: MCX + pose[from].x * MSCALE, y: MCY + pose[from].y * MSCALE };
			const b = { x: MCX + pose[to].x * MSCALE, y: MCY + pose[to].y * MSCALE };
			ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
		}
		const hd = { x: MCX + pose.head.x * MSCALE, y: MCY + pose.head.y * MSCALE };
		ctx.beginPath(); ctx.arc(hd.x, hd.y, BASE_BODY.headRadius * MSCALE, 0, Math.PI * 2);
		ctx.fill(); ctx.stroke();
		ctx.restore();
	}

	function poseFrom(ang: RequiredAngles, ox: number, oy: number): Pose {
		return anglesToPose(ang, DEF_SCALE, ox, oy);
	}

	function kfAngles(kf: AnimKeyframe): { ang: RequiredAngles; ox: number; oy: number } {
		return {
			ang: { ...DEFAULT_ANGLES, ...kf.joints } as RequiredAngles,
			ox: kf.offset?.x ?? 0,
			oy: kf.offset?.y ?? 0
		};
	}

	function getPrevKf(): AnimKeyframe | null {
		if (!keyframes.length) return null;
		let best: AnimKeyframe | null = null;
		for (const kf of keyframes) { if (kf.t <= scrubTime) best = kf; }
		return best ?? keyframes[0];
	}

	function getNextKf(): AnimKeyframe | null {
		if (!keyframes.length) return null;
		for (const kf of keyframes) { if (kf.t > scrubTime) return kf; }
		return keyframes[keyframes.length - 1];
	}

	/** Returns the index of the prev/next keyframe for click-to-select. */
	function getPrevKfIdx(): number | null {
		if (!keyframes.length) return null;
		let bestIdx = 0;
		for (let i = 0; i < keyframes.length; i++) {
			if (keyframes[i].t <= scrubTime) bestIdx = i;
		}
		return bestIdx;
	}

	function getNextKfIdx(): number | null {
		if (!keyframes.length) return null;
		for (let i = 0; i < keyframes.length; i++) {
			if (keyframes[i].t > scrubTime) return i;
		}
		return keyframes.length - 1;
	}

	// Renders the LOOP canvas only (called by independent RAF)
	function renderLoopCanvas() {
		if (!canvasLoop) return;
		const ctx = canvasLoop.getContext('2d')!;
		bgMini(ctx);
		const ref = loopRef ? DefaultAnimations[loopRef as keyof typeof DefaultAnimations] : null;
		const kfs = ref ? ref.keyframes : keyframes;
		const type = ref ? ref.type : animType;
		if (kfs.length >= 1) {
			const { angles: a, offsetX: ox, offsetY: oy } = resolveAnglesAtTime(kfs, loopPhase, type === 'cyclic');
			drawFig(ctx, poseFrom(a, ox, oy));
		} else {
			drawFig(ctx, poseFrom(DEFAULT_ANGLES, 0, 0), 0.2);
		}
	}

	// Renders prev, current, next canvases (called reactively)
	function renderThree() {
		if (!canvasPrev || !canvasCurrent || !canvasNext) return;

		// PREV KF — orange tint
		{
			const ctx = canvasPrev.getContext('2d')!;
			bgMini(ctx);
			const kf = getPrevKf();
			if (kf) {
				const { ang, ox, oy } = kfAngles(kf);
				drawFig(ctx, poseFrom(ang, ox, oy), 0.75, 38);
			} else {
				drawFig(ctx, poseFrom(DEFAULT_ANGLES, 0, 0), 0.15);
			}
		}

		// CURRENT — cyan (full brightness)
		{
			const ctx = canvasCurrent.getContext('2d')!;
			bgMini(ctx);
			drawFig(ctx, poseFrom(angles, offsetX, offsetY));
		}

		// NEXT KF — blue tint
		{
			const ctx = canvasNext.getContext('2d')!;
			bgMini(ctx);
			const kf = getNextKf();
			if (kf) {
				const { ang, ox, oy } = kfAngles(kf);
				drawFig(ctx, poseFrom(ang, ox, oy), 0.75, 220);
			} else {
				drawFig(ctx, poseFrom(DEFAULT_ANGLES, 0, 0), 0.15);
			}
		}
	}

	// ── Playback ──────────────────────────────────────────────────────

	function startPlayback() {
		playing = true; playLastTime = performance.now();
		function loop(now: number) {
			const dt = (now - playLastTime) / 1000; playLastTime = now;
			scrubTime += (dt * playSpeed) / (frameCount / 36);
			if (animType === 'cyclic') {
				scrubTime = scrubTime % 1;
			} else {
				if (scrubTime >= 1) { scrubTime = 1; playing = false; return; }
			}
			if (playing) playRafId = requestAnimationFrame(loop);
		}
		playRafId = requestAnimationFrame(loop);
	}

	function stopPlayback() { playing = false; cancelAnimationFrame(playRafId); }
	function togglePlay() { if (playing) stopPlayback(); else startPlayback(); }

	// ── Independent loop RAF ──────────────────────────────────────────

	function startLoopRaf() {
		loopLastTime = performance.now();
		function tick(now: number) {
			const dt = (now - loopLastTime) / 1000; loopLastTime = now;
			const ref = loopRef ? DefaultAnimations[loopRef as keyof typeof DefaultAnimations] : null;
			const fc = ref ? ref.frameCount : frameCount;
			loopPhase = (loopPhase + dt / (fc / 36)) % 1;
			renderLoopCanvas();
			loopRafId = requestAnimationFrame(tick);
		}
		loopRafId = requestAnimationFrame(tick);
	}

	// ── Lifecycle ─────────────────────────────────────────────────────

	onMount(() => {
		[canvasLoop, canvasPrev, canvasCurrent, canvasNext].forEach(setupCanvas);
		renderThree();
		renderLoopCanvas();
		startLoopRaf();
		return () => { stopPlayback(); cancelAnimationFrame(loopRafId); };
	});

	// Sync knobs from timeline position when not dragging
	$effect(() => {
		const t = scrubTime;
		const kfs = keyframes;
		const type = animType;
		if (!dragTarget && kfs.length > 0) {
			const { angles: a, offsetX: ox, offsetY: oy } = resolveAnglesAtTime(kfs, t, type === 'cyclic');
			angles = a;
			offsetX = ox;
			offsetY = oy;
		}
	});

	// Re-render prev/current/next whenever relevant state changes
	$effect(() => {
		angles; offsetX; offsetY; keyframes; scrubTime;
		renderThree();
	});
</script>

<svelte:window onmousemove={onWindowMouseMove} onmouseup={onWindowMouseUp} onkeydown={onKeyDown} />

{#snippet knob(key: string, label: string)}
	{@const abs = displayAngle(key)}
	{@const rad = abs * Math.PI / 180}
	{@const dotX = 26 + Math.sin(rad) * 18}
	{@const dotY = 26 + Math.cos(rad) * 18}
	{@const active = dragTarget?.type === 'knob' && dragTarget.key === key}
	<div
		class="ae-knob"
		class:active
		onmousedown={(e) => onKnobMouseDown(e, key)}
		role="slider"
		tabindex="0"
		aria-label={label}
		aria-valuenow={Math.round(abs)}
	>
		<svg class="ae-knob-svg" viewBox="0 0 52 52">
			<circle cx="26" cy="26" r="21" fill="none" stroke={active ? '#383838' : '#1e1e1e'} stroke-width="1.5"/>
			<line x1="26" y1="45" x2="26" y2="47" stroke="#2a2a2a" stroke-width="1"/>
			<line x1="26" y1="26" x2={dotX} y2={dotY}
				stroke="hsl(190,50%,30%)" stroke-width="1.5" stroke-linecap="round"/>
			<circle cx="26" cy="26" r="2" fill="#2e2e2e"/>
			<circle cx={dotX} cy={dotY} r="4"
				fill={active ? 'hsl(190,80%,70%)' : 'hsl(190,65%,52%)'}/>
		</svg>
		<span class="ae-knob-lbl">{label}</span>
		<span class="ae-knob-val">{Math.round(abs)}°</span>
	</div>
{/snippet}

{#snippet offpad()}
	{@const px = 26 + Math.max(-17, Math.min(17, (offsetX / 20) * 17))}
	{@const py = 26 - Math.max(-17, Math.min(17, (offsetY / 12) * 17))}
	{@const active = dragTarget?.type === 'offset'}
	<div
		class="ae-knob"
		class:active
		onmousedown={onOffsetMouseDown}
		role="slider"
		tabindex="0"
		aria-label="Offset"
		aria-valuenow={0}
	>
		<svg class="ae-knob-svg" viewBox="0 0 52 52">
			<circle cx="26" cy="26" r="21" fill="none" stroke={active ? '#383838' : '#1e1e1e'} stroke-width="1.5"/>
			<line x1="26" y1="8" x2="26" y2="44" stroke="#1e1e1e" stroke-width="1"/>
			<line x1="8" y1="26" x2="44" y2="26" stroke="#1e1e1e" stroke-width="1"/>
			<circle cx="26" cy="26" r="1.5" fill="#2a2a2a"/>
			<circle cx={px} cy={py} r="4"
				fill={active ? 'hsl(190,80%,70%)' : 'hsl(190,65%,52%)'}/>
		</svg>
		<span class="ae-knob-lbl">OFFSET</span>
		<span class="ae-knob-val">{round1(offsetX)},{round1(offsetY)}</span>
	</div>
{/snippet}

<div class="ae" class:dragging={dragTarget !== null}>
	<div class="ae-layout">

		<!-- ── LEFT: preview + controls + code ──────────────────────── -->
		<div class="ae-left">

			<!-- 4-figure preview row -->
			<div class="ae-preview">
				<!-- LOOP: always playing; select picks reference animation -->
				<div class="ae-fig">
					<canvas bind:this={canvasLoop}></canvas>
					<select class="ae-loop-ref" bind:value={loopRef}>
						<option value="">LOOP</option>
						{#each Object.keys(DefaultAnimations) as key}
							<option value={key}>{key}</option>
						{/each}
					</select>
				</div>
				<!-- PREV KF: click to select that keyframe -->
				<div
					class="ae-fig ae-fig-dim"
					class:ae-fig-selectable={keyframes.length > 0}
					onclick={() => { const idx = getPrevKfIdx(); if (idx !== null) selectKeyframe(idx); }}
					role="button"
					tabindex={keyframes.length > 0 ? 0 : -1}
					aria-label="Select previous keyframe"
					onkeydown={(e) => { if (e.key === 'Enter') { const idx = getPrevKfIdx(); if (idx !== null) selectKeyframe(idx); } }}
				>
					<canvas bind:this={canvasPrev}></canvas>
					<span class="ae-fig-lbl" style="color: hsl(38,60%,40%)">PREV KF</span>
				</div>
				<!-- CURRENT: live pose -->
				<div class="ae-fig ae-fig-active">
					<canvas bind:this={canvasCurrent}></canvas>
					<span class="ae-fig-lbl" style="color: hsl(190,60%,45%)">CURRENT</span>
				</div>
				<!-- NEXT KF: click to select that keyframe -->
				<div
					class="ae-fig ae-fig-dim"
					class:ae-fig-selectable={keyframes.length > 0}
					onclick={() => { const idx = getNextKfIdx(); if (idx !== null) selectKeyframe(idx); }}
					role="button"
					tabindex={keyframes.length > 0 ? 0 : -1}
					aria-label="Select next keyframe"
					onkeydown={(e) => { if (e.key === 'Enter') { const idx = getNextKfIdx(); if (idx !== null) selectKeyframe(idx); } }}
				>
					<canvas bind:this={canvasNext}></canvas>
					<span class="ae-fig-lbl" style="color: hsl(220,60%,52%)">NEXT KF</span>
				</div>
			</div>

			<!-- Playback controls -->
			<div class="ae-playback">
				<button class="ae-play" onclick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
					{#if playing}
						<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
							<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
						</svg>
					{:else}
						<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
							<polygon points="5,3 19,12 5,21"/>
						</svg>
					{/if}
				</button>
				<input
					class="ae-scrub"
					type="range" min="0" max="1" step="0.001"
					bind:value={scrubTime}
					oninput={stopPlayback}
				/>
				<select class="ae-speed" bind:value={playSpeed}>
					<option value={0.5}>0.5×</option>
					<option value={1.0}>1×</option>
					<option value={2.0}>2×</option>
				</select>
			</div>

			<!-- Timeline -->
			<div class="ae-tl-wrap">
				<div
					class="ae-tl"
					onclick={(e) => {
						const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
						scrubTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
						stopPlayback();
					}}
					onkeydown={(e) => {
						if (e.key === 'ArrowRight') { scrubTime = Math.min(1, scrubTime + 0.01); stopPlayback(); }
						if (e.key === 'ArrowLeft')  { scrubTime = Math.max(0, scrubTime - 0.01); stopPlayback(); }
					}}
					role="slider"
					tabindex="0"
					aria-label="Timeline"
					aria-valuenow={scrubTime}
				>
					<div class="ae-tl-head" style="left: {scrubTime * 100}%"></div>
					{#each keyframes as kf, i}
						<div
							class="ae-kf-marker"
							class:sel={selectedKfIdx === i}
							style="left: {kf.t * 100}%"
							onclick={(e) => { e.stopPropagation(); selectKeyframe(i); }}
							role="button" tabindex="0" aria-label="Keyframe at {kf.t}"
							onkeydown={(e) => e.key === 'Enter' && selectKeyframe(i)}
						></div>
					{/each}
				</div>

				<div class="ae-tl-actions">
					<button class="ae-btn" onclick={addKeyframeManual}>+ keyframe</button>
					<button class="ae-btn ae-btn-danger" onclick={deleteKeyframe} disabled={selectedKfIdx === null}>
						delete
					</button>
					{#if selectedKfIdx !== null}
						<select
							class="ae-sel"
							value={keyframes[selectedKfIdx]?.easing ?? 'linear'}
							onchange={(e) => updateSelectedEasing((e.target as HTMLSelectElement).value as EasingType)}
						>
							{#each EASINGS as e}
								<option value={e}>{e}</option>
							{/each}
						</select>
					{/if}
					<div class="ae-tl-spacer"></div>
					<button class="ae-btn" onclick={doUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">undo</button>
					<button class="ae-btn" onclick={doRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">redo</button>
				</div>
			</div>

			<!-- Generated code -->
			<div class="ae-code">
				<div class="ae-code-hdr">
					<span class="ae-code-lbl">generated code</span>
					<button class="ae-copy" onclick={copyCode}>copy</button>
				</div>
				<pre class="ae-code-body">{generatedCode}</pre>
			</div>
		</div>

		<!-- ── RIGHT: knobs + settings + presets ─────────────────────── -->
		<div class="ae-right">

			<!-- Skeleton knob grid -->
			<div class="ae-skel">
				<div class="ae-skel-row">
					<div></div>
					{@render knob('head', 'HEAD')}
					<div></div>
				</div>
				<div class="ae-skel-row">
					{@render knob('shoulderL', 'SH·L')}
					{@render knob('torso', 'TORSO')}
					{@render knob('shoulderR', 'SH·R')}
				</div>
				<div class="ae-skel-row">
					{@render knob('elbowL', 'EL·L')}
					<div></div>
					{@render knob('elbowR', 'EL·R')}
				</div>
				<div class="ae-skel-row">
					{@render knob('hipL', 'HIP·L')}
					{@render offpad()}
					{@render knob('hipR', 'HIP·R')}
				</div>
				<div class="ae-skel-row">
					{@render knob('kneeL', 'KN·L')}
					<div></div>
					{@render knob('kneeR', 'KN·R')}
				</div>
			</div>

			<!-- Settings -->
			<div class="ae-section">
				<h4 class="ae-section-hdr">Settings</h4>
				<div class="ae-field">
					<label class="ae-label" for="ae-anim-id">ID</label>
					<input id="ae-anim-id" class="ae-input" type="text" bind:value={animId} />
				</div>
				<div class="ae-field">
					<label class="ae-label" for="ae-anim-type">Type</label>
					<select id="ae-anim-type" class="ae-sel" bind:value={animType}>
						<option value="cyclic">cyclic</option>
						<option value="oneshot">oneshot</option>
					</select>
				</div>
				<div class="ae-field">
					<label class="ae-label" for="ae-frame-count">Frames</label>
					<input id="ae-frame-count" class="ae-input" type="number" min="1" max="240" bind:value={frameCount} />
				</div>
			</div>

			<!-- Presets -->
			<div class="ae-section ae-section-presets">
				<h4 class="ae-section-hdr">Presets</h4>
				<div class="ae-preset-list">
					{#each Object.keys(DefaultAnimations) as key}
						<button class="ae-preset" onclick={() => loadPreset(key as keyof typeof DefaultAnimations)}>
							{key}
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.ae {
		background: #0d0d0d;
		border: 1px solid #1a1a1a;
		border-radius: 6px;
		overflow: hidden;
		font-family: 'JetBrains Mono', monospace;
		color: #c8c8c8;
		font-size: 0.75rem;
	}

	.ae.dragging { cursor: crosshair; user-select: none; -webkit-user-select: none; }

	.ae-layout {
		display: grid;
		grid-template-columns: 1fr 254px;
		min-height: 480px;
	}

	/* ── Left column ── */

	.ae-left {
		display: flex;
		flex-direction: column;
		border-right: 1px solid #1a1a1a;
		overflow: hidden;
	}

	/* ── 4-figure preview row ── */

	.ae-preview {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		padding: 0.75rem 0.75rem 0.5rem;
		background: #0a0a0a;
		border-bottom: 1px solid #181818;
	}

	.ae-fig {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5px;
	}

	.ae-fig canvas {
		display: block;
		border-radius: 3px;
		border: 1px solid #1c1c1c;
	}

	.ae-fig.ae-fig-active canvas {
		border-color: hsl(190, 40%, 20%);
	}

	.ae-fig.ae-fig-dim canvas {
		opacity: 0.85;
	}

	.ae-fig-selectable {
		cursor: pointer;
		border-radius: 4px;
		transition: background 0.12s;
	}
	.ae-fig-selectable:hover { background: rgba(255,255,255,0.025); }
	.ae-fig-selectable:hover canvas { border-color: #2a2a2a; }

	.ae-loop-ref {
		width: 100%;
		background: transparent;
		border: none;
		border-top: 1px solid #1c1c1c;
		color: #363636;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.47rem;
		padding: 0.18rem 0;
		text-align: center;
		cursor: pointer;
		letter-spacing: 0.06em;
		appearance: none;
		-webkit-appearance: none;
	}
	.ae-loop-ref:focus { outline: none; color: #666; }
	.ae-loop-ref option { background: #111; color: #888; }

	.ae-fig-lbl {
		font-size: 0.52rem;
		color: #383838;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	/* ── Playback ── */

	.ae-playback {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #181818;
	}

	.ae-play {
		background: none;
		border: 1px solid #252525;
		color: hsl(190, 65%, 55%);
		width: 26px; height: 26px;
		border-radius: 50%;
		display: flex; align-items: center; justify-content: center;
		cursor: crosshair;
		flex-shrink: 0;
		transition: border-color 0.15s;
	}
	.ae-play:hover { border-color: hsl(190, 55%, 30%); }

	.ae-scrub {
		flex: 1;
		accent-color: hsl(190, 65%, 45%);
		height: 3px;
	}

	.ae-speed {
		width: 52px;
		background: #111;
		border: 1px solid #222;
		color: #666;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.18rem 0.25rem;
		border-radius: 3px;
	}

	/* ── Timeline ── */

	.ae-tl-wrap {
		padding: 0.6rem 0.75rem;
		border-bottom: 1px solid #181818;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.ae-tl {
		position: relative;
		height: 22px;
		background: #111;
		border: 1px solid #1e1e1e;
		border-radius: 3px;
		cursor: crosshair;
	}

	.ae-tl-head {
		position: absolute;
		top: -2px; bottom: -2px; width: 2px;
		background: hsl(190, 65%, 48%);
		transform: translateX(-50%);
		pointer-events: none;
	}

	.ae-kf-marker {
		position: absolute;
		top: 50%; width: 9px; height: 9px;
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 50%;
		transform: translate(-50%, -50%);
		cursor: crosshair;
		transition: background 0.1s, border-color 0.1s;
	}
	.ae-kf-marker.sel { background: hsl(190, 65%, 45%); border-color: hsl(190, 75%, 65%); }

	.ae-tl-actions {
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}

	.ae-tl-spacer { flex: 1; }

	.ae-btn {
		background: none;
		border: 1px solid #1e1e1e;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.22rem 0.5rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.15s, color 0.15s;
	}
	.ae-btn:hover:not(:disabled) { border-color: #383838; color: #aaa; }
	.ae-btn:disabled { opacity: 0.28; cursor: default; }
	.ae-btn.ae-btn-danger:hover:not(:disabled) { border-color: hsl(0,55%,38%); color: hsl(0,65%,58%); }

	.ae-sel {
		background: #111;
		border: 1px solid #1e1e1e;
		color: #888;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.2rem 0.3rem;
		border-radius: 3px;
	}
	.ae-sel:focus { outline: none; border-color: hsl(190, 50%, 28%); }

	/* ── Code output ── */

	.ae-code {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-top: none;
		min-height: 120px;
	}

	.ae-code-hdr {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.35rem 0.75rem;
		border-top: 1px solid #181818;
		flex-shrink: 0;
	}

	.ae-code-lbl {
		font-size: 0.6rem;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.ae-copy {
		background: none;
		border: 1px solid #1e1e1e;
		color: #484848;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.62rem;
		padding: 0.12rem 0.45rem;
		border-radius: 3px;
		cursor: crosshair;
		transition: border-color 0.15s, color 0.15s;
	}
	.ae-copy:hover { border-color: #383838; color: #999; }

	.ae-code-body {
		flex: 1;
		margin: 0;
		padding: 0.6rem 0.75rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.65rem;
		color: #555;
		line-height: 1.65;
		white-space: pre;
		overflow: auto;
	}

	/* ── Right column ── */

	.ae-right {
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		background: #0c0c0c;
	}

	/* ── Skeleton knobs ── */

	.ae-skel {
		padding: 0.75rem 0.6rem 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		border-bottom: 1px solid #181818;
	}

	.ae-skel-row {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		align-items: end;
		justify-items: center;
	}

	.ae-knob {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		cursor: crosshair;
		user-select: none;
		-webkit-user-select: none;
		padding: 3px;
		border-radius: 5px;
		transition: background 0.1s;
	}
	.ae-knob:hover { background: rgba(255,255,255,0.02); }
	.ae-knob.active { background: rgba(255,255,255,0.035); }

	.ae-knob-svg { width: 52px; height: 52px; display: block; }

	.ae-knob-lbl {
		font-size: 0.49rem;
		color: #333;
		letter-spacing: 0.07em;
		text-align: center;
	}

	.ae-knob-val {
		font-size: 0.52rem;
		color: #424242;
		text-align: center;
		min-width: 30px;
	}

	/* ── Settings + Presets sections ── */

	.ae-section {
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid #181818;
	}

	.ae-section-hdr {
		font-size: 0.58rem;
		font-weight: 500;
		color: #383838;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin: 0 0 0.6rem;
	}

	.ae-field {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 0.4rem;
	}

	.ae-label {
		font-size: 0.65rem;
		color: #484848;
		min-width: 46px;
	}

	.ae-input {
		flex: 1;
		background: #111;
		border: 1px solid #1e1e1e;
		color: #aaa;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.22rem 0.35rem;
		border-radius: 3px;
		min-width: 0;
	}
	.ae-input:focus { outline: none; border-color: hsl(190, 45%, 25%); }

	.ae-preset-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ae-preset {
		background: none;
		border: 1px solid #181818;
		color: #555;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.68rem;
		padding: 0.28rem 0.5rem;
		text-align: left;
		cursor: crosshair;
		border-radius: 3px;
		transition: border-color 0.12s, color 0.12s;
	}
	.ae-preset:hover { border-color: #2e2e2e; color: #aaa; }
</style>
