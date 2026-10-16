// gen.js — מחוללי שאלות (ללא הגבלה): צורות, סדרות, חישוב מהיר, קשב, זיכרון.
// כל מחולל מחזיר פריט בפורמט זהה לשאלות במאגר (ראו data/*.json).

// ---------- RNG ----------
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  const next = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => { const c = arr.slice(); for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [c[i], c[j]] = [c[j], c[i]]; } return c; },
    chance: (p) => next() < p,
  };
  return r;
}
let counter = 0;
const uid = (p) => `${p}-g${Date.now().toString(36)}${(counter++).toString(36)}`;

// ---------- עזר לאופציות ----------
function placeAnswer(r, correct, distractors) {
  const opts = r.shuffle([correct, ...distractors.slice(0, 3)]);
  return { options: opts, answer: opts.indexOf(correct) };
}
function uniqueNums(r, correct, makers, count = 3) {
  const set = new Set([String(correct)]);
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < 60) {
    const v = makers[guard % makers.length]();
    if (v === undefined || v === null || Number.isNaN(v)) continue;
    const key = String(v);
    if (!set.has(key)) { set.add(key); out.push(v); }
  }
  for (let k = 0; out.length < count && k < 40; k++) { const base = Number.isFinite(Number(correct)) ? Number(correct) : 0; const v = base + (out.length + 1) * 7 + k; if (!set.has(String(v))) { set.add(String(v)); out.push(v); } }
  while (out.length < count) out.push(`${out.length + 1}`);
  return out;
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ============================================================
//  1. צורות (מטריצות 3×3, יוצא דופן, המשך סדרה) — SVG
// ============================================================
const SHAPES = ["circle", "square", "triangle", "diamond", "pentagon", "star", "hexagon"];
const SHAPE_HE = { circle: "עיגול", square: "ריבוע", triangle: "משולש", diamond: "מעוין", pentagon: "מחומש", star: "כוכב", hexagon: "משושה" };
const FILLS = ["none", "solid", "half", "dots"];
const FILL_HE = { none: "ריק", solid: "מלא", half: "חצי מלא", dots: "מנוקד" };

function polygon(n, r, rot = -90, cx = 50, cy = 50) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = ((rot + (360 / n) * i) * Math.PI) / 180; pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`); }
  return pts.join(" ");
}
function starPts(r, cx = 50, cy = 50) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const rad = i % 2 ? r * 0.45 : r; const a = ((-90 + 36 * i) * Math.PI) / 180; pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`); }
  return pts.join(" ");
}
function shapeEl(shape, r, cx, cy, fillAttr, extra = "") {
  switch (shape) {
    case "circle": return `<circle cx="${cx}" cy="${cy}" r="${r}" ${fillAttr} ${extra}/>`;
    case "square": return `<rect x="${cx - r * 0.85}" y="${cy - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" ${fillAttr} ${extra}/>`;
    case "triangle": return `<polygon points="${polygon(3, r, -90, cx, cy)}" ${fillAttr} ${extra}/>`;
    case "diamond": return `<polygon points="${polygon(4, r, -90, cx, cy)}" ${fillAttr} ${extra}/>`;
    case "pentagon": return `<polygon points="${polygon(5, r, -90, cx, cy)}" ${fillAttr} ${extra}/>`;
    case "hexagon": return `<polygon points="${polygon(6, r, 0, cx, cy)}" ${fillAttr} ${extra}/>`;
    case "star": return `<polygon points="${starPts(r, cx, cy)}" ${fillAttr} ${extra}/>`;
  }
  return "";
}
/** spec: {shape, fill, size(0..2), rot(0..3), count(1..3)} → svg string 100×100 */
export function cellSvg(spec, { bare = false } = {}) {
  const idp = `p${Math.floor(Math.random() * 1e9).toString(36)}`;
  const sizes = [16, 24, 32];
  const r = sizes[spec.size ?? 1];
  const rot = (spec.rot ?? 0) * 45;
  let fillAttr = `fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"`;
  let defs = "";
  if (spec.fill === "solid") fillAttr = `fill="currentColor" stroke="currentColor" stroke-width="3" stroke-linejoin="round"`;
  if (spec.fill === "dots") { defs = `<defs><pattern id="${idp}" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.6" fill="currentColor"/></pattern></defs>`; fillAttr = `fill="url(#${idp})" stroke="currentColor" stroke-width="3" stroke-linejoin="round"`; }
  if (spec.fill === "half") { defs = `<defs><linearGradient id="${idp}" x1="0" x2="1"><stop offset="50%" stop-color="currentColor"/><stop offset="50%" stop-color="transparent"/></linearGradient></defs>`; fillAttr = `fill="url(#${idp})" stroke="currentColor" stroke-width="3" stroke-linejoin="round"`; }
  const n = spec.count ?? 1;
  const positions = n === 1 ? [[50, 50]] : n === 2 ? [[32, 50], [68, 50]] : [[50, 30], [30, 68], [70, 68]];
  const rr = n === 1 ? r : Math.round(r * 0.62);
  const body = positions.map(([x, y]) => shapeEl(spec.shape, rr, x, y, fillAttr, `transform="rotate(${rot} ${x} ${y})"`)).join("");
  const inner = spec.dot ? `<circle cx="50" cy="50" r="4" fill="currentColor"/>` : "";
  const svg = `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs}${body}${inner}</svg>`;
  return bare ? svg : svg;
}
const ROT_VISIBLE = ["triangle", "pentagon", "star", "hexagon"];
function canon(s) { const c = { ...s }; if (c.shape === "circle") c.rot = 0; else if (c.shape === "square" || c.shape === "diamond") c.rot = (c.rot ?? 0) % 2; return c; }
const specKey = (s) => { const c = canon(s); return `${c.shape}|${c.fill}|${c.size}|${c.rot}|${c.count}|${c.dot ? 1 : 0}`; };

const ATTRS = {
  shape: { vals: SHAPES, he: (v) => SHAPE_HE[v], name: "הצורה" },
  fill: { vals: FILLS, he: (v) => FILL_HE[v], name: "המילוי" },
  size: { vals: [0, 1, 2], he: (v) => ["קטן", "בינוני", "גדול"][v], name: "הגודל" },
  rot: { vals: [0, 1, 2, 3], he: (v) => `${v * 45}°`, name: "הסיבוב" },
  count: { vals: [1, 2, 3], he: (v) => String(v), name: "מספר הצורות" },
};

/** מטריצה 3×3 — מצא את התא החסר */
export function genMatrix(r, difficulty = 2) {
  const attrs = ["shape", "fill", "size", "count", "rot"];
  const nVary = difficulty === 1 ? 2 : difficulty === 2 ? 3 : 4;
  const vary = r.shuffle(attrs).slice(0, nVary);
  const rules = {};
  const base = {};
  const desc = [];
  const rotVaries = vary.includes("rot");
  for (const a of attrs) {
    const pool = r.shuffle(a === "shape" && rotVaries ? ROT_VISIBLE : ATTRS[a].vals).slice(0, 3);
    if (!vary.includes(a)) { base[a] = pool[0]; rules[a] = { type: "fixed", pool: [pool[0]] }; continue; }
    const type = a === "count" || a === "rot" ? r.pick(["row", "latin", "inc"]) : r.pick(["row", "col", "latin"]);
    rules[a] = { type, pool: a === "count" ? [1, 2, 3] : a === "rot" ? [0, 1, 2] : pool };
    if (type === "row") desc.push(`${ATTRS[a].name} קבוע בכל שורה ומשתנה בין השורות`);
    if (type === "col") desc.push(`${ATTRS[a].name} קבוע בכל עמודה`);
    if (type === "latin") desc.push(`${ATTRS[a].name} מופיע פעם אחת בכל שורה ובכל עמודה (כמו סודוקו)`);
    if (type === "inc") desc.push(`${ATTRS[a].name} עולה משמאל לימין בכל שורה`);
  }
  const cell = (row, col) => {
    const s = {};
    for (const a of attrs) {
      const { type, pool } = rules[a];
      if (type === "fixed") s[a] = pool[0];
      else if (type === "row") s[a] = pool[row % pool.length];
      else if (type === "col") s[a] = pool[col % pool.length];
      else if (type === "latin") s[a] = pool[(row + col) % pool.length];
      else if (type === "inc") s[a] = pool[col % pool.length];
    }
    return s;
  };
  const cells = [];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) cells.push(cell(row, col));
  const correct = cells[8];
  const seen = new Set([specKey(correct)]);
  const distractors = [];
  let guard = 0;
  while (distractors.length < 3 && guard++ < 50) {
    const d = { ...correct };
    const a = r.pick(vary.length ? vary : attrs);
    const alt = (a === "shape" && rotVaries ? ROT_VISIBLE : ATTRS[a].vals).filter((v) => v !== correct[a]);
    d[a] = r.pick(alt);
    if (r.chance(0.3)) { const b = r.pick(attrs.filter((x) => x !== a)); d[b] = r.pick((b === "shape" && rotVaries ? ROT_VISIBLE : ATTRS[b].vals).filter((v) => v !== correct[b])); }
    if (!seen.has(specKey(d))) { seen.add(specKey(d)); distractors.push(canon(d)); }
  }
  const { options, answer } = placeAnswer(r, canon(correct), distractors);
  return {
    id: uid("gs-mat"), sub: "shapes", subTitle: "צורות", type: "mcq", difficulty, generated: true,
    q: "איזו צורה משלימה את המטריצה?",
    matrix: cells.slice(0, 8).map((c) => cellSvg(c)),
    optionsSvg: options.map((o) => cellSvg(o)),
    options: options.map((o, i) => `אפשרות ${i + 1}`),
    answer,
    explanation: `החוקיות: ${desc.join("; ")}. התא החסר צריך להיות ${SHAPE_HE[correct.shape]} ${FILL_HE[correct.fill]}, ${ATTRS.size.he(correct.size)}, ${correct.count > 1 ? correct.count + " צורות" : "צורה אחת"}${correct.rot ? `, מסובב ${correct.rot * 45}°` : ""}.`,
    timeSec: 40 + difficulty * 10, tags: ["shapes", "matrix"], pro: false,
  };
}

/** יוצא דופן — 5 צורות, אחת שונה */
export function genOddOne(r, difficulty = 1) {
  const attrs = ["shape", "fill", "size", "count", "rot"];
  const base = { shape: r.pick(SHAPES), fill: r.pick(FILLS), size: 1, rot: 0, count: 1 };
  const varyFree = r.shuffle(attrs).slice(0, difficulty); // attributes that vary freely among all cells (noise)
  const key = r.pick(attrs.filter((a) => !varyFree.includes(a)));
  if (key === "rot" && !ROT_VISIBLE.includes(base.shape)) base.shape = r.pick(ROT_VISIBLE);
  if (varyFree.includes("shape") && key === "rot") varyFree.splice(varyFree.indexOf("shape"), 1);
  const cells = [];
  for (let i = 0; i < 5; i++) { const c = { ...base }; for (const a of varyFree) c[a] = r.pick(ATTRS[a].vals); cells.push(c); }
  const oddIdx = r.int(0, 4);
  cells[oddIdx][key] = r.pick(ATTRS[key].vals.filter((v) => v !== base[key] && (key !== "rot" || (v % 2 !== 0 || ROT_VISIBLE.includes(base.shape)))));
  if (key === "rot" && specKey(cells[oddIdx]) === specKey({ ...cells[oddIdx], rot: base.rot })) cells[oddIdx].rot = 1;
  return {
    id: uid("gs-odd"), sub: "shapes", subTitle: "צורות", type: "mcq", difficulty, generated: true,
    q: "איזו צורה יוצאת דופן?",
    optionsSvg: cells.map((c) => cellSvg(c)),
    options: cells.map((_, i) => `אפשרות ${i + 1}`),
    answer: oddIdx,
    explanation: `בכל הצורות ${ATTRS[key].name} זהה (${ATTRS[key].he(base[key])}) חוץ מאפשרות ${oddIdx + 1}. שאר ההבדלים (${varyFree.map((a) => ATTRS[a].name).join(", ") || "אין"}) הם הסחה.`,
    timeSec: 25 + difficulty * 5, tags: ["shapes", "odd"], pro: false,
  };
}

/** סדרת צורות — מה הבא בתור */
export function genShapeSeq(r, difficulty = 2) {
  const shape = r.pick(ROT_VISIBLE);
  const rotStep = r.pick([1, 2, 3]);
  const countRule = difficulty >= 2 ? r.pick(["same", "cycle"]) : "same";
  const fillRule = difficulty >= 3 ? "cycle" : "same";
  const fillPool = r.shuffle(FILLS).slice(0, 2);
  const seq = [];
  for (let i = 0; i < 5; i++) seq.push({ shape, fill: fillRule === "cycle" ? fillPool[i % 2] : fillPool[0], size: 1, rot: (i * rotStep) % 4, count: countRule === "cycle" ? (i % 3) + 1 : 1 });
  const correct = seq[4];
  const seen = new Set([specKey(correct)]);
  const distractors = [];
  let guard = 0;
  while (distractors.length < 3 && guard++ < 40) {
    const d = { ...correct };
    const a = r.pick(["rot", "count", "fill", "shape"]);
    d[a] = r.pick(ATTRS[a].vals.filter((v) => v !== correct[a]));
    if (!seen.has(specKey(d))) { seen.add(specKey(d)); distractors.push(d); }
  }
  const { options, answer } = placeAnswer(r, correct, distractors);
  const parts = [`הצורה מסתובבת ב-${rotStep * 45}° בכל צעד`];
  if (countRule === "cycle") parts.push("מספר הצורות עולה 1→2→3 וחוזר");
  if (fillRule === "cycle") parts.push("המילוי מתחלף לסירוגין");
  return {
    id: uid("gs-seq"), sub: "shapes", subTitle: "צורות", type: "mcq", difficulty, generated: true,
    q: "מהי הצורה הבאה בסדרה?",
    sequence: seq.slice(0, 4).map((c) => cellSvg(c)),
    optionsSvg: options.map((o) => cellSvg(o)),
    options: options.map((_, i) => `אפשרות ${i + 1}`),
    answer,
    explanation: parts.join("; ") + ".",
    timeSec: 35 + difficulty * 5, tags: ["shapes", "sequence"], pro: false,
  };
}

export function genShapes(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const k = r.pick(["matrix", "matrix", "odd", "seq"]);
  return k === "matrix" ? genMatrix(r, d) : k === "odd" ? genOddOne(r, d) : genShapeSeq(r, d);
}

// ============================================================
//  2. סדרות מספרים
// ============================================================
export function genSeries(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const kinds = d === 1 ? ["arith", "geo", "altDiff"] : d === 2 ? ["altDiff", "diff2", "interleave", "squares"] : ["diff2", "interleave", "fib", "mulAdd", "primes"];
  const kind = r.pick(kinds);
  let terms = [], rule = "";
  const start = r.int(1, 20);
  switch (kind) {
    case "arith": { const s = r.int(2, 12); terms = Array.from({ length: 6 }, (_, i) => start + i * s); rule = `כל איבר גדול מקודמו ב-${s}`; break; }
    case "geo": { const q = r.pick([2, 3]); const s0 = r.int(1, 5); terms = Array.from({ length: 6 }, (_, i) => s0 * q ** i); rule = `כל איבר כפול ${q} מקודמו`; break; }
    case "altDiff": { const a = r.int(2, 9), b = r.int(1, 6) * (r.chance(0.5) ? 1 : -1); terms = [start]; for (let i = 1; i < 6; i++) terms.push(terms[i - 1] + (i % 2 ? a : b)); rule = `ההפרשים מתחלפים: +${a}, ${b >= 0 ? "+" + b : b}, +${a}, ${b >= 0 ? "+" + b : b}…`; break; }
    case "diff2": { const d0 = r.int(1, 5), dd = r.int(1, 4); terms = [start]; let diff = d0; for (let i = 1; i < 6; i++) { terms.push(terms[i - 1] + diff); diff += dd; } rule = `ההפרשים בין האיברים עולים ב-${dd} בכל פעם (${d0}, ${d0 + dd}, ${d0 + 2 * dd}…)`; break; }
    case "interleave": { const a0 = r.int(1, 10), sa = r.int(2, 6), b0 = r.int(20, 40), sb = -r.int(1, 5); terms = []; for (let i = 0; i < 6; i++) terms.push(i % 2 === 0 ? a0 + (i / 2) * sa : b0 + ((i - 1) / 2) * sb); rule = `שתי סדרות משולבות: במקומות האי-זוגיים +${sa}, במקומות הזוגיים ${sb}`; break; }
    case "squares": { const k = r.int(-3, 5); const s0 = r.int(1, 4); terms = Array.from({ length: 6 }, (_, i) => (s0 + i) ** 2 + k); rule = `ריבועים ${k ? (k > 0 ? `ועוד ${k}` : `פחות ${-k}`) : ""}: ${s0}², ${s0 + 1}², ${s0 + 2}²…`; break; }
    case "fib": { terms = [r.int(1, 5), r.int(1, 6)]; for (let i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2]); rule = "כל איבר הוא סכום שני האיברים שלפניו"; break; }
    case "mulAdd": { const m = r.pick([2, 3]), a = r.int(-5, 5) || 1; terms = [r.int(1, 4)]; for (let i = 1; i < 6; i++) terms.push(terms[i - 1] * m + a); rule = `כל איבר = הקודם ×${m} ${a >= 0 ? "+ " + a : "− " + -a}`; break; }
    case "primes": { const P = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41]; const s0 = r.int(0, 6); const k = r.int(0, 3); terms = P.slice(s0, s0 + 6).map((p) => p + k); rule = `מספרים ראשוניים${k ? ` ועוד ${k}` : ""}`; break; }
  }
  const correct = terms[5];
  const shown = terms.slice(0, 5);
  const last = shown[4], prev = shown[3];
  const distractors = uniqueNums(r, correct, [() => correct + (last - prev), () => correct - (last - prev), () => last * 2 - prev + 1, () => correct + r.int(1, 4), () => correct - r.int(1, 4), () => last + (last - prev) * 2]);
  const { options, answer } = placeAnswer(r, fmt(correct), distractors.map(fmt));
  return {
    id: uid("gq-ser"), sub: "gen-series", subTitle: "סדרות מספרים (מחולל)", type: "mcq", difficulty: d, generated: true,
    q: `מהו האיבר הבא בסדרה?\n${shown.join(", ")}, ?`, options, answer,
    explanation: `${rule}. לכן האיבר הבא הוא ${fmt(correct)}.`,
    timeSec: 30 + d * 10, tags: ["series"], pro: false,
  };
}

// ============================================================
//  3. חישוב מהיר
// ============================================================
export function genQuick(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const kind = r.pick(d === 1 ? ["add", "sub", "mul1", "div"] : d === 2 ? ["mul2", "pct", "sq", "frac", "div"] : ["mul2", "pct2", "pow", "frac", "cmp", "rem"]);
  let q = "", correct, distract = [], expl = "";
  switch (kind) {
    case "add": { const a = r.int(120, 980), b = r.int(120, 980); correct = a + b; q = `${a} + ${b} = ?`; distract = [correct + 10, correct - 10, correct + 100]; expl = `פרקו למאות ועשרות: ${a} + ${b} = ${correct}.`; break; }
    case "sub": { const a = r.int(500, 999), b = r.int(100, 499); correct = a - b; q = `${a} − ${b} = ?`; distract = [correct + 10, correct - 10, correct + 100]; expl = `השלימו את ${b} למספר עגול ואז הוסיפו את השאר: ${a} − ${b} = ${correct}.`; break; }
    case "mul1": { const a = r.int(12, 29), b = r.int(3, 9); correct = a * b; q = `${a} × ${b} = ?`; distract = [correct + b, correct - b, correct + 10]; expl = `${a} × ${b} = (${Math.floor(a / 10) * 10} × ${b}) + (${a % 10} × ${b}) = ${correct}.`; break; }
    case "mul2": { const a = r.int(13, 49), b = r.int(11, 29); correct = a * b; q = `${a} × ${b} = ?`; distract = [correct + a, correct - b, correct + 100]; expl = `פרקו: ${a} × ${b} = ${a} × ${Math.floor(b / 10) * 10} + ${a} × ${b % 10} = ${a * Math.floor(b / 10) * 10} + ${a * (b % 10)} = ${correct}.`; break; }
    case "div": { const b = r.int(3, 25), c = r.int(4, 40); const a = b * c; correct = c; q = `${a} ÷ ${b} = ?`; distract = [c + 1, c - 1, c + 10]; expl = `${b} × ${c} = ${a}, לכן התשובה ${c}.`; break; }
    case "pct": { const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 75]); const n = r.pick([40, 60, 80, 120, 160, 200, 240, 300, 360, 400, 480]); correct = (p * n) / 100; q = `${p}% מ-${n} = ?`; distract = [correct + n / 20, correct - n / 20, correct * 2]; expl = `10% מ-${n} הם ${n / 10}; ${p}% = ${p / 10} × ${n / 10} = ${fmt(correct)}.`; break; }
    case "pct2": { const n = r.pick([80, 120, 150, 200, 250, 400]); const p = r.pick([12, 18, 35, 45, 65, 85]); correct = (p * n) / 100; q = `${p}% מ-${n} = ?`; distract = [correct + n / 10, correct - n / 10, correct + 5]; expl = `${p}% = ${Math.floor(p / 10) * 10}% + ${p % 10}%: ${(Math.floor(p / 10) * 10 * n) / 100} + ${((p % 10) * n) / 100} = ${fmt(correct)}.`; break; }
    case "sq": { const a = r.int(11, 25); correct = a * a; q = `${a}² = ?`; distract = [correct + 2 * a, correct - a, correct + 1]; expl = `${a}² = (${a - 1})² + ${a - 1} + ${a} = ${correct}, או ישירות ${a} × ${a}.`; break; }
    case "pow": { const b = r.pick([2, 3, 4, 5]); const e = b === 2 ? r.int(5, 10) : b === 3 ? r.int(3, 5) : r.int(2, 4); correct = b ** e; q = `${b}^${e} = ?`; distract = [correct * 2, correct / 2, correct + b]; expl = `${b}^${e} = ${Array(e).fill(b).join(" × ")} = ${correct}.`; break; }
    case "frac": { const pairs = [[1, 8, 0.125], [3, 8, 0.375], [5, 8, 0.625], [7, 8, 0.875], [1, 4, 0.25], [3, 4, 0.75], [2, 5, 0.4], [3, 5, 0.6], [4, 5, 0.8], [1, 20, 0.05], [3, 20, 0.15], [7, 10, 0.7]]; const [n, m, v] = r.pick(pairs); correct = v; q = `${n}/${m} כשבר עשרוני = ?`; distract = [v + 0.1, v - 0.05, Math.round((n / m) * 10) / 10 === v ? v + 0.25 : Math.round((n / m) * 10) / 10]; expl = `${n} ÷ ${m} = ${v}. (זכרו: 1/8 = 0.125, 1/5 = 0.2, 1/4 = 0.25)`; break; }
    case "cmp": { const a = r.int(20, 60); const left = (a - 1) * (a + 1), right = a * a; correct = `${a - 1} × ${a + 1}`; q = `מה גדול יותר?`; const opts = [`${a - 1} × ${a + 1}`, `${a}²`, "שווים", "אי אפשר לדעת"]; const ans = 1; return { id: uid("gq-qk"), sub: "gen-quick", subTitle: "חישוב מהיר (מחולל)", type: "mcq", difficulty: d, generated: true, q: `מה גדול יותר: ${a - 1} × ${a + 1} או ${a}²?`, options: opts, answer: ans, explanation: `(a−1)(a+1) = a² − 1, לכן ${a - 1} × ${a + 1} = ${left} קטן ב-1 מ-${a}² = ${right}.`, timeSec: 15, tags: ["quick", "algebra"], pro: false }; }
    case "rem": { const n = r.int(50, 300), m = r.pick([3, 4, 6, 7, 9]); correct = n % m; q = `מהי השארית של ${n} בחלוקה ב-${m}?`; distract = [(correct + 1) % m, (correct + 2) % m, (correct + m - 1) % m]; expl = `${m} × ${Math.floor(n / m)} = ${m * Math.floor(n / m)}, ו-${n} − ${m * Math.floor(n / m)} = ${correct}.`; break; }
  }
  const distractors = uniqueNums(r, correct, distract.map((v) => () => v).concat([() => Number(correct) + 1, () => Number(correct) - 1, () => Number(correct) + 3]));
  const { options, answer } = placeAnswer(r, fmt(correct), distractors.map(fmt));
  return { id: uid("gq-qk"), sub: "gen-quick", subTitle: "חישוב מהיר (מחולל)", type: "mcq", difficulty: d, generated: true, q, options, answer, explanation: expl, timeSec: d === 1 ? 12 : d === 2 ? 15 : 20, tags: ["quick"], pro: false };
}

// ============================================================
//  4. קשב — השוואת מחרוזות וספירה
// ============================================================
const CODE_CHARS = "ABCDEFGHKLMNPRSTUVXYZ2345678923456789";
function code(r, n) { let s = ""; for (let i = 0; i < n; i++) s += CODE_CHARS[r.int(0, CODE_CHARS.length - 1)]; return s; }
function otherChar(r, ch) { const pool = [...new Set([...CODE_CHARS])].filter((c) => c !== ch); return pool[r.int(0, pool.length - 1)]; }
export function genAttention(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const kind = r.pick(["diff", "count", "match"]);
  if (kind === "diff") {
    const n = 8 + d * 3;
    const a = code(r, n);
    const same = r.chance(0.25);
    let b = a, pos = -1;
    if (!same) { pos = r.int(0, n - 1); b = a.slice(0, pos) + otherChar(r, a[pos]) + a.slice(pos + 1); }
    const opts = same ? ["המחרוזות זהות", `התו ה-${r.int(1, n)}`, `התו ה-${r.int(1, n)}`, `התו ה-${r.int(1, n)}`] : [`התו ה-${pos + 1}`, "המחרוזות זהות", `התו ה-${((pos + 2) % n) + 1}`, `התו ה-${((pos + n - 3) % n) + 1}`];
    const uniq = [...new Set(opts)];
    while (uniq.length < 4) uniq.push(`התו ה-${uniq.length + r.int(1, n)}`);
    const correct = same ? "המחרוזות זהות" : `התו ה-${pos + 1}`;
    const { options, answer } = placeAnswer(r, correct, uniq.filter((o) => o !== correct));
    return { id: uid("ga-dif"), sub: "gen-attention", subTitle: "קשב וריכוז (מחולל)", type: "mcq", difficulty: d, generated: true, q: `השוו בין שתי המחרוזות. היכן ההבדל?\n\n${a}\n${b}`, ltr: true, options, answer, explanation: same ? "אין הבדל — המחרוזות זהות תו-תו." : `התו במקום ${pos + 1}: "${a[pos]}" לעומת "${b[pos]}".`, timeSec: 15 + d * 5, tags: ["attention"], pro: false };
  }
  if (kind === "count") {
    const n = 14 + d * 6;
    const s = code(r, n);
    const ch = s[r.int(0, n - 1)];
    const c = [...s].filter((x) => x === ch).length;
    const distractors = uniqueNums(r, c, [() => c + 1, () => c - 1, () => c + 2, () => Math.max(0, c - 2)]).filter((v) => v >= 0);
    const { options, answer } = placeAnswer(r, String(c), distractors.map(String));
    return { id: uid("ga-cnt"), sub: "gen-attention", subTitle: "קשב וריכוז (מחולל)", type: "mcq", difficulty: d, generated: true, q: `כמה פעמים מופיע התו "${ch}" במחרוזת?\n\n${s}`, ltr: true, options, answer, explanation: `סרקו משמאל לימין וספרו: "${ch}" מופיע ${c} פעמים.`, timeSec: 15 + d * 5, tags: ["attention"], pro: false };
  }
  const n = 6 + d * 2;
  const target = code(r, n);
  const variants = new Set();
  while (variants.size < 3) { const pos = r.int(0, n - 1); variants.add(target.slice(0, pos) + otherChar(r, target[pos]) + target.slice(pos + 1)); }
  const { options, answer } = placeAnswer(r, target, [...variants]);
  return { id: uid("ga-mat"), sub: "gen-attention", subTitle: "קשב וריכוז (מחולל)", type: "mcq", difficulty: d, generated: true, q: `איזו אפשרות זהה בדיוק לקוד?\n\n${target}`, ltr: true, optionsLtr: true, options, answer, explanation: `רק אפשרות ${answer + 1} זהה תו-תו. בשאר יש תו אחד שונה.`, timeSec: 12 + d * 4, tags: ["attention"], pro: false };
}

// ============================================================
//  5. זיכרון עבודה
// ============================================================
const WORDS = ["תפוח", "מנורה", "חלון", "ספר", "גשר", "כיסא", "ענן", "מפתח", "שעון", "דלת", "פרח", "נהר", "מגדל", "חתול", "כובע", "מטרייה", "מצפן", "סולם", "שולחן", "אופניים", "מכתב", "תמונה", "קופסה", "עיפרון", "בקבוק", "כדור", "מראה", "סירה", "גלגל", "פעמון"];
export function genMemory(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const n = 4 + d * 2;
  const list = r.shuffle(WORDS).slice(0, n + 4);
  const shown = list.slice(0, n);
  const notShown = list.slice(n);
  const kind = r.pick(["in", "pos", "notin"]);
  if (kind === "in") {
    const correct = r.pick(shown);
    const { options, answer } = placeAnswer(r, correct, notShown.slice(0, 3));
    return { id: uid("gm-in"), sub: "gen-memory", subTitle: "זיכרון עבודה (מחולל)", type: "mcq", difficulty: d, generated: true, memorize: shown.join(" · "), memorizeSec: 6 + n, q: "איזו מילה הופיעה ברשימה?", options, answer, explanation: `הרשימה הייתה: ${shown.join(", ")}.`, timeSec: 15, tags: ["memory"], pro: false };
  }
  if (kind === "notin") {
    const correct = notShown[0];
    const { options, answer } = placeAnswer(r, correct, r.shuffle(shown).slice(0, 3));
    return { id: uid("gm-not"), sub: "gen-memory", subTitle: "זיכרון עבודה (מחולל)", type: "mcq", difficulty: d, generated: true, memorize: shown.join(" · "), memorizeSec: 6 + n, q: "איזו מילה לא הופיעה ברשימה?", options, answer, explanation: `הרשימה הייתה: ${shown.join(", ")} — "${correct}" לא הייתה בה.`, timeSec: 15, tags: ["memory"], pro: false };
  }
  const pos = r.int(1, n);
  const correct = shown[pos - 1];
  const { options, answer } = placeAnswer(r, correct, r.shuffle(shown.filter((w) => w !== correct)).slice(0, 3));
  return { id: uid("gm-pos"), sub: "gen-memory", subTitle: "זיכרון עבודה (מחולל)", type: "mcq", difficulty: d, generated: true, memorize: shown.join(" · "), memorizeSec: 6 + n, q: `מה הייתה המילה ה-${pos} ברשימה?`, options, answer, explanation: `הרשימה לפי הסדר: ${shown.map((w, i) => `${i + 1}. ${w}`).join(", ")}.`, timeSec: 15, tags: ["memory"], pro: false };
}


// ============================================================
//  6. "מחשבון קרב" — שפת מכונה מומצאת (למידת חומר חדש)
// ============================================================
export const KERAV_SPEC = `**מחשבון קרב** הוא מחשב קטן עם שלושה תאים: **A**, **B**, **C**. בתחילת כל תוכנית כל התאים מכילים 0. התוכנית רצה שורה אחרי שורה מלמעלה למטה, אלא אם פקודה אומרת אחרת.

| פקודה | מה היא עושה |
|---|---|
| \`TAK A 5\` | שמים את המספר 5 בתא A (הערך הקודם נמחק) |
| \`PLUS A B\` | מוסיפים לתא A את הערך של B (או מספר): A = A + B |
| \`MINUS A B\` | מחסירים מתא A את הערך של B (או מספר): A = A − B |
| \`TIMES A B\` | כופלים את תא A בערך של B (או מספר): A = A × B |
| \`FLIP A B\` | מחליפים את התוכן של A ו-B |
| \`DROP A\` | מורידים 1 מתא A |
| \`HOP 2\` | קופצים לשורה 2 וממשיכים משם |
| \`HOPZ A 6\` | אם A שווה 0 — קופצים לשורה 6; אחרת ממשיכים לשורה הבאה |
| \`STOP\` | סוף התוכנית |

השורות ממוספרות מ-1. פקודה שמקבלת שני תאים פועלת תמיד על התא הראשון.`;

function runKerav(lines, cap = 200) {
  const R = { A: 0, B: 0, C: 0 };
  const counts = new Array(lines.length).fill(0);
  let pc = 0, steps = 0;
  const val = (x) => (x in R ? R[x] : parseInt(x, 10));
  while (pc < lines.length && steps++ < cap) {
    counts[pc]++;
    const [op, a, b] = lines[pc].split(" ");
    let next = pc + 1;
    switch (op) {
      case "TAK": R[a] = parseInt(b, 10); break;
      case "PLUS": R[a] += val(b); break;
      case "MINUS": R[a] -= val(b); break;
      case "TIMES": R[a] *= val(b); break;
      case "FLIP": { const t = R[a]; R[a] = R[b]; R[b] = t; break; }
      case "DROP": R[a] -= 1; break;
      case "HOP": next = parseInt(a, 10) - 1; break;
      case "HOPZ": if (R[a] === 0) next = parseInt(b, 10) - 1; break;
      case "STOP": return { R, counts, steps, ok: true };
    }
    pc = next;
  }
  return { R, counts, steps, ok: steps < cap };
}
export function genKerav(r, difficulty) {
  const d = difficulty || r.int(1, 3);
  const regs = ["A", "B", "C"];
  for (let attempt = 0; attempt < 30; attempt++) {
    const lines = [];
    if (d === 1) {
      const n = r.int(4, 6);
      lines.push(`TAK A ${r.int(2, 9)}`, `TAK B ${r.int(1, 9)}`);
      while (lines.length < n) { const op = r.pick(["PLUS", "MINUS", "TIMES", "FLIP", "DROP"]); const a = r.pick(regs), b = r.pick(regs.filter((x) => x !== a).concat([String(r.int(1, 5))])); const other = r.pick(regs.filter((x) => x !== a)); lines.push(op === "DROP" ? `DROP ${a}` : op === "FLIP" ? `FLIP ${a} ${other}` : `${op} ${a} ${b}`); }
      lines.push("STOP");
    } else {
      // loop: count down a register while accumulating
      const k = r.int(2, d === 2 ? 4 : 6);
      lines.push(`TAK A ${k}`, `TAK B ${r.int(1, 5)}`);
      const loopStart = lines.length + 1; // 1-based line number of HOPZ
      lines.push(`HOPZ A 0`); // exit line filled in below
      lines.push(r.pick([`PLUS C B`, `PLUS C A`, `TIMES B 2`, `PLUS B ${r.int(1, 3)}`]));
      if (d === 3) lines.push(r.pick([`PLUS C ${r.int(1, 3)}`, `MINUS C 1`, `FLIP B C`]));
      lines.push(`DROP A`);
      lines.push(`HOP ${loopStart}`);
      const exitLine = lines.length + 1;
      if (d === 3 && r.chance(0.5)) lines.push(`FLIP A C`);
      lines.push(`STOP`);
      lines[loopStart - 1] = `HOPZ A ${exitLine}`;
    }
    const res = runKerav(lines);
    if (!res.ok) continue;
    const program = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
    const askCount = d >= 2 && r.chance(0.35);
    let q, correct, distract, expl;
    if (askCount) {
      const li = lines.findIndex((l) => l.startsWith("DROP"));
      correct = res.counts[li];
      q = `כמה פעמים מתבצעת שורה ${li + 1}?`;
      distract = [correct + 1, correct - 1, correct + 2];
      expl = `הלולאה רצה כל עוד A אינו 0. A מתחיל ב-${lines[0].split(" ")[2]} ויורד ב-1 בכל סיבוב, לכן שורה ${li + 1} מתבצעת ${correct} פעמים.`;
    } else {
      const cands = d === 1 ? regs.filter((x) => res.R[x] !== 0) : ["C", "B", "A"];
      const reg = r.pick(cands.length ? cands : regs);
      correct = res.R[reg];
      q = `מה הערך של התא ${reg} בסיום התוכנית?`;
      const others = regs.filter((x) => x !== reg).map((x) => res.R[x]);
      distract = [...others, correct + 1, correct - 1, correct * 2];
      expl = d === 1 ? `עוקבים שורה-שורה. בסיום: A=${res.R.A}, B=${res.R.B}, C=${res.R.C}.` : `זו לולאה: שורה ${lines.findIndex((l) => l.startsWith("HOPZ")) + 1} בודקת אם A הוא 0, וכל סיבוב מוריד 1 מ-A. ${res.counts[lines.findIndex((l) => l.startsWith("DROP"))]} סיבובים. בסיום: A=${res.R.A}, B=${res.R.B}, C=${res.R.C}.`;
    }
    const distractors = uniqueNums(r, correct, distract.map((v) => () => v).concat([() => correct + 3, () => correct - 2]));
    const { options, answer } = placeAnswer(r, fmt(correct), distractors.map(fmt));
    return { id: uid("gk-kr"), sub: "kerav", subTitle: "מחשבון קרב (שפה מומצאת)", type: "mcq", difficulty: d, generated: true, group: "kerav", context: KERAV_SPEC, q: `${q}\n${program}`, options, answer, explanation: expl, timeSec: 45 + d * 30, tags: ["kerav", "learning"], pro: false };
  }
  return genKerav(r, 1);
}

export const GENERATORS = {
  shapes: { title: "צורות", category: "dapar", gen: genShapes, desc: "מטריצות, יוצא דופן וסדרות צורות — מחולל אינסופי" },
  "gen-series": { title: "סדרות מספרים (מחולל)", category: "dapar", gen: genSeries, desc: "סדרות חדשות בכל פעם" },
  "gen-quick": { title: "חישוב מהיר (מחולל)", category: "dapar", gen: genQuick, desc: "חשבון בלחץ זמן" },
  "gen-attention": { title: "קשב וריכוז (מחולל)", category: "learning", gen: genAttention, desc: "השוואת קודים וספירה" },
  "gen-memory": { title: "זיכרון עבודה (מחולל)", category: "learning", gen: genMemory, desc: "רשימות לזכור" },
  kerav: { title: "מחשבון קרב (שפה מומצאת)", category: "learning", gen: genKerav, desc: "לומדים שפת מכונה מומצאת ועוקבים אחרי תוכנית — כמו במבחני למידת חומר חדש" },
};

export function generate(kind, n = 10, difficulty = 0, seed = Date.now()) {
  const r = rng(seed);
  const g = GENERATORS[kind];
  if (!g) return [];
  const out = [];
  for (let i = 0; i < n; i++) out.push(g.gen(r, difficulty || 0));
  return out;
}
