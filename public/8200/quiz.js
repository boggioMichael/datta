// quiz.js — מנוע התרגול: מציג שאלה אחת בכל פעם, שומר תשובות, מודד זמן, מציג הסבר וסיכום.
import { md, esc } from "./content.js";

const LIKERT = ["בכלל לא מסכים/ה", "לא מסכים/ה", "ניטרלי", "מסכים/ה", "מסכים/ה מאוד"];
const HEB = /[\u0590-\u05FF]/;
/** שורות בלי עברית (קודים, משפטים בשפה מלאכותית, אנגלית) מוצגות משמאל לימין */
export function bidiLines(text) {
  return String(text || "").split("\n").map((line) => { const t = line.trim(); if (!t) return ""; if (!HEB.test(t) && /[A-Za-z0-9]/.test(t)) { const codeLike = !/\s/.test(t) || /^[A-Z0-9\-\s·,]+$/.test(t); return `<bdi dir="ltr" class="ltr-line${codeLike ? " mono" : ""}">${esc(t)}</bdi>`; } return esc(line); }).join("<br>");
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export class Quiz {
  /**
   * @param {object} o
   * @param {HTMLElement} o.el
   * @param {Array} o.items
   * @param {string} o.title
   * @param {'practice'|'sim'|'surprise'|'daily'|'personality'} o.mode
   * @param {number} [o.timeLimitSec]  overall time (sim)
   * @param {boolean} [o.immediate]    show explanation right after each answer
   * @param {(result)=>void} o.onFinish
   * @param {()=>void} o.onExit
   */
  constructor(o) {
    Object.assign(this, { immediate: true, timeLimitSec: 0 }, o);
    this.idx = 0; this.answers = []; this.startedAt = Date.now(); this.itemStart = Date.now(); this.phase = "q"; this.timer = null; this.finished = false;
    this.onKey = (e) => this.handleKey(e);
  }
  mount() {
    this.el.innerHTML = "";
    this.root = document.createElement("section");
    this.root.className = "quiz";
    this.el.appendChild(this.root);
    document.addEventListener("keydown", this.onKey);
    if (this.timeLimitSec) { this.deadline = Date.now() + this.timeLimitSec * 1000; }
    this.tick();
    this.timer = setInterval(() => this.tick(), 500);
    this.render();
  }
  destroy() { clearInterval(this.timer); document.removeEventListener("keydown", this.onKey); }
  tick() {
    const t = this.root?.querySelector(".q-timer");
    if (!t) return;
    if (this.timeLimitSec) {
      const left = Math.max(0, Math.round((this.deadline - Date.now()) / 1000));
      t.textContent = fmtTime(left);
      t.classList.toggle("warn", left < 60);
      if (left <= 0 && !this.finished) { this.finish(true); }
    } else {
      const it = this.items[this.idx];
      const el = Math.round((Date.now() - this.itemStart) / 1000);
      t.textContent = fmtTime(el);
      t.classList.toggle("warn", it && it.timeSec && el > it.timeSec);
    }
  }
  handleKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (this.phase === "q") { const n = parseInt(e.key, 10); if (n >= 1 && n <= 5) { const btn = this.root.querySelectorAll(".opt")[n - 1]; btn?.click(); } }
    else if (this.phase === "fb" && e.key === "Enter") { this.next(); }
  }
  current() { return this.items[this.idx]; }
  render() {
    const it = this.current();
    if (!it) return this.finish(false);
    this.phase = it.memorize ? "mem" : "q";
    this.itemStart = Date.now();
    const total = this.items.length;
    const head = `
      <header class="q-head">
        <button class="btn-icon q-exit" aria-label="יציאה" title="יציאה">✕</button>
        <div class="q-progress"><div class="q-bar" style="width:${((this.idx) / total) * 100}%"></div></div>
        <div class="q-meta"><span class="q-count">${this.idx + 1}/${total}</span><span class="q-timer mono">0:00</span></div>
      </header>`;
    let body = "";
    if (it.memorize) {
      body = `<div class="q-card"><p class="q-sub">${esc(it.subTitle || "")}</p><p class="q-instr">זכרו את הרשימה. היא תיעלם בעוד <b class="mem-count">${it.memorizeSec || 12}</b> שניות.</p><div class="mem-box">${bidiLines(it.memorize)}</div><button class="btn primary mem-skip">סיימתי לזכור</button></div>`;
    } else body = this.questionHtml(it);
    this.root.innerHTML = head + body;
    this.root.querySelector(".q-exit").onclick = () => { if (confirm("לצאת מהתרגול? ההתקדמות עד כאן תישמר.")) { this.finish(false, true); } };
    if (it.memorize) {
      let left = it.memorizeSec || 12;
      const cnt = this.root.querySelector(".mem-count");
      const iv = setInterval(() => { left--; if (cnt) cnt.textContent = left; if (left <= 0) { clearInterval(iv); go(); } }, 1000);
      const go = () => { clearInterval(iv); this.phase = "q"; this.itemStart = Date.now(); this.root.innerHTML = head + this.questionHtml(it); this.wire(it); this.root.querySelector(".q-exit").onclick = () => { if (confirm("לצאת מהתרגול?")) this.finish(false, true); }; };
      this.root.querySelector(".mem-skip").onclick = go;
      return;
    }
    this.wire(it);
  }
  questionHtml(it) {
    const dir = it.ltr ? ' dir="ltr"' : "";
    const ctxLtr = it.context && !HEB.test(it.context);
    const ctx = it.context ? `<details class="q-ctx" ${this.lastGroup === it.group ? "" : "open"}><summary>חומר עזר לשאלה (לחצו לפתיחה/סגירה)</summary><div class="q-ctx-body"${ctxLtr ? ' dir="ltr"' : ""}>${md(it.context)}</div></details>` : "";
    this.lastGroup = it.group;
    const code = it.code ? `<pre class="code" dir="ltr"><code>${esc(it.code)}</code></pre>` : "";
    const matrix = it.matrix ? `<div class="matrix">${it.matrix.map((s) => `<div class="cell">${s}</div>`).join("")}<div class="cell missing">?</div></div>` : "";
    const seq = it.sequence ? `<div class="seq">${it.sequence.map((s) => `<div class="cell">${s}</div>`).join("")}<div class="cell missing">?</div></div>` : "";
    let opts = "";
    if (it.type === "mcq") {
      if (it.optionsSvg) opts = `<div class="opts opts-svg">${it.optionsSvg.map((s, i) => `<button class="opt opt-svg" data-i="${i}" aria-label="אפשרות ${i + 1}"><span class="opt-n">${i + 1}</span>${s}</button>`).join("")}</div>`;
      else { const optsLtr = it.optionsLtr || it.options.every((o) => !HEB.test(o) && /[A-Za-z]/.test(o)); const codeLike = optsLtr && it.options.every((o) => !/\s/.test(o)); opts = `<div class="opts${codeLike ? " code-opts" : ""}"${optsLtr ? ' dir="ltr"' : ""}>${it.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-n">${i + 1}</span><span class="opt-t">${esc(o)}</span></button>`).join("")}</div>`; }
    } else if (it.type === "likert") {
      opts = `<div class="opts likert">${LIKERT.map((o, i) => `<button class="opt" data-i="${i}"><span class="opt-n">${i + 1}</span><span class="opt-t">${o}</span></button>`).join("")}</div>`;
    } else if (it.type === "open") {
      opts = `<div class="open"><textarea class="open-ans" rows="5" placeholder="כתבו כאן את התשובה שלכם (או דברו אותה בקול ותמצתו)…"></textarea><button class="btn primary open-show">הצג תשובה לדוגמה</button></div>`;
    }
    const diff = it.difficulty ? `<span class="pill d${it.difficulty}">${["", "קל", "בינוני", "קשה"][it.difficulty]}</span>` : "";
    return `<div class="q-card">
      <p class="q-sub">${esc(it.subTitle || "")} ${diff}</p>
      ${ctx}
      <div class="q-text"${dir}>${bidiLines(it.q)}</div>
      ${code}${matrix}${seq}
      ${opts}
      <div class="q-fb" hidden></div>
    </div>`;
  }
  wire(it) {
    this.root.querySelectorAll(".opt").forEach((b) => { b.onclick = () => this.answer(it, parseInt(b.dataset.i, 10)); });
    const show = this.root.querySelector(".open-show");
    if (show) show.onclick = () => this.showModel(it);
  }
  answer(it, i) {
    if (this.phase !== "q") return;
    this.phase = "fb";
    const t = Math.round((Date.now() - this.itemStart) / 1000);
    const rec = { id: it.id, sub: it.sub, type: it.type, t, chosen: i, generated: !!it.generated };
    if (it.type === "mcq") rec.ok = i === it.answer;
    if (it.type === "likert") { rec.trait = it.trait; rec.reverse = !!it.reverse; rec.raw = i; rec.score = it.reverse ? 4 - i : i; rec.ok = true; rec.tags = it.tags || []; }
    this.answers.push(rec);
    const opts = this.root.querySelectorAll(".opt");
    opts.forEach((b) => (b.disabled = true));
    if (it.type === "mcq" && this.immediate) {
      opts[i]?.classList.add(rec.ok ? "right" : "wrong");
      opts[it.answer]?.classList.add("right");
      this.feedback(it, rec.ok ? "נכון! 🎯" : "לא מדויק", it.explanation);
    } else if (it.type === "mcq" && !this.immediate) {
      opts[i]?.classList.add("chosen");
      setTimeout(() => this.next(), 250);
    } else if (it.type === "likert") {
      opts[i]?.classList.add("chosen");
      setTimeout(() => this.next(), 200);
    }
  }
  showModel(it) {
    if (this.phase !== "q") return;
    this.phase = "fb";
    const txt = this.root.querySelector(".open-ans")?.value || "";
    const fb = this.root.querySelector(".q-fb");
    fb.hidden = false;
    fb.innerHTML = `<div class="fb-title">תשובה לדוגמה</div><div class="fb-body">${md(it.model || it.explanation || "")}</div>
      <p class="q-instr">איך הייתה התשובה שלכם לעומת הדוגמה?</p>
      <div class="rate"><button class="btn rate-b" data-r="0">צריך עוד עבודה</button><button class="btn rate-b" data-r="1">בסדר</button><button class="btn rate-b" data-r="2">מצוין</button></div>`;
    fb.querySelectorAll(".rate-b").forEach((b) => { b.onclick = () => { const r = parseInt(b.dataset.r, 10); this.answers.push({ id: it.id, sub: it.sub, type: "open", t: Math.round((Date.now() - this.itemStart) / 1000), ok: r >= 1, self: r, text: txt.slice(0, 2000) }); this.next(); }; });
    fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  feedback(it, title, expl) {
    const fb = this.root.querySelector(".q-fb");
    fb.hidden = false;
    const isLast = this.idx >= this.items.length - 1;
    fb.innerHTML = `<div class="fb-title">${esc(title)}</div><div class="fb-body">${md(expl || "")}</div><button class="btn primary fb-next">${isLast ? "סיום וסיכום" : "לשאלה הבאה"} ⏎</button>`;
    fb.querySelector(".fb-next").onclick = () => this.next();
    fb.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  next() {
    if (this.finished) return;
    this.idx++;
    if (this.idx >= this.items.length) return this.finish(false);
    this.render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  finish(timeout = false, aborted = false) {
    if (this.finished) return;
    this.finished = true;
    this.destroy();
    const durSec = Math.round((Date.now() - this.startedAt) / 1000);
    const scored = this.answers.filter((a) => a.type !== "likert");
    const ok = scored.filter((a) => a.ok).length;
    const result = { mode: this.mode, title: this.title, startedAt: this.startedAt, durSec, total: this.items.length, answered: this.answers.length, score: ok, scoredTotal: scored.length, answers: this.answers, timeout, aborted, items: this.items };
    this.onFinish?.(result);
  }
}

/** סיכום תרגול — HTML */
export function summaryHtml(result, { isPro } = {}) {
  const { answers, items } = result;
  const byId = new Map(items.map((it) => [it.id, it]));
  const scored = answers.filter((a) => a.type !== "likert");
  const pct = scored.length ? Math.round((result.score / scored.length) * 100) : 0;
  const bySub = {};
  for (const a of scored) { const s = (bySub[a.sub] ||= { n: 0, ok: 0, title: byId.get(a.id)?.subTitle || a.sub }); s.n++; if (a.ok) s.ok++; }
  const wrong = scored.filter((a) => !a.ok);
  const avgT = scored.length ? Math.round(scored.reduce((x, a) => x + a.t, 0) / scored.length) : 0;
  const grade = pct >= 85 ? "מצוין 🔥" : pct >= 70 ? "יפה מאוד 👏" : pct >= 50 ? "בכיוון הנכון 💪" : "זה רק ההתחלה 🌱";
  const likertN = answers.filter((a) => a.type === "likert").length;
  return `<div class="summary">
    <div class="sum-hero"><div class="ring" style="--p:${pct}"><span>${scored.length ? pct + "%" : "✓"}</span></div>
      <div><h2>${esc(result.title)}</h2><p class="muted">${scored.length ? `${result.score} מתוך ${scored.length} נכונות · ${grade}` : `${likertN} היגדים נענו`} · ${fmtTime(result.durSec)}${avgT ? ` · ${avgT} שנ׳ לשאלה` : ""}${result.timeout ? " · הזמן נגמר ⏱" : ""}</p></div></div>
    ${Object.keys(bySub).length > 1 ? `<div class="sum-subs">${Object.values(bySub).map((s) => `<div class="sum-sub"><span>${esc(s.title)}</span><div class="bar"><i style="width:${Math.round((s.ok / s.n) * 100)}%"></i></div><b>${s.ok}/${s.n}</b></div>`).join("")}</div>` : ""}
    ${wrong.length ? `<h3>מה כדאי לחזור עליו (${wrong.length})</h3><div class="sum-wrong">${wrong.map((a) => { const it = byId.get(a.id); if (!it) return ""; return `<details class="wrong-item"><summary><span class="x">✕</span> ${esc(it.q.split("\n")[0]).slice(0, 110)}${it.generated ? ` <span class="muted small">(${items.indexOf(it) + 1})</span>` : ""}</summary>${it.code ? `<pre class="code" dir="ltr"><code>${esc(it.code)}</code></pre>` : ""}${it.type === "mcq" ? (it.optionsSvg ? `<div class="mini-opts"><div class="mini right"><span>נכון</span>${it.optionsSvg[it.answer]}</div>${a.chosen != null && a.chosen !== it.answer ? `<div class="mini wrong"><span>בחרתם</span>${it.optionsSvg[a.chosen] || ""}</div>` : ""}</div>` : `<p><b>התשובה הנכונה:</b> ${esc(it.options[it.answer])}${a.chosen != null && a.chosen !== it.answer ? ` · <span class="muted">בחרתם: ${esc(it.options[a.chosen] ?? "—")}</span>` : ""}</p>`) : ""}<div class="fb-body">${md(it.explanation || it.model || "")}</div></details>`; }).join("")}</div>` : (scored.length ? `<p class="sum-perfect">בלי טעויות! 🏆</p>` : "")}
    ${!isPro && wrong.length ? `<p class="muted small">ב-PRO תקבלו גם תרגול חוזר אוטומטי של הטעויות ומאגר מלא.</p>` : ""}
  </div>`;
}
