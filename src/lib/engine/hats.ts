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
    color: string,
  ) => void;
}

// ── Built-in Hats ────────────────────────────────────────────────────

const builtinHats: HatDef[] = [
  {
    id: "hardhat",
    label: "Hard Hat",
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
    },
  },
  {
    id: "tophat",
    label: "Top Hat",
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
    },
  },
  {
    id: "crown",
    label: "Crown",
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
    },
  },
  {
    id: "antenna",
    label: "Antenna",
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
    },
  },
  {
    id: "horns",
    label: "Horns",
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
    },
  },
  {
    id: "cowboy",
    label: "Cowboy Hat",
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
    },
  },
  {
    id: "beanie",
    label: "Beanie",
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
    },
  },
  {
    id: "chef",
    label: "Chef Hat",
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
    },
  },
  {
    id: "wizard",
    label: "Wizard Hat",
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
    },
  },
  {
    id: "viking",
    label: "Viking Helmet",
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
    },
  },
];

// ── Serializable Hat Format ──────────────────────────────────────────

/**
 * A geometric shape primitive for building hats.
 *
 * Coordinate system: origin is the top of the head (crown).
 *   x, y  — position in headRadius units (y > 0 goes INTO the head, y < 0 is above)
 *   size   — uniform scale: radius for circle/arc, half-length for line/curve,
 *             half-width for rect, circumradius for triangle
 *   angle  — rotation in degrees (0 = canonical orientation, see below)
 *   fill   — fill the shape (default: stroke only)
 *
 * Canonical orientations (angle = 0):
 *   line     → horizontal (left–right)
 *   circle   → no rotation (symmetric)
 *   arc      → upper semicircle / dome (facing up)
 *   rect     → upright (width horizontal, height vertical)
 *   triangle → pointing up
 *   curve    → horizontal, bowing upward
 */
export type HatShape =
  | { type: "line"; x: number; y: number; size: number; angle?: number; thickness?: number }
  | { type: "circle"; x: number; y: number; size: number; fill?: boolean; thickness?: number }
  | {
      type: "arc";
      x: number;
      y: number;
      size: number;
      angle?: number;
      span?: number;
      fill?: boolean;
      thickness?: number;
    }
  | {
      type: "rect";
      x: number;
      y: number;
      size: number;
      angle?: number;
      aspect?: number;
      fill?: boolean;
      thickness?: number;
    }
  | {
      type: "triangle";
      x: number;
      y: number;
      size: number;
      angle?: number;
      fill?: boolean;
      thickness?: number;
    }
  | {
      type: "curve";
      x: number;
      y: number;
      size: number;
      angle?: number;
      curvature?: number;
      thickness?: number;
    };

/** Serializable hat definition — analogous to KeyframeAnimationDef. */
export interface HatLayerDef {
  id: string;
  label: string;
  shapes: HatShape[];
}

const SQ3H = Math.sqrt(3) / 2; // sin(60°) — used for equilateral triangle vertices

/**
 * Draws a single primitive shape. The hat's translate+rotate is applied first by
 * createHat(); this function applies the per-shape position and rotation on top.
 */
function drawShape(ctx: CanvasRenderingContext2D, s: HatShape, hr: number) {
  ctx.save();
  ctx.translate(s.x * hr, s.y * hr);
  const angle = (s as { angle?: number }).angle ?? 0;
  if (angle !== 0) ctx.rotate((angle * Math.PI) / 180);
  const r = s.size * hr;

  switch (s.type) {
    case "line": {
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();
      break;
    }
    case "circle": {
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      if (s.fill) ctx.fill();
      ctx.stroke();
      break;
    }
    case "arc": {
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      // Canonical = upper semicircle (dome). angle rotates it.
      // span = arc width in degrees, centred on the "up" direction.
      const span = ((s.span ?? 180) * Math.PI) / 180;
      const mid = (3 * Math.PI) / 2; // "up" in canvas space
      ctx.beginPath();
      ctx.arc(0, 0, r, mid - span / 2, mid + span / 2, false);
      if (s.fill) ctx.fill();
      ctx.stroke();
      break;
    }
    case "rect": {
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      const h = r * (s.aspect ?? 1);
      if (s.fill) ctx.fillRect(-r, -h, r * 2, h * 2);
      ctx.strokeRect(-r, -h, r * 2, h * 2);
      break;
    }
    case "triangle": {
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * SQ3H, r * 0.5);
      ctx.lineTo(-r * SQ3H, r * 0.5);
      ctx.closePath();
      if (s.fill) ctx.fill();
      ctx.stroke();
      break;
    }
    case "curve": {
      // Symmetric quadratic bezier: endpoints at (±size, 0), control bow upward.
      // curvature > 0 = bow toward hat top; < 0 = bow toward face.
      if (s.thickness != null) ctx.lineWidth = s.thickness;
      const c = s.curvature ?? 0.5;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(0, -r * c * 2, r, 0);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

/**
 * Creates a live HatDef from a serializable HatLayerDef.
 * Analogous to createKeyframeAnimation().
 */
export function createHat(def: HatLayerDef): HatDef {
  return {
    id: def.id,
    label: def.label,
    draw(ctx, hx, hy, hr, hatAngle, color) {
      ctx.save();
      ctx.translate(hx, hy - hr); // hat origin = top of head (crown)
      ctx.rotate(hatAngle); // tilt with the stickman's head
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const shape of def.shapes) drawShape(ctx, shape, hr);
      ctx.restore();
    },
  };
}

/**
 * All 10 built-in hats re-expressed as HatLayerDef objects using geometric
 * primitives — these are the "editable" versions loadable in the Hat Builder.
 * The live stickman still uses the procedural builtinHats above.
 *
 * Coordinate reference:
 *   y = 0  → crown (top of head)
 *   y = 1  → head centre
 *   y = 2  → chin
 *   y < 0  → above the hat
 */
export const DefaultHatDefs: Record<string, HatLayerDef> = {
  hardhat: {
    id: "hardhat",
    label: "Hard Hat",
    shapes: [
      { type: "line", x: 0, y: 0, size: 1.8, angle: 0 }, // brim
      { type: "arc", x: 0, y: 0, size: 1.3 }, // dome (span=180, facing up)
    ],
  },
  tophat: {
    id: "tophat",
    label: "Top Hat",
    shapes: [
      { type: "line", x: 0, y: 0, size: 1.6, angle: 0 }, // brim
      { type: "rect", x: 0, y: -1.25, size: 1.0, aspect: 1.25 }, // tube (w=2, h=2.5)
    ],
  },
  crown: {
    id: "crown",
    label: "Crown",
    shapes: [
      { type: "triangle", x: 0, y: -0.5, size: 1.0, angle: 0 }, // centre spike
      { type: "triangle", x: -0.9, y: -0.25, size: 0.45, angle: 15 }, // left spike
      { type: "triangle", x: 0.9, y: -0.25, size: 0.45, angle: -15 }, // right spike
    ],
  },
  antenna: {
    id: "antenna",
    label: "Antenna",
    shapes: [
      { type: "line", x: 0, y: -1.5, size: 1.5, angle: 90 }, // vertical stick
      { type: "circle", x: 0, y: -3.0, size: 0.5, fill: true }, // orb
    ],
  },
  horns: {
    id: "horns",
    label: "Horns",
    // Two symmetric curves. Angle and center derived from the original quadratic bezier.
    shapes: [
      {
        type: "curve",
        x: -1.15,
        y: -1.0,
        size: 1.06,
        angle: 71,
        curvature: 0.3,
      },
      {
        type: "curve",
        x: 1.15,
        y: -1.0,
        size: 1.06,
        angle: -71,
        curvature: 0.3,
      },
    ],
  },
  cowboy: {
    id: "cowboy",
    label: "Cowboy Hat",
    shapes: [
      { type: "curve", x: 0, y: 0, size: 2.2, angle: 0, curvature: -0.11 }, // curved brim (bows down)
      { type: "arc", x: 0, y: -0.3, size: 1.1 }, // dome
    ],
  },
  beanie: {
    id: "beanie",
    label: "Beanie",
    shapes: [
      { type: "arc", x: 0, y: 0, size: 1.2 }, // dome
      { type: "circle", x: 0, y: -1.2, size: 0.5, fill: true }, // pompom
    ],
  },
  chef: {
    id: "chef",
    label: "Chef Hat",
    shapes: [
      { type: "line", x: 0, y: 0, size: 1.3, angle: 0 }, // brim
      { type: "arc", x: 0, y: 0, size: 1.3, span: 240 }, // wide puffy dome
    ],
  },
  wizard: {
    id: "wizard",
    label: "Wizard Hat",
    shapes: [
      { type: "line", x: 0, y: 0, size: 1.6, angle: 0 }, // brim
      { type: "triangle", x: -0.1, y: -0.83, size: 1.67, angle: 0 }, // cone body
      {
        type: "curve",
        x: 0.35,
        y: -2.65,
        size: 0.67,
        angle: -13,
        curvature: 0.7,
      }, // curl at tip
    ],
  },
  viking: {
    id: "viking",
    label: "Viking Helmet",
    shapes: [
      { type: "arc", x: 0, y: 0.5, size: 0.915 },
      { type: "line", x: 0, y: 0.25, size: 0.679, angle: 90 },
      {
        type: "curve",
        x: -0.899,
        y: -0.815,
        size: 0.726,
        angle: -109,
        curvature: 0.5,
      },
      {
        type: "curve",
        x: 0.936,
        y: -0.813,
        size: 0.749,
        angle: 109,
        curvature: 0.5,
      },
    ],
  },
};

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
