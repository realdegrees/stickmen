/**
 * SpeechBubbleStack — canvas-drawn speech bubbles for a single stickman.
 *
 * One stack per stickman. Implements Renderable so it slots into the
 * existing renderer list and is updated/culled automatically by the engine.
 *
 * Multiple bubbles stack upward from the figure's head — newest at the
 * bottom, oldest at the top. Positions are recomputed every frame so
 * there are never layout gaps when a mid-stack entry expires.
 *
 * Bubbles scale with the stickman's body scale (clamped 1× – 3×).
 * Each bubble stays within the canvas bounds, shifting horizontally or
 * downward as needed — the tail still points to the real head position.
 * Each bubble shrinks toward the head when its time is up.
 */

import type { Stickman } from './stickman.js';
import type { HSL, Renderable } from './types.js';
import { colorToHSL, colorToHSLA } from './types.js';
import { DEFAULT_CONFIG } from './config.js';

// ── Base layout constants (at scale 1×) ──────────────────────────────

const BASE_FONT_SIZE  = 11;   // px
const BASE_LINE_H     = 15;   // px line height
const BASE_PAD        = 6;    // px padding inside bubble
const BASE_MAX_TEXT_W = 110;  // px max text area width before wrapping
const BASE_MINI_R_MIN = 7;    // px minimum portrait circle radius
const BASE_HAT_ROOM   = 10;   // px above portrait head reserved for hat
const AMP             = 1.5;  // squiggle amplitude, not scaled (keeps line work fine)
const SEG             = 8;    // squiggle segment length
const R               = 4;    // bubble corner radius
const TAIL_BASE       = 4;    // half-width of tail at bubble bottom
const TAIL_H          = 8;    // tail height
const BUBBLE_GAP      = 3;    // vertical gap between stacked bubbles
const EXIT_START      = 0.78; // scale-out begins at this fraction of duration

// ── Entry type ────────────────────────────────────────────────────────

interface SpeechEntry {
	text: string;
	elapsed: number;
	durationMs: number;
	onExpire?: () => void;
}

// ── SpeechBubbleStack ─────────────────────────────────────────────────

export class SpeechBubbleStack implements Renderable {
	private entries: SpeechEntry[] = [];

	constructor(private readonly fig: Stickman) {}

	get position() {
		return { x: this.fig.x, y: this.fig.y };
	}

	/** Active as long as the owning stickman is alive — auto-culled by the engine. */
	get active(): boolean {
		return this.fig.active;
	}

	/** Queue a new speech bubble. Duration is in milliseconds. */
	say(text: string, durationMs: number, onExpire?: () => void): void {
		this.entries.push({ text, elapsed: 0, durationMs, onExpire });
	}

	/** Called every frame by the engine's renderable update loop. */
	update(dt: number): void {
		for (const e of this.entries) e.elapsed += dt;
		// Fire onExpire for entries that are crossing their deadline this tick.
		for (const e of this.entries) {
			if (e.elapsed >= e.durationMs && e.onExpire) {
				e.onExpire();
				e.onExpire = undefined;
			}
		}
		this.entries = this.entries.filter((e) => e.elapsed < e.durationMs);
	}

	draw(ctx: CanvasRenderingContext2D): void {
		if (!this.fig.active || this.entries.length === 0) return;

		const pose = this.fig.getCurrentPose();
		const head = pose.head;
		const headR = DEFAULT_CONFIG.stickman.headRadius * this.fig.bodyScale.headSize;
		const { color } = this.fig;

		// ── Scale factor (clamped 1× to 3×) ─────────────────────────
		const scale = Math.min(3, Math.max(1, this.fig.bodyScale.headSize));

		const fontSize   = Math.round(BASE_FONT_SIZE  * scale);
		const lineH      = BASE_LINE_H     * scale;
		const pad        = BASE_PAD        * scale;
		const maxTextW   = BASE_MAX_TEXT_W * scale;
		const miniR      = Math.max(BASE_MINI_R_MIN * scale, headR * 2.5);
		const hatRoom    = BASE_HAT_ROOM   * scale;
		const tailH      = TAIL_H          * scale;
		const tailBase   = TAIL_BASE       * scale;
		const bubbleGap  = BUBBLE_GAP      * scale;

		// ── Canvas logical size for overflow clamping ────────────────
		const dpr        = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
		const canvasW    = ctx.canvas.width  / dpr;
		const canvasH    = ctx.canvas.height / dpr;

		// Portrait area width (used in bottom bubble only)
		// Reserve: PAD + hat-may-stick-out-sideways(small) + miniR*2 + PAD
		const portraitW  = pad + miniR * 2 + pad;
		// Portrait area height (head + hat room above)
		const portraitH  = miniR * 2 + hatRoom;

		// Tail tip anchored just above the head circle
		const tipX = head.x;
		const tipY = head.y - headR - 1;

		ctx.save();
		ctx.font = `${fontSize}px system-ui, sans-serif`;
		ctx.textBaseline = 'middle';

		const colorStr = colorToHSL(color);

		// Draw newest (last) bubble at the bottom, stacking upward
		let bottom = tipY - tailH;

		for (let i = this.entries.length - 1; i >= 0; i--) {
			const entry  = this.entries[i];
			const isBot  = i === this.entries.length - 1;

			// ── Exit scale ───────────────────────────────────────────
			const exitT = Math.max(
				0,
				(entry.elapsed - EXIT_START * entry.durationMs) /
					(entry.durationMs * (1 - EXIT_START))
			);
			const exitScale = Math.max(0, 1 - exitT);

			// ── Text layout ──────────────────────────────────────────
			const lines  = wrapText(ctx, entry.text, maxTextW);
			const textW  = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0);
			const textH  = lines.length * lineH;

			// ── Bubble dimensions ────────────────────────────────────
			let bw: number, bh: number, textX: number;

			if (isBot) {
				bw   = portraitW + Math.max(textW, 28 * scale) + pad;
				bh   = Math.max(portraitH, textH) + pad * 2;
				textX = portraitW; // relative to bx — resolved after clamping
			} else {
				bw   = Math.max(textW, 28 * scale) + pad * 2;
				bh   = textH + pad * 2;
				textX = pad;
			}

			// ── Unclamped bubble position ────────────────────────────
			let bx = head.x - bw / 2;
			let by = bottom - bh;

			// ── Canvas bounds clamping ───────────────────────────────
			// Horizontal: keep within canvas width
			bx = Math.max(0, Math.min(canvasW - bw, bx));
			// Vertical: don't let the bubble go above the canvas top
			const shiftDown = Math.max(0, -by);
			by = Math.max(0, by);
			// Also don't push below canvas bottom (rare but safe)
			by = Math.min(canvasH - bh, by);

			// ── Scale transform toward head ───────────────────────────
			if (exitScale < 1) {
				ctx.save();
				ctx.translate(tipX, tipY);
				ctx.scale(exitScale, exitScale);
				ctx.translate(-tipX, -tipY);
			}

			// ── Tail (bottom bubble only) ────────────────────────────
			if (isBot) {
				const tailAnchorX = Math.min(
					Math.max(bx + tailBase + R, tipX),
					bx + bw - tailBase - R
				);
				// Tail bottom touches the bubble; if bubble shifted down, tail is shorter
				const tailBotY = by + bh;
				drawTail(ctx, tailAnchorX, tailBotY, tipX, tipY, tailBase, color);
			}

			// ── Bubble background + squiggly outline ─────────────────
			ctx.lineCap  = 'round';
			ctx.lineJoin = 'round';

			buildSquigglyRoundRectPath(ctx, bx, by, bw, bh, R, AMP, SEG);
			ctx.fillStyle = colorToHSLA(color, 0.12);
			ctx.fill();
			ctx.strokeStyle = colorStr;
			ctx.lineWidth   = 1;
			ctx.stroke();

			// ── Portrait (bottom bubble only) ─────────────────────────
			if (isBot) {
				// The head sits padded-in from the top, with hatRoom above
				const cx = bx + pad + miniR;
				const cy = by + pad + hatRoom + miniR;

				// Head circle
				ctx.beginPath();
				ctx.arc(cx, cy, miniR, 0, Math.PI * 2);
				ctx.fillStyle = colorToHSLA(color, 0.3);
				ctx.fill();
				ctx.strokeStyle = colorStr;
				ctx.lineWidth   = 1;
				ctx.stroke();

				// Hat (if present)
				if (this.fig.hat) {
					ctx.save();
					this.fig.hat.draw(ctx, cx, cy, miniR, 0, colorStr, 1);
					ctx.restore();
				}
			}

			// ── Text ─────────────────────────────────────────────────
			ctx.fillStyle    = colorStr;
			ctx.font         = `${fontSize}px system-ui, sans-serif`;
			ctx.textBaseline = 'middle';

			const resolvedTextX  = bx + textX;
			const totalTextH     = lines.length * lineH;
			const textAreaH      = bh - pad * 2;
			const textStartY     = by + pad + (textAreaH - totalTextH) / 2 + lineH / 2;

			for (let j = 0; j < lines.length; j++) {
				ctx.fillText(lines[j], resolvedTextX, textStartY + j * lineH);
			}

			if (exitScale < 1) {
				ctx.restore();
			}

			// Next bubble starts above this one (use unclamped by to avoid
			// cascading shifts when only one bubble needed to shift)
			bottom = (by - shiftDown) - bubbleGap;
		}

		ctx.restore();
	}
}

// ── Path helpers ──────────────────────────────────────────────────────

function buildSquigglyRoundRectPath(
	ctx: CanvasRenderingContext2D,
	x: number, y: number, w: number, h: number,
	r: number, amp: number, seg: number
): void {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	squigglyEdge(ctx, x + r,     y,         x + w - r, y,         amp, seg); // top →
	ctx.arc(x + w - r, y + r,     r, -Math.PI / 2, 0);                        // TR
	squigglyEdge(ctx, x + w,     y + r,     x + w,     y + h - r, amp, seg); // right ↓
	ctx.arc(x + w - r, y + h - r, r, 0,            Math.PI / 2);              // BR
	squigglyEdge(ctx, x + w - r, y + h,    x + r,     y + h,     amp, seg); // bottom ←
	ctx.arc(x + r,     y + h - r, r, Math.PI / 2,  Math.PI);                  // BL
	squigglyEdge(ctx, x,          y + h - r, x,        y + r,     amp, seg); // left ↑
	ctx.arc(x + r,     y + r,     r, Math.PI,      -Math.PI / 2);             // TL
	ctx.closePath();
}

function squigglyEdge(
	ctx: CanvasRenderingContext2D,
	x1: number, y1: number, x2: number, y2: number,
	amp: number, segLen: number
): void {
	const dx  = x2 - x1;
	const dy  = y2 - y1;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len < 1) return;

	const px = -dy / len; // perpendicular unit vector
	const py =  dx / len;
	const n  = Math.max(1, Math.ceil(len / segLen));

	for (let i = 0; i < n; i++) {
		const tm   = (i + 0.5) / n;
		const t1   = (i + 1)   / n;
		const bump = amp * (i % 2 === 0 ? 1 : -1);
		ctx.quadraticCurveTo(
			x1 + dx * tm + px * bump,
			y1 + dy * tm + py * bump,
			x1 + dx * t1,
			y1 + dy * t1
		);
	}
}

function drawTail(
	ctx: CanvasRenderingContext2D,
	baseX: number, baseY: number,
	tipX: number,  tipY: number,
	halfBase: number,
	color: HSL
): void {
	// Only draw if there's actual vertical distance to the tip
	const dy = baseY - tipY;
	if (dy < 2) return;

	// Fill
	ctx.beginPath();
	ctx.moveTo(baseX - halfBase, baseY);
	ctx.lineTo(tipX, tipY);
	ctx.lineTo(baseX + halfBase, baseY);
	ctx.closePath();
	ctx.fillStyle = colorToHSLA(color, 0.12);
	ctx.fill();

	// Squiggly sides
	ctx.strokeStyle = colorToHSL(color);
	ctx.lineWidth   = 1;
	ctx.lineCap     = 'round';

	ctx.beginPath();
	ctx.moveTo(baseX - halfBase, baseY);
	squigglyEdge(ctx, baseX - halfBase, baseY, tipX, tipY, 1, 5);
	ctx.stroke();

	ctx.beginPath();
	ctx.moveTo(baseX + halfBase, baseY);
	squigglyEdge(ctx, baseX + halfBase, baseY, tipX, tipY, 1, 5);
	ctx.stroke();
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let current = '';
	for (const word of words) {
		const candidate = current ? `${current} ${word}` : word;
		if (ctx.measureText(candidate).width > maxWidth && current) {
			lines.push(current);
			current = word;
		} else {
			current = candidate;
		}
	}
	if (current) lines.push(current);
	return lines;
}
