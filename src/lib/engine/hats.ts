/**
 * Hat registry — procedurally drawn hat accessories for stickmen.
 */

export interface HatDef {
	id: string;
	label: string;
	draw: (
		ctx: CanvasRenderingContext2D,
		headX: number,
		headY: number,
		headRadius: number,
		angle: number,
		color: string
	) => void;
}

// ── Built-in Hats ────────────────────────────────────────────────────

const builtinHats: HatDef[] = [
	{
		id: 'hardhat',
		label: 'Hard Hat',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			// Brim
			ctx.beginPath();
			ctx.moveTo(-hr * 1.8, 0);
			ctx.lineTo(hr * 1.8, 0);
			ctx.stroke();
			// Dome
			ctx.beginPath();
			ctx.arc(0, 0, hr * 1.3, Math.PI, 0);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'tophat',
		label: 'Top Hat',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			const bw = hr * 1.6;
			const tw = hr * 1.0;
			const th = hr * 2.5;
			ctx.beginPath();
			ctx.moveTo(-bw, 0);
			ctx.lineTo(bw, 0);
			ctx.stroke();
			ctx.strokeRect(-tw, -th, tw * 2, th);
			ctx.restore();
		}
	},
	{
		id: 'crown',
		label: 'Crown',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			const w = hr * 1.4;
			const h = hr * 1.5;
			ctx.beginPath();
			ctx.moveTo(-w, 0);
			ctx.lineTo(-w, -h * 0.6);
			ctx.lineTo(-w * 0.5, -h * 0.3);
			ctx.lineTo(0, -h);
			ctx.lineTo(w * 0.5, -h * 0.3);
			ctx.lineTo(w, -h * 0.6);
			ctx.lineTo(w, 0);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'antenna',
		label: 'Antenna',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 1;
			const len = hr * 3;
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(0, -len);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, -len, 1.5, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	},
	{
		id: 'horns',
		label: 'Horns',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			// Left horn
			ctx.beginPath();
			ctx.moveTo(-hr * 0.8, 0);
			ctx.quadraticCurveTo(-hr * 2, -hr * 0.5, -hr * 1.5, -hr * 2);
			ctx.stroke();
			// Right horn
			ctx.beginPath();
			ctx.moveTo(hr * 0.8, 0);
			ctx.quadraticCurveTo(hr * 2, -hr * 0.5, hr * 1.5, -hr * 2);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'cowboy',
		label: 'Cowboy Hat',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			const bw = hr * 2.2;
			// Wide brim (curved)
			ctx.beginPath();
			ctx.moveTo(-bw, 0);
			ctx.quadraticCurveTo(0, hr * 0.5, bw, 0);
			ctx.stroke();
			// Dome
			ctx.beginPath();
			ctx.arc(0, -hr * 0.3, hr * 1.1, Math.PI, 0);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'beanie',
		label: 'Beanie',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.fillStyle = color;
			ctx.lineWidth = 1;
			// Dome
			ctx.beginPath();
			ctx.arc(0, 0, hr * 1.2, Math.PI, 0);
			ctx.stroke();
			// Pompom
			ctx.beginPath();
			ctx.arc(0, -hr * 1.2, hr * 0.5, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	},
	{
		id: 'chef',
		label: 'Chef Hat',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			const w = hr * 1.3;
			// Brim
			ctx.beginPath();
			ctx.moveTo(-w, 0);
			ctx.lineTo(w, 0);
			ctx.stroke();
			// Puffy top
			ctx.beginPath();
			ctx.moveTo(-w, 0);
			ctx.quadraticCurveTo(-w * 1.2, -hr * 2, 0, -hr * 2.5);
			ctx.quadraticCurveTo(w * 1.2, -hr * 2, w, 0);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'wizard',
		label: 'Wizard Hat',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			const bw = hr * 1.6;
			// Brim
			ctx.beginPath();
			ctx.moveTo(-bw, 0);
			ctx.lineTo(bw, 0);
			ctx.stroke();
			// Pointed cone with curl
			ctx.beginPath();
			ctx.moveTo(-bw * 0.8, 0);
			ctx.lineTo(-hr * 0.3, -hr * 2.5);
			ctx.quadraticCurveTo(hr * 0.5, -hr * 3.5, hr * 1, -hr * 2.8);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(bw * 0.8, 0);
			ctx.lineTo(-hr * 0.3, -hr * 2.5);
			ctx.stroke();
			ctx.restore();
		}
	},
	{
		id: 'viking',
		label: 'Viking Helmet',
		draw(ctx, hx, hy, hr, angle, color) {
			ctx.save();
			ctx.translate(hx, hy - hr);
			ctx.rotate(angle);
			ctx.strokeStyle = color;
			ctx.lineWidth = 1;
			// Dome
			ctx.beginPath();
			ctx.arc(0, 0, hr * 1.3, Math.PI, 0);
			ctx.stroke();
			// Nose guard
			ctx.beginPath();
			ctx.moveTo(0, -hr * 0.3);
			ctx.lineTo(0, hr * 0.8);
			ctx.stroke();
			// Horns
			ctx.beginPath();
			ctx.moveTo(-hr * 1.3, -hr * 0.2);
			ctx.quadraticCurveTo(-hr * 2.2, -hr * 1.5, -hr * 1.5, -hr * 2.5);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(hr * 1.3, -hr * 0.2);
			ctx.quadraticCurveTo(hr * 2.2, -hr * 1.5, hr * 1.5, -hr * 2.5);
			ctx.stroke();
			ctx.restore();
		}
	}
];

// ── Registry ─────────────────────────────────────────────────────────

export class HatRegistry {
	private hats = new Map<string, HatDef>();

	constructor(registerDefaults = true) {
		if (registerDefaults) {
			for (const hat of builtinHats) {
				this.hats.set(hat.id, hat);
			}
		}
	}

	register(hat: HatDef): void {
		this.hats.set(hat.id, hat);
	}

	unregister(id: string): void {
		this.hats.delete(id);
	}

	get(id: string): HatDef | undefined {
		return this.hats.get(id);
	}

	getAll(): HatDef[] {
		return Array.from(this.hats.values());
	}

	getRandom(): HatDef | undefined {
		const all = this.getAll();
		if (all.length === 0) return undefined;
		return all[Math.floor(Math.random() * all.length)];
	}
}
