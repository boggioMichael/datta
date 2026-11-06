/* The daily report: how many times "no" was said each day, one column per day, with a short
 * summary and a tooltip per day. The list of days below it in the history sheet is its table.
 * One series, so no legend: the title names it. Time runs in reading order (right to left in
 * Hebrew), so today sits where the eye ends. */

import { dayNumber } from './i18n.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAD = Object.freeze({ top: 24, bottom: 26, side: 8 });
const BAR = Object.freeze({ max: 24, gap: 2, radius: 4 });
const TICKS = 2;
const NICE = Object.freeze([1, 2, 2.5, 5, 10]);
const LABEL_GAP = 6;
const TIP_GAP = 8;
const CLS = Object.freeze({ grid: 'report-grid', tick: 'report-tick', bar: 'report-bar', today: 'is-today', value: 'report-value', axis: 'report-axis', hit: 'report-hit', active: 'is-active' });
const ANCHOR = Object.freeze({ start: 'start', middle: 'middle', end: 'end' });
const ATTR = Object.freeze({ label: 'aria-label', role: 'role', index: 'data-i' });
const ROLE_IMG = 'img';
const EV = Object.freeze({ move: 'pointermove', down: 'pointerdown', leave: 'pointerleave', change: 'change' });
const TAG = Object.freeze({ label: 'label', input: 'input', span: 'span', div: 'div', dt: 'dt', dd: 'dd', strong: 'strong' });
const PARTS = Object.freeze({ period: 'period', chart: 'chart', tip: 'tip', summary: 'summary' });
const RADIO = 'radio';
const PERIOD_GROUP = 'report-period';
const SEGMENT = 'segment';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const r1 = (n) => Math.round(n * 10) / 10;

/** Counts and totals for the last `days` local days, oldest first. Entries are oldest first. */
export function dailySeries(entries, days, today = dayNumber(Date.now())) {
  const first = today - days + 1;
  const series = Array.from({ length: days }, (_, i) => ({ day: first + i, count: 0, total: 0 }));
  for (let i = entries.length - 1; i >= 0; i--) {
    const day = dayNumber(entries[i].at);
    if (day < first) break;
    if (day > today) continue;
    series[day - first].count += 1;
    series[day - first].total += entries[i].amount;
  }
  return series;
}

export function summarize(series) {
  const count = series.reduce((sum, d) => sum + d.count, 0);
  const best = series.reduce((a, b) => (b.count > a.count ? b : a), series[0]);
  return { count, daysWith: series.filter((d) => d.count).length, days: series.length, average: count / series.length, best: best.count ? best : null };
}

/** The smallest "nice" number (1, 2, 2.5, 5 × 10ⁿ) at or above v; at least 1. */
function niceCeil(v) {
  if (v <= 1) return 1;
  const power = 10 ** Math.floor(Math.log10(v));
  const step = NICE.find((n) => n * power >= v);
  return step * power;
}

function columnPath(x, y, w, base) {
  const r = Math.min(BAR.radius, w / 2, base - y);
  return `M${r1(x)} ${r1(base)}V${r1(y + r)}Q${r1(x)} ${r1(y)} ${r1(x + r)} ${r1(y)}H${r1(x + w - r)}Q${r1(x + w)} ${r1(y)} ${r1(x + w)} ${r1(y + r)}V${r1(base)}Z`;
}

/**
 * createReport({ root, i18n, keys, periods, defaultPeriod, height })
 * root holds [data-report="period"], [data-report="chart"], [data-report="tip"] and [data-report="summary"].
 */
export function createReport({ root, i18n, keys, periods, defaultPeriod, height }) {
  const find = (name) => root.querySelector(`[data-report="${name}"]`);
  const el = { period: find(PARTS.period), chart: find(PARTS.chart), tip: find(PARTS.tip), summary: find(PARTS.summary) };
  let period = defaultPeriod;
  let series = [];
  let geometry = null;
  let entries = [];
  let rtl = false;
  let periodsKey = '';

  function renderPeriods() {
    const key = periods.map(i18n.days).join();
    if (key === periodsKey) return;
    periodsKey = key;
    el.period.replaceChildren(...periods.map((n) => {
      const label = document.createElement(TAG.label);
      const input = document.createElement(TAG.input);
      const text = document.createElement(TAG.span);
      label.className = SEGMENT;
      input.type = RADIO;
      input.name = PERIOD_GROUP;
      input.value = String(n);
      input.checked = n === period;
      text.textContent = i18n.days(n);
      label.append(input, text);
      return label;
    }));
  }

  function renderChart() {
    const width = Math.max(200, el.chart.clientWidth || 320);
    const n = series.length;
    const plotW = width - PAD.side * 2;
    const base = height - PAD.bottom;
    const plotH = base - PAD.top;
    const slot = plotW / n;
    const bar = Math.max(1, Math.min(BAR.max, slot - BAR.gap));
    const top = niceCeil(Math.max(...series.map((d) => d.count)));
    const pos = (i) => (rtl ? n - 1 - i : i);
    const x = (i) => PAD.side + pos(i) * slot + (slot - bar) / 2;
    const y = (v) => base - (v / top) * plotH;
    const startX = rtl ? width - PAD.side : PAD.side;
    const startAnchor = rtl ? ANCHOR.end : ANCHOR.start;

    const grid = Array.from({ length: TICKS + 1 }, (_, k) => {
      const value = (top / TICKS) * k;
      const gy = r1(y(value));
      const label = Number.isInteger(value) && k ? `<text class="${CLS.tick}" x="${startX}" y="${gy - 4}" text-anchor="${startAnchor}">${esc(i18n.number(value))}</text>` : '';
      return `<line class="${CLS.grid}" x1="${PAD.side}" x2="${width - PAD.side}" y1="${gy}" y2="${gy}"/>${label}`;
    }).join('');

    const todayIndex = n - 1;
    const best = summarize(series).best;
    const bars = series.map((d, i) => (d.count
      ? `<path class="${CLS.bar}${i === todayIndex ? ` ${CLS.today}` : ''}" d="${columnPath(x(i), y(d.count), bar, base)}"/>`
      : '')).join('');

    const labelled = new Set([todayIndex]);
    if (best) labelled.add(series.indexOf(best));
    const values = [...labelled].filter((i) => series[i].count).map((i) =>
      `<text class="${CLS.value}" x="${r1(x(i) + bar / 2)}" y="${r1(y(series[i].count) - LABEL_GAP)}" text-anchor="${ANCHOR.middle}">${esc(i18n.number(series[i].count))}</text>`).join('');

    const axis = [0, Math.floor((n - 1) / 2), n - 1].map((i, k, all) => {
      const anchor = k === 0 ? (rtl ? ANCHOR.end : ANCHOR.start) : k === all.length - 1 ? (rtl ? ANCHOR.start : ANCHOR.end) : ANCHOR.middle;
      const ax = k === 1 ? x(i) + bar / 2 : (k === 0) === !rtl ? PAD.side : width - PAD.side;
      return `<text class="${CLS.axis}" x="${r1(ax)}" y="${height - 6}" text-anchor="${anchor}">${esc(i18n.shortDay(series[i].day))}</text>`;
    }).join('');

    const hits = series.map((d, i) => `<rect class="${CLS.hit}" ${ATTR.index}="${i}" x="${r1(PAD.side + pos(i) * slot)}" y="0" width="${r1(slot)}" height="${height}"/>`).join('');

    el.chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" direction="ltr">${grid}${bars}${values}${axis}${hits}</svg>`;
    const svg = el.chart.firstElementChild;
    svg.setAttribute(ATTR.role, ROLE_IMG);
    svg.setAttribute(ATTR.label, i18n.t(keys.reportChart, { period: i18n.days(n) }));
    geometry = { width, slot, bar, x, y };
    hideTip();
  }

  function renderSummary() {
    const s = summarize(series);
    const rows = [
      [keys.reportDaysWith, i18n.t(keys.reportDaysOf, { n: i18n.number(s.daysWith), total: i18n.number(s.days) })],
      [keys.reportAverage, i18n.decimal(s.average)],
      [keys.reportBest, s.best ? i18n.t(keys.reportBestValue, { count: i18n.plural(keys.historyTimes, s.best.count), day: i18n.shortDay(s.best.day) }) : i18n.number(0)],
    ];
    el.summary.replaceChildren(...rows.map(([label, value]) => {
      const row = document.createElement(TAG.div);
      const dt = document.createElement(TAG.dt);
      const dd = document.createElement(TAG.dd);
      dt.textContent = i18n.t(label);
      dd.textContent = value;
      row.append(dt, dd);
      return row;
    }));
  }

  function showTip(index) {
    const d = series[index];
    if (!d || !geometry) return;
    el.tip.replaceChildren();
    const day = document.createElement(TAG.strong);
    const value = document.createElement(TAG.span);
    day.textContent = i18n.longDay(d.day);
    value.textContent = i18n.t(keys.reportTip, { count: i18n.plural(keys.historyTimes, d.count), amount: i18n.money(d.total) });
    el.tip.append(day, value);
    el.tip.hidden = false;
    const center = geometry.x(index) + geometry.bar / 2;
    const half = el.tip.offsetWidth / 2;
    el.tip.style.left = `${Math.min(geometry.width - half, Math.max(half, center))}px`;
    el.tip.style.top = `${Math.max(el.tip.offsetHeight + TIP_GAP, geometry.y(d.count) - TIP_GAP)}px`; // stays inside the plot
    el.chart.querySelectorAll(`.${CLS.hit}`).forEach((hit) => hit.classList.toggle(CLS.active, Number(hit.getAttribute(ATTR.index)) === index));
  }

  function hideTip() {
    el.tip.hidden = true;
    el.chart.querySelectorAll(`.${CLS.active}`).forEach((hit) => hit.classList.remove(CLS.active));
  }

  const pick = (event) => {
    const index = Number(event.target.getAttribute?.(ATTR.index));
    if (Number.isInteger(index) && event.target.hasAttribute(ATTR.index)) showTip(index);
  };
  el.chart.addEventListener(EV.move, pick);
  el.chart.addEventListener(EV.down, pick);
  el.chart.addEventListener(EV.leave, hideTip);
  el.period.addEventListener(EV.change, (event) => {
    period = Number(event.target.value);
    render(entries, rtl);
  });

  /** Draw the report for a bank's entries. */
  function render(nextEntries, isRtl) {
    entries = nextEntries;
    rtl = isRtl;
    renderPeriods();
    series = dailySeries(entries, period);
    renderChart();
    renderSummary();
  }

  return { render };
}
