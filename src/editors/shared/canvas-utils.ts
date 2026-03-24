/**
 * Set up a canvas for high-DPI rendering.
 * Scales the backing buffer by devicePixelRatio and sets CSS size.
 */
export function setupHiDpiCanvas(canvas: HTMLCanvasElement, width: number, height: number): void {
	const dpr = window.devicePixelRatio || 1;
	canvas.width = width * dpr;
	canvas.height = height * dpr;
	canvas.style.width = `${width}px`;
	canvas.style.height = `${height}px`;
}

/**
 * Clear a canvas and apply the DPR transform, returning the context.
 */
export function clearCanvas(canvas: HTMLCanvasElement, width: number, height: number): CanvasRenderingContext2D {
	const ctx = canvas.getContext('2d')!;
	const dpr = window.devicePixelRatio || 1;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, width, height);
	return ctx;
}

/**
 * Draw a background grid on a canvas.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, step = 20): void {
	ctx.strokeStyle = '#181818';
	ctx.lineWidth = 1;
	for (let x = 0; x <= width; x += step) {
		ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
	}
	for (let y = 0; y <= height; y += step) {
		ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
	}
}
