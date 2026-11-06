/* A small particle engine on one full-screen canvas: sparkles out of the slot, confetti
 * for a goal, ceramic shards and coins when a pig is broken. It only runs while
 * particles are alive. Coordinates are viewport pixels. */

export const FX = Object.freeze({ SPARK: 1, CONFETTI: 2, COIN: 3, SHARD: 4 });

const TAU = Math.PI * 2;
const MAX_DPR = 2;
const MAX_STEP_MS = 34;
const EDGE = 'rgba(0, 0, 0, 0.22)';
const SHINE = 'rgba(255, 255, 255, 0.55)';
const SPARK_INNER = 0.34;
const SHARD_VERTICES = [3, 5];
const CONTEXT = '2d';
const RESIZE = 'resize';

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (items) => items[Math.floor(Math.random() * items.length)];
const range = (value) => (Array.isArray(value) ? rand(value[0], value[1]) : value);

function shardPoints(size) {
  const count = Math.round(rand(SHARD_VERTICES[0], SHARD_VERTICES[1]));
  const start = rand(0, TAU);
  return Array.from({ length: count }, (_, i) => {
    const a = start + (i / count) * TAU + rand(-0.35, 0.35);
    const r = size * rand(0.55, 1.1);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });
}

const DRAW = Object.freeze({
  [FX.SPARK](ctx, p) {
    const r = p.size;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rr = i % 2 ? r * SPARK_INNER : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
  },
  [FX.CONFETTI](ctx, p) {
    ctx.scale(1, Math.cos(p.phase));
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
  },
  [FX.COIN](ctx, p) {
    const squash = Math.max(0.12, Math.abs(Math.cos(p.phase)));
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size, p.size * squash, 0, 0, TAU);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-p.size * 0.25, -p.size * 0.25 * squash, p.size * 0.35, p.size * 0.14 * squash, 0, 0, TAU);
    ctx.fillStyle = SHINE;
    ctx.fill();
  },
  [FX.SHARD](ctx, p) {
    ctx.beginPath();
    p.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = EDGE;
    ctx.stroke();
  },
});

export function createParticles(canvas, { gravity, drag, max }) {
  const ctx = canvas.getContext(CONTEXT);
  let particles = [];
  let frame = 0;
  let last = 0;
  let width = 0;
  let height = 0;

  function resize() {
    const dpr = Math.min(MAX_DPR, globalThis.devicePixelRatio || 1);
    width = globalThis.innerWidth;
    height = globalThis.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * burst({ x, y, kind, count, colors, angle, spread, speed, life, size, spin, area, radial, lift, gravityScale })
   * speed is px/ms, life ms, size px; [min, max] pairs are picked at random per particle.
   * area {rx, ry} spawns inside an ellipse; radial throws away from (x, y); lift adds upward speed.
   */
  function burst(options) {
    const {
      x, y, kind, count, colors,
      angle = -Math.PI / 2, spread = TAU, speed = [0.1, 0.4], life = [500, 900], size = [3, 7],
      spin = [-0.012, 0.012], area = null, radial = false, lift = 0, gravityScale = 1,
    } = options;
    for (let i = 0; i < count && particles.length < max; i++) {
      let px = x;
      let py = y;
      if (area) {
        const a = rand(0, TAU);
        const r = Math.sqrt(Math.random());
        px += Math.cos(a) * area.rx * r;
        py += Math.sin(a) * area.ry * r;
      }
      const heading = radial && (px !== x || py !== y) ? Math.atan2(py - y, px - x) + rand(-0.3, 0.3) : angle + (Math.random() - 0.5) * spread;
      const v = range(speed);
      const s = range(size);
      particles.push({
        kind, x: px, y: py, size: s,
        vx: Math.cos(heading) * v,
        vy: Math.sin(heading) * v - lift,
        age: 0, life: range(life),
        rot: rand(0, TAU), vr: range(spin),
        phase: rand(0, TAU), vphase: rand(0.006, 0.02),
        color: pick(colors),
        g: gravity * gravityScale,
        points: kind === FX.SHARD ? shardPoints(s) : null,
      });
    }
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const dt = Math.min(MAX_STEP_MS, now - last);
    last = now;
    ctx.clearRect(0, 0, width, height);
    particles = particles.filter((p) => (p.age += dt) < p.life);
    const keep = 1 - drag * dt;
    for (const p of particles) {
      p.vy += p.g * dt;
      p.vx *= keep;
      p.vy *= keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.phase += p.vphase * dt;
      const fade = 1 - (p.age / p.life) ** 3;
      ctx.save();
      ctx.globalAlpha = Math.max(0, fade);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      DRAW[p.kind](ctx, p);
      ctx.restore();
    }
    frame = particles.length ? requestAnimationFrame(tick) : 0;
    if (!frame) ctx.clearRect(0, 0, width, height);
  }

  globalThis.addEventListener(RESIZE, resize);
  resize();

  return { burst, get active() { return particles.length > 0; } };
}
