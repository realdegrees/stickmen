/**
 * Hat system — serializable hat definitions + live HatDef factory + registry.
 */

import hardhat  from './hats/hardhat.json'  with { type: 'json' };
import tophat   from './hats/tophat.json'   with { type: 'json' };
import crown    from './hats/crown.json'    with { type: 'json' };
import antenna  from './hats/antenna.json'  with { type: 'json' };
import horns    from './hats/horns.json'    with { type: 'json' };
import cowboy   from './hats/cowboy.json'   with { type: 'json' };
import beanie   from './hats/beanie.json'   with { type: 'json' };
import chef     from './hats/chef.json'     with { type: 'json' };
import wizard   from './hats/wizard.json'   with { type: 'json' };
import viking   from './hats/viking.json'   with { type: 'json' };

// ── Types ────────────────────────────────────────────────────────────

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
    direction: 1 | -1,
  ) => void;
}

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

// ── Shape utilities ──────────────────────────────────────────────────

/**
 * Returns a horizontally mirrored copy of a shape (negates x and angle).
 * Used to bake mirror-flagged shapes into the final shape list for export/rendering.
 */
export function mirrorHatShape(s: HatShape): HatShape {
  const angle = (s as { angle?: number }).angle ?? 0;
  const m = { ...s, x: -s.x } as HatShape;
  if (s.type !== 'circle') (m as { angle?: number }).angle = -angle;
  return m;
}

// ── Shape drawing ────────────────────────────────────────────────────

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
      const span = ((s.span ?? 180) * Math.PI) / 180;
      const mid = (3 * Math.PI) / 2;
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

// ── Factory ──────────────────────────────────────────────────────────

/**
 * Creates a live HatDef from a serializable HatLayerDef or a JSON string.
 * Analogous to createKeyframeAnimation().
 */
export function createHat(def: HatLayerDef | string): HatDef {
  if (typeof def === 'string') def = JSON.parse(def) as HatLayerDef;
  return {
    id: def.id,
    label: def.label,
    draw(ctx, hx, hy, hr, hatAngle, color, direction) {
      ctx.save();
      ctx.translate(hx, hy - hr);
      ctx.scale(direction, 1);
      ctx.rotate(hatAngle);
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

// ── Defaults ─────────────────────────────────────────────────────────

/**
 * All 10 built-in hat definitions as serializable HatLayerDef objects.
 * These are the single source of truth — the live engine uses createHat()
 * on these, so there is no separate procedural builtinHats array.
 */
export const DefaultHatDefs: Record<string, HatLayerDef> = {
  hardhat:  hardhat  as unknown as HatLayerDef,
  tophat:   tophat   as unknown as HatLayerDef,
  crown:    crown    as unknown as HatLayerDef,
  antenna:  antenna  as unknown as HatLayerDef,
  horns:    horns    as unknown as HatLayerDef,
  cowboy:   cowboy   as unknown as HatLayerDef,
  beanie:   beanie   as unknown as HatLayerDef,
  chef:     chef     as unknown as HatLayerDef,
  wizard:   wizard   as unknown as HatLayerDef,
  viking:   viking   as unknown as HatLayerDef,
};

// ── Registry ─────────────────────────────────────────────────────────

export class HatRegistry {
  private hats = new Map<string, HatDef>();

  constructor(registerDefaults = true) {
    if (registerDefaults) {
      for (const def of Object.values(DefaultHatDefs)) {
        const hat = createHat(def);
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
