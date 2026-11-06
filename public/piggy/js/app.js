/* קופת הלא · The No Bank — the page controller.
 * Tap the pig every time you say no to yourself: the chosen size of "no" flies in as a
 * coin, a bill or a gold bar, and the register rolls. Several plans, each its own pig. */

import { CONFIG, SOUND } from './config.js';
import { STRINGS, KEYS } from './strings.js';
import { createI18n, dayNumber } from './i18n.js';
import { createStore, STORE_EVENT, REASON, BackupError, balanceOf, sizeById, glazeById } from './store.js';
import { createRegister } from './register.js';
import { createParticles } from './fx.js';
import { createSound } from './sound.js';
import { createStage } from './stage.js';
import { moneyMarkup, moneyDefs } from './art.js';
import { createHaptics } from './haptics.js';

/* ───────────────────────── names used in index.html ───────────────────────── */

const ID = Object.freeze({
  plans: 'plans', openSettings: 'open-settings',
  register: 'register', goal: 'goal', goalFill: 'goal-fill', goalCaption: 'goal-caption',
  stage: 'stage', rosette: 'rosette', pig: 'pig', pigShadow: 'pig-shadow', pigJump: 'pig-jump', pigSquash: 'pig-squash', pigFat: 'pig-fat', pigArt: 'pig-art',
  toast: 'toast', toastText: 'toast-text', toastAction: 'toast-action',
  today: 'today', sizes: 'sizes', openHistory: 'open-history',
  clip: 'drop-clip', floatLayer: 'float-layer', fx: 'fx', defs: 'defs', download: 'download', importFile: 'import-file',
  editor: 'editor', editorForm: 'editor-form', editorTitle: 'editor-title', editorName: 'editor-name', editorGlazes: 'editor-glazes',
  editorGoal: 'editor-goal', editorAmounts: 'editor-amounts', editorSubmit: 'editor-submit', editorDanger: 'editor-danger',
  editorBreak: 'editor-break', editorDelete: 'editor-delete',
  settings: 'settings', settingsLocales: 'settings-locales', settingsSound: 'settings-sound', settingsCurrencies: 'settings-currencies',
  settingsExport: 'settings-export', settingsImport: 'settings-import', settingsSite: 'settings-site',
  history: 'history', historyTitle: 'history-title', historySummary: 'history-summary', historyEmpty: 'history-empty',
  historyList: 'history-list', historyMore: 'history-more', historyRounds: 'history-rounds', historyRoundsList: 'history-rounds-list',
  confirm: 'confirm', confirmTitle: 'confirm-title', confirmBody: 'confirm-body', confirmOk: 'confirm-ok',
  tplTab: 'tpl-tab', tplAdd: 'tpl-add', tplSize: 'tpl-size', tplGlaze: 'tpl-glaze', tplAmount: 'tpl-amount', tplSegment: 'tpl-segment',
  tplSummary: 'tpl-summary', tplDay: 'tpl-day', tplRow: 'tpl-row', tplRound: 'tpl-round',
});
const PART = Object.freeze({
  dot: 'dot', name: 'name', edit: 'edit', input: 'input', money: 'money', amount: 'amount', swatch: 'swatch', symbol: 'symbol',
  label: 'label', count: 'count', total: 'total', rows: 'rows', time: 'time', size: 'size', remove: 'remove', dates: 'dates',
});
const CLS = Object.freeze({ selected: 'is-selected', closing: 'is-closing', danger: 'is-danger', shown: 'is-shown', symbolAfter: 'is-symbol-after' });
const SEL = Object.freeze({
  tab: '[data-plan], [data-add]',
  close: '[data-close]',
  currencySymbol: '[data-currency-symbol]',
  moneyInput: '.money-input',
  amountInput: 'input[data-size]',
  removeEntry: '[data-entry]',
  openDialog: 'dialog[open]',
  typing: 'input, textarea, select',
});
const DATA = Object.freeze({ plan: 'plan', add: 'add', size: 'size', entry: 'entry' });
const ATTR = Object.freeze({ label: 'aria-label', current: 'aria-current', title: 'title', lang: 'lang', hidden: 'hidden' });
const GROUP = Object.freeze({ size: 'size', glaze: 'glaze', locale: 'locale', currency: 'currency' });
const VAR = Object.freeze({ dot: '--dot', iconWidth: '--w', columns: '--n', glazeLight: '--g-light', glazeBase: '--g-base', glazeDark: '--g-dark' });
const EV = Object.freeze({
  click: 'click', change: 'change', submit: 'submit', keydown: 'keydown', cancel: 'cancel', close: 'close',
  animationend: 'animationend', contextmenu: 'contextmenu', visibility: 'visibilitychange', touchstart: 'touchstart',
});
const SHORTCUT = Object.freeze({ undo: 'z' });
const CONFIRM_OK = 'ok'; // the value of #confirm-ok
const DIR_RTL = 'rtl';
const ABORT = 'AbortError';
const POINTER_COARSE = '(pointer: coarse)';
const SCROLL_NEAREST = Object.freeze({ block: 'nearest', inline: 'nearest' });
const TEMPLATE_FIELD = /\{(\w+)\}/g;
const WEEK_DAYS = 7;
const PERCENT_STEP = 100;
const URL_REVOKE_MS = 60000;
const DATE = Object.freeze({ width: 2, pad: '0', join: '-' }); // a sortable YYYY-MM-DD in local time

/* ───────────────────────── helpers ───────────────────────── */

const dom = Object.fromEntries(Object.entries(ID).map(([key, id]) => [key, document.getElementById(id)]));
const part = (root, name) => root.querySelector(`[data-part="${name}"]`);
const fillTemplate = (template, values) => template.replace(TEMPLATE_FIELD, (match, name) => (name in values ? values[name] : match));
const reducedMotion = matchMedia(CONFIG.media.reducedMotion);
const isReduced = () => reducedMotion.matches;
const localDate = (d = new Date()) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(DATE.width, DATE.pad)).join(DATE.join);

/* ───────────────────────── wiring ───────────────────────── */

const store = createStore();
const i18n = createI18n({ strings: STRINGS, fallback: CONFIG.defaultLocale });
const { t } = i18n;
const sound = createSound(CONFIG.audio);
const haptic = createHaptics();
const fx = createParticles(dom.fx, CONFIG.particles);
const localeOf = (id) => CONFIG.locales.find((l) => l.id === id) ?? CONFIG.locales[0];
const isRtl = () => localeOf(i18n.locale).dir === DIR_RTL;
const stage = createStage({ dom, fx, isReduced, isRtl });
const register = createRegister(dom.register, { ...CONFIG.register, isReduced, describe: (v) => t(KEYS.registerLabel, { amount: i18n.money(v) }) });

const ui = {
  /** Entries whose money is still in the air: not on the register yet. id → { planId, amount } */
  inFlight: new Map(),
  /** Cancel functions of flights, so undo can stop a coin mid-air. id → cancel() */
  flights: new Map(),
  /** Whether each plan's pig was gold the last time it was shown (celebrate the change only). */
  gilded: new Map(),
  holdRegister: false,
  historyLimit: CONFIG.limits.historyPage,
  editing: null,
  toastTimer: 0,
  toastFade: 0,
  toastRun: null,
  persistAsked: false,
  signatures: {},
};

/* ───────────────────────── reading the state ───────────────────────── */

const state = () => store.state;
const activePlan = () => store.active();
const planIndex = (plan) => state().plans.findIndex((p) => p.id === plan.id);
const planName = (plan) => plan.name || t(KEYS.planFallback, { n: i18n.number(planIndex(plan) + 1) });
const sizeLabel = (id) => t(KEYS.sizePrefix + id);
const pendingFor = (planId) => [...ui.inFlight.values()].reduce((sum, f) => (f.planId === planId ? sum + f.amount : sum), 0);
const shownBalance = (plan) => balanceOf(plan) - pendingFor(plan.id);
const lookFor = (size, amount) => ({ tone: size.tone, colors: CONFIG.tones[size.tone], mark: t(KEYS.coinMark), value: i18n.number(amount) });
const showerLook = () => ({ tone: CONFIG.showerTone, colors: CONFIG.tones[CONFIG.showerTone], mark: t(KEYS.coinMark), value: '' });

/** Count and total of the newest entries since a local day number (entries are oldest first). */
function since(plan, fromDay) {
  let count = 0;
  let total = 0;
  for (let i = plan.entries.length - 1; i >= 0; i--) {
    const e = plan.entries[i];
    if (dayNumber(e.at) < fromDay) break;
    count += 1;
    total += e.amount;
  }
  return { count, total };
}

function fatness(plan, shown) {
  if (plan.goal > 0) return Math.min(1, shown / plan.goal);
  return 1 - Math.exp(-shown / CONFIG.motion.fat.softScale);
}

/* ───────────────────────── rendering ───────────────────────── */

function cloneTemplate(template) {
  const node = template.content.firstElementChild.cloneNode(true);
  i18n.apply(node);
  return node;
}

function applyLocale() {
  const { locale, currency } = state().settings;
  i18n.configure(locale, currency);
  const meta = localeOf(i18n.locale);
  document.documentElement.lang = meta.id;
  document.documentElement.dir = meta.dir;
  document.title = fillTemplate(CONFIG.site.title, { app: t(KEYS.appTitle) });
  i18n.apply(document);
  register.setCurrency(i18n.currencyLayout());
  dom.settingsSite.href = fillTemplate(CONFIG.site.home, { locale: meta.id });
  ui.signatures = {};
}

function renderTabs() {
  const s = state();
  const signature = JSON.stringify([i18n.locale, s.activePlanId, s.plans.map((p) => [p.id, p.name, p.glaze])]);
  if (ui.signatures.tabs === signature) return;
  ui.signatures.tabs = signature;
  const tabs = s.plans.map((plan) => {
    const node = cloneTemplate(dom.tplTab);
    const current = plan.id === s.activePlanId;
    node.dataset[DATA.plan] = plan.id;
    node.setAttribute(ATTR.current, String(current));
    node.setAttribute(ATTR.label, current ? t(KEYS.planEdit, { plan: planName(plan) }) : planName(plan));
    part(node, PART.dot).style.setProperty(VAR.dot, glazeById(plan.glaze).base);
    part(node, PART.name).textContent = planName(plan);
    part(node, PART.edit).toggleAttribute(ATTR.hidden, !current);
    return node;
  });
  dom.plans.replaceChildren(...tabs, cloneTemplate(dom.tplAdd));
  dom.plans.querySelector(`[${ATTR.current}="${String(true)}"]`)?.scrollIntoView(SCROLL_NEAREST);
}

function renderSizes() {
  const plan = activePlan();
  const signature = JSON.stringify([i18n.locale, i18n.currency, plan.id, plan.amounts]);
  if (ui.signatures.sizes !== signature) {
    ui.signatures.sizes = signature;
    const options = CONFIG.sizes.map((size) => {
      const node = cloneTemplate(dom.tplSize);
      const input = part(node, PART.input);
      input.name = GROUP.size;
      input.value = size.id;
      const money = part(node, PART.money);
      money.innerHTML = moneyMarkup(size.money, lookFor(size, plan.amounts[size.id]));
      money.style.setProperty(VAR.iconWidth, `${size.icon}px`);
      part(node, PART.name).textContent = sizeLabel(size.id);
      part(node, PART.amount).textContent = i18n.money(plan.amounts[size.id]);
      return node;
    });
    dom.sizes.replaceChildren(dom.sizes.firstElementChild, ...options);
    dom.sizes.style.setProperty(VAR.columns, CONFIG.sizes.length);
  }
  // Selection is updated in place, so arrow-key navigation keeps its focus.
  dom.sizes.querySelectorAll(`input[name="${GROUP.size}"]`).forEach((input) => {
    input.checked = input.value === plan.size;
    input.parentElement.classList.toggle(CLS.selected, input.checked);
  });
}

function renderVault({ animate = true } = {}) {
  if (ui.holdRegister) return;
  const plan = activePlan();
  const shown = shownBalance(plan);
  register.set(shown, { animate });
  renderGoal(plan, shown);
  renderPig(plan, shown, { celebrate: animate });
  dom.pig.setAttribute(ATTR.label, t(KEYS.pigTap, { amount: i18n.money(plan.amounts[plan.size]), plan: planName(plan) }));
}

function renderGoal(plan, shown) {
  dom.goal.hidden = !(plan.goal > 0);
  if (dom.goal.hidden) return;
  const progress = Math.min(1, shown / plan.goal);
  dom.goalFill.style.width = `${progress * 100}%`;
  dom.goalCaption.textContent = progress >= 1
    ? t(KEYS.goalReached, { goal: i18n.money(plan.goal) })
    : t(KEYS.goalProgress, { percent: i18n.percent(Math.floor(progress * PERCENT_STEP) / PERCENT_STEP), goal: i18n.money(plan.goal) });
}

function renderPig(plan, shown, { celebrate }) {
  const reached = plan.goal > 0 && shown >= plan.goal;
  const was = ui.gilded.get(plan.id);
  stage.setGlaze(reached ? CONFIG.gilded : glazeById(plan.glaze));
  stage.setFatness(fatness(plan, shown));
  ui.gilded.set(plan.id, reached);
  if (reached && was === false && celebrate) {
    stage.gild();
    sound.play(SOUND.GOAL);
    haptic(CONFIG.haptics.goal);
    toast(t(KEYS.toastGoal));
  }
}

function renderToday() {
  const plan = activePlan();
  const { count } = since(plan, dayNumber(Date.now()));
  if (count) dom.today.textContent = i18n.plural(KEYS.todayCount, count);
  else dom.today.textContent = t(plan.entries.length || plan.rounds.length ? KEYS.todayNone : KEYS.todayFirst);
}

function renderAll({ animate = true } = {}) {
  renderTabs();
  renderSizes();
  renderVault({ animate });
  renderToday();
  if (dom.history.open) renderHistory();
  if (dom.settings.open) renderSettings();
}

/* ───────────────────────── the pig ───────────────────────── */

function askPersist() {
  if (ui.persistAsked) return;
  ui.persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

function dropNo() {
  if (stage.busy) return;
  sound.unlock();
  const plan = activePlan();
  const size = sizeById(plan.size);
  const entry = store.addEntry(plan.id, size.id); // the change handler puts it in flight
  if (!entry) return;
  askPersist();
  haptic(size.haptic);
  const cancel = stage.drop(size, lookFor(size, entry.amount), {
    showerLook: showerLook(),
    onEnter: () => {
      ui.flights.delete(entry.id);
      sound.play(size.sound);
      stage.react(size);
      stage.sparkle(size);
      stage.float(i18n.signed(entry.amount));
      ui.inFlight.delete(entry.id);
      if (activePlan().id === plan.id) renderVault();
    },
    onShowerCoin: () => sound.play(SOUND.TINK, { level: 0.5 }),
  });
  ui.flights.set(entry.id, cancel);
  toast(i18n.plural(KEYS.toastAdded, entry.amount, { amount: i18n.money(entry.amount) }), {
    label: t(KEYS.toastUndo),
    run: () => undoEntry(plan.id, entry.id),
  });
}

function undoEntry(planId, entryId) {
  ui.flights.get(entryId)?.();
  ui.flights.delete(entryId);
  if (!store.removeEntry(planId, entryId)) return;
  sound.play(SOUND.UNDO);
  haptic(CONFIG.haptics.undo);
  toast(t(KEYS.toastUndone));
}

function undoLast() {
  const plan = activePlan();
  const last = plan.entries[plan.entries.length - 1];
  if (last) undoEntry(plan.id, last.id);
}

function dropFlightsOf(planId) {
  ui.inFlight.forEach((flight, id) => {
    if (flight.planId !== planId) return;
    ui.flights.get(id)?.();
    ui.flights.delete(id);
    ui.inFlight.delete(id);
  });
}

function dropAllFlights() {
  ui.flights.forEach((cancel) => cancel());
  ui.flights.clear();
  ui.inFlight.clear();
}

async function breakPlan(plan) {
  const amount = balanceOf(plan);
  const glaze = ui.gilded.get(plan.id) ? CONFIG.gilded : glazeById(plan.glaze);
  dropFlightsOf(plan.id);
  ui.holdRegister = true;
  store.breakPlan(plan.id);
  await stage.smash({
    amount,
    shardColors: [glaze.light, glaze.base, glaze.dark, glaze.base],
    onImpact: () => {
      sound.play(SOUND.SHATTER);
      haptic(CONFIG.haptics.shatter);
    },
    onShatter: () => {
      ui.holdRegister = false;
      ui.gilded.set(plan.id, false);
      renderVault();
    },
  });
  toast(t(KEYS.toastBroken, { amount: i18n.money(amount) }));
}

/* ───────────────────────── toast ───────────────────────── */

/** One toast at a time; a new message replaces the text in place, so quick taps don't flicker. */
function toast(text, action = null) {
  dom.toastText.textContent = text;
  ui.toastRun = action?.run ?? null;
  dom.toastAction.hidden = !action;
  if (action) dom.toastAction.textContent = action.label;
  clearTimeout(ui.toastFade);
  if (dom.toast.hidden) {
    dom.toast.hidden = false;
    dom.toast.getBoundingClientRect(); // start the slide-in from the hidden state
  }
  dom.toast.classList.add(CLS.shown);
  clearTimeout(ui.toastTimer);
  ui.toastTimer = setTimeout(hideToast, CONFIG.timing.toastMs);
}

function hideToast() {
  clearTimeout(ui.toastTimer);
  ui.toastRun = null;
  dom.toast.classList.remove(CLS.shown);
  ui.toastFade = setTimeout(() => { dom.toast.hidden = true; }, CONFIG.timing.toastFadeMs);
}

/* ───────────────────────── sheets ───────────────────────── */

function openSheet(dialog) {
  if (!dialog.open) dialog.showModal();
}

function closeSheet(dialog) {
  return new Promise((resolve) => {
    if (!dialog.open) { resolve(); return; }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      dialog.classList.remove(CLS.closing);
      dialog.close();
      resolve();
    };
    if (isReduced()) { finish(); return; }
    dialog.classList.add(CLS.closing);
    dialog.addEventListener(EV.animationend, finish, { once: true });
    setTimeout(finish, CONFIG.timing.sheetCloseMs);
  });
}

function confirmDialog({ title, body, ok, danger = false }) {
  dom.confirmTitle.textContent = title;
  dom.confirmBody.textContent = body;
  dom.confirmOk.textContent = ok;
  dom.confirmOk.classList.toggle(CLS.danger, danger);
  dom.confirm.returnValue = '';
  openSheet(dom.confirm);
  return new Promise((resolve) => {
    dom.confirm.addEventListener(EV.close, () => resolve(dom.confirm.returnValue === CONFIRM_OK), { once: true });
  });
}

/* ───────────────────────── editor ───────────────────────── */

function unusedGlaze() {
  const used = new Set(state().plans.map((p) => p.glaze));
  return (CONFIG.glazes.find((g) => !used.has(g.id)) ?? CONFIG.glazes[state().plans.length % CONFIG.glazes.length]).id;
}

function renderGlazes(selected) {
  dom.editorGlazes.replaceChildren(...CONFIG.glazes.map((glaze) => {
    const node = cloneTemplate(dom.tplGlaze);
    const input = part(node, PART.input);
    input.name = GROUP.glaze;
    input.value = glaze.id;
    input.checked = glaze.id === selected;
    const swatch = part(node, PART.swatch);
    swatch.style.setProperty(VAR.glazeLight, glaze.light);
    swatch.style.setProperty(VAR.glazeBase, glaze.base);
    swatch.style.setProperty(VAR.glazeDark, glaze.dark);
    part(node, PART.name).textContent = t(KEYS.glazePrefix + glaze.id);
    return node;
  }));
}

function renderAmounts(amounts) {
  const { symbol } = i18n.currencyLayout();
  dom.editorAmounts.replaceChildren(...CONFIG.sizes.map((size) => {
    const node = cloneTemplate(dom.tplAmount);
    part(node, PART.money).innerHTML = moneyMarkup(size.money, lookFor(size, amounts[size.id]));
    part(node, PART.name).textContent = sizeLabel(size.id);
    part(node, PART.symbol).textContent = symbol;
    const input = part(node, PART.input);
    input.dataset[DATA.size] = size.id;
    input.min = CONFIG.limits.amountMin;
    input.max = CONFIG.limits.amountMax;
    input.value = amounts[size.id];
    return node;
  }));
}

function openEditor(plan) {
  ui.editing = plan ? plan.id : null;
  const source = plan ?? {
    name: '',
    glaze: unusedGlaze(),
    goal: 0,
    amounts: Object.fromEntries(CONFIG.sizes.map((s) => [s.id, s.amount])),
  };
  dom.editorTitle.textContent = t(plan ? KEYS.editorEdit : KEYS.editorNew);
  dom.editorSubmit.textContent = t(plan ? KEYS.editorSave : KEYS.editorCreate);
  dom.editorName.value = source.name;
  dom.editorName.maxLength = CONFIG.limits.nameLength;
  dom.editorGoal.max = CONFIG.limits.goalMax;
  dom.editorGoal.value = source.goal > 0 ? source.goal : '';
  renderGlazes(source.glaze);
  renderAmounts(source.amounts);
  const { symbol, first } = i18n.currencyLayout();
  dom.editor.querySelectorAll(SEL.currencySymbol).forEach((el) => { el.textContent = symbol; });
  dom.editor.querySelectorAll(SEL.moneyInput).forEach((el) => el.classList.toggle(CLS.symbolAfter, !first));
  dom.editorDanger.hidden = !plan;
  dom.editorBreak.disabled = !plan || !plan.entries.length;
  openSheet(dom.editor);
}

function readEditor() {
  const amounts = Object.fromEntries([...dom.editorAmounts.querySelectorAll(SEL.amountInput)].map((input) => [
    input.dataset[DATA.size],
    input.value === '' ? undefined : Number(input.value),
  ]));
  return {
    name: dom.editorName.value,
    glaze: dom.editorForm.elements[GROUP.glaze]?.value,
    goal: Number(dom.editorGoal.value) || 0,
    amounts,
  };
}

/* ───────────────────────── settings ───────────────────────── */

function renderSegmented(container, group, options, selected) {
  container.replaceChildren(...options.map((option) => {
    const node = cloneTemplate(dom.tplSegment);
    const input = part(node, PART.input);
    input.name = group;
    input.value = option.value;
    input.checked = option.value === selected;
    const label = part(node, PART.label);
    label.textContent = option.label;
    if (option.lang) label.setAttribute(ATTR.lang, option.lang);
    if (option.title) node.setAttribute(ATTR.title, option.title);
    return node;
  }));
}

function renderSettings() {
  const { settings } = state();
  renderSegmented(dom.settingsLocales, GROUP.locale, CONFIG.locales.map((l) => ({ value: l.id, label: i18n.languageName(l.id), lang: l.id })), settings.locale);
  renderSegmented(dom.settingsCurrencies, GROUP.currency, CONFIG.currencies.map((code) => ({ value: code, label: i18n.currencySymbol(code), title: i18n.currencyName(code) })), settings.currency);
  dom.settingsSound.checked = settings.sound;
}

async function exportBackup() {
  const text = store.exportBackup();
  const name = fillTemplate(CONFIG.backup.fileName, { date: localDate() });
  const file = new File([text], name, { type: CONFIG.backup.mime });
  if (matchMedia(POINTER_COARSE).matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      toast(t(KEYS.toastExported));
      return;
    } catch (error) {
      if (error?.name === ABORT) return;
    }
  }
  const url = URL.createObjectURL(file);
  dom.download.href = url;
  dom.download.download = name;
  dom.download.click();
  setTimeout(() => URL.revokeObjectURL(url), URL_REVOKE_MS);
  toast(t(KEYS.toastExported));
}

async function importBackup(file) {
  let next;
  try {
    next = store.readBackup(await file.text());
  } catch (error) {
    if (!(error instanceof BackupError)) throw error;
    toast(t(KEYS.toastImportFailed));
    return;
  }
  const ok = await confirmDialog({
    title: t(KEYS.confirmImportTitle),
    body: i18n.plural(KEYS.confirmImportBody, next.plans.length),
    ok: t(KEYS.confirmImportOk),
  });
  if (!ok) return;
  dropAllFlights();
  ui.gilded.clear();
  store.restore(next);
  await closeSheet(dom.settings);
  toast(t(KEYS.toastImported));
}

/* ───────────────────────── history ───────────────────────── */

function renderHistory() {
  const plan = activePlan();
  const today = dayNumber(Date.now());
  dom.historyTitle.textContent = planName(plan);

  const rows = [
    { key: KEYS.historyToday, ...since(plan, today) },
    { key: KEYS.historyWeek, ...since(plan, today - (WEEK_DAYS - 1)) },
    { key: KEYS.historyAll, ...since(plan, -Infinity) },
  ];
  dom.historySummary.replaceChildren(...rows.map((row) => {
    const node = cloneTemplate(dom.tplSummary);
    part(node, PART.label).textContent = t(row.key);
    part(node, PART.count).textContent = i18n.plural(KEYS.historyTimes, row.count);
    part(node, PART.amount).textContent = i18n.money(row.total);
    return node;
  }));

  const recent = plan.entries.slice(-ui.historyLimit).reverse();
  dom.historyEmpty.hidden = recent.length > 0;
  const days = [];
  recent.forEach((entry) => {
    const day = dayNumber(entry.at);
    if (!days.length || days[days.length - 1].day !== day) days.push({ day, at: entry.at, entries: [] });
    days[days.length - 1].entries.push(entry);
  });
  dom.historyList.replaceChildren(...days.map(({ at, entries }) => {
    const node = cloneTemplate(dom.tplDay);
    part(node, PART.label).textContent = i18n.dayLabel(at);
    part(node, PART.total).textContent = i18n.money(entries.reduce((sum, e) => sum + e.amount, 0));
    part(node, PART.rows).replaceChildren(...entries.map((entry) => {
      const row = cloneTemplate(dom.tplRow);
      const time = part(row, PART.time);
      time.textContent = i18n.time(entry.at);
      time.dateTime = new Date(entry.at).toISOString();
      part(row, PART.size).textContent = sizeLabel(entry.size);
      part(row, PART.amount).textContent = i18n.money(entry.amount);
      const remove = part(row, PART.remove);
      remove.dataset[DATA.entry] = entry.id;
      remove.setAttribute(ATTR.label, t(KEYS.historyRemove, { time: i18n.time(entry.at) }));
      return row;
    }));
    return node;
  }));
  dom.historyMore.hidden = plan.entries.length <= ui.historyLimit;

  dom.historyRounds.hidden = !plan.rounds.length;
  dom.historyRoundsList.replaceChildren(...[...plan.rounds].reverse().map((round) => {
    const node = cloneTemplate(dom.tplRound);
    part(node, PART.dates).textContent = t(KEYS.historyRound, { from: i18n.dateLabel(round.from), to: i18n.dateLabel(round.to) });
    part(node, PART.count).textContent = i18n.plural(KEYS.historyTimes, round.count);
    part(node, PART.total).textContent = i18n.money(round.total);
    return node;
  }));
}

/* ───────────────────────── state changes ───────────────────────── */

store.subscribe((type, detail) => {
  if (type === STORE_EVENT.ERROR) {
    toast(t(KEYS.toastSaveFailed));
    return;
  }
  const { reason } = detail;
  if (reason === REASON.ENTRY_ADDED) ui.inFlight.set(detail.entry.id, { planId: detail.planId, amount: detail.entry.amount });
  if (reason === REASON.ENTRY_REMOVED) ui.inFlight.delete(detail.entry.id);
  if (reason === REASON.PLAN_DELETED) ui.gilded.delete(detail.planId);
  if (reason === REASON.IMPORTED || reason === REASON.EXTERNAL) {
    dropAllFlights();
    ui.gilded.clear();
  }
  if (reason === REASON.SETTINGS || reason === REASON.IMPORTED || reason === REASON.EXTERNAL) {
    applyLocale();
    sound.setEnabled(state().settings.sound);
  }
  if (reason === REASON.ACTIVE || reason === REASON.PLAN_CREATED) stage.nudge();
  renderAll({ animate: reason !== REASON.SETTINGS });
});

/* ───────────────────────── events ───────────────────────── */

dom.pig.addEventListener(EV.click, dropNo);
dom.pig.addEventListener(EV.contextmenu, (event) => event.preventDefault());

dom.plans.addEventListener(EV.click, (event) => {
  const tab = event.target.closest(SEL.tab);
  if (!tab) return;
  if (DATA.add in tab.dataset) {
    if (state().plans.length >= CONFIG.limits.plans) toast(t(KEYS.toastLimit, { n: i18n.number(CONFIG.limits.plans) }));
    else openEditor(null);
    return;
  }
  const id = tab.dataset[DATA.plan];
  if (id === state().activePlanId) openEditor(activePlan());
  else store.setActive(id);
});

dom.sizes.addEventListener(EV.change, (event) => {
  if (event.target.name !== GROUP.size) return;
  sound.unlock();
  sound.play(SOUND.TICK);
  haptic(CONFIG.haptics.select);
  store.setSize(activePlan().id, event.target.value);
});

dom.toastAction.addEventListener(EV.click, () => {
  const run = ui.toastRun;
  hideToast();
  run?.();
});

dom.openSettings.addEventListener(EV.click, () => { renderSettings(); openSheet(dom.settings); });
dom.openHistory.addEventListener(EV.click, () => {
  ui.historyLimit = CONFIG.limits.historyPage;
  renderHistory();
  openSheet(dom.history);
});
dom.historyMore.addEventListener(EV.click, () => {
  ui.historyLimit += CONFIG.limits.historyPage;
  renderHistory();
});
dom.historyList.addEventListener(EV.click, (event) => {
  const button = event.target.closest(SEL.removeEntry);
  if (!button) return;
  const id = button.dataset[DATA.entry];
  ui.flights.get(id)?.();
  ui.flights.delete(id);
  if (store.removeEntry(activePlan().id, id)) sound.play(SOUND.UNDO);
});

dom.editorForm.addEventListener(EV.submit, (event) => {
  event.preventDefault();
  const fields = readEditor();
  if (ui.editing) store.updatePlan(ui.editing, fields);
  else if (!store.createPlan(fields)) toast(t(KEYS.toastLimit, { n: i18n.number(CONFIG.limits.plans) }));
  closeSheet(dom.editor);
});

dom.editorBreak.addEventListener(EV.click, async () => {
  const plan = store.plan(ui.editing);
  if (!plan || !plan.entries.length) return;
  const ok = await confirmDialog({
    title: t(KEYS.confirmBreakTitle),
    body: t(KEYS.confirmBreakBody, { amount: i18n.money(balanceOf(plan)) }),
    ok: t(KEYS.confirmBreakOk),
    danger: true,
  });
  if (!ok) return;
  await closeSheet(dom.editor);
  if (plan.id !== state().activePlanId) store.setActive(plan.id);
  breakPlan(store.plan(plan.id));
});

dom.editorDelete.addEventListener(EV.click, async () => {
  const plan = store.plan(ui.editing);
  if (!plan) return;
  const name = planName(plan);
  const ok = await confirmDialog({
    title: t(KEYS.confirmDeleteTitle, { plan: name }),
    body: t(KEYS.confirmDeleteBody),
    ok: t(KEYS.confirmDeleteOk),
    danger: true,
  });
  if (!ok) return;
  await closeSheet(dom.editor);
  dropFlightsOf(plan.id);
  store.deletePlan(plan.id);
  toast(t(KEYS.toastDeleted, { plan: name }));
});

dom.settingsLocales.addEventListener(EV.change, (event) => store.setSettings({ locale: event.target.value }));
dom.settingsCurrencies.addEventListener(EV.change, (event) => store.setSettings({ currency: event.target.value }));
dom.settingsSound.addEventListener(EV.change, () => {
  store.setSettings({ sound: dom.settingsSound.checked });
  if (dom.settingsSound.checked) { sound.unlock(); sound.play(SOUND.TICK); }
});
dom.settingsExport.addEventListener(EV.click, exportBackup);
dom.settingsImport.addEventListener(EV.click, () => dom.importFile.click());
dom.importFile.addEventListener(EV.change, () => {
  const [file] = dom.importFile.files;
  dom.importFile.value = '';
  if (file) importBackup(file);
});

// Every sheet closes with its × button, a tap on the backdrop, or Escape — always animated.
[dom.editor, dom.settings, dom.history, dom.confirm].forEach((dialog) => {
  dialog.addEventListener(EV.click, (event) => {
    if (event.target === dialog || event.target.closest(SEL.close)) closeSheet(dialog);
  });
  dialog.addEventListener(EV.cancel, (event) => {
    event.preventDefault();
    closeSheet(dialog);
  });
});

document.addEventListener(EV.keydown, (event) => {
  if (document.querySelector(SEL.openDialog) || event.target.closest?.(SEL.typing)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === SHORTCUT.undo) {
    event.preventDefault();
    undoLast();
    return;
  }
  const n = Number(event.key);
  if (Number.isInteger(n) && n >= 1 && n <= CONFIG.sizes.length) store.setSize(activePlan().id, CONFIG.sizes[n - 1].id);
});

// iOS only shows :active press states once the page listens for touches.
document.addEventListener(EV.touchstart, () => {}, { passive: true });

// Back after midnight: today's count starts over.
document.addEventListener(EV.visibility, () => { if (!document.hidden) renderToday(); });

/* ───────────────────────── start ───────────────────────── */

dom.defs.innerHTML = `<defs>${moneyDefs(CONFIG.tones)}</defs>`;
sound.setEnabled(state().settings.sound);
applyLocale();
renderAll({ animate: false });
navigator.serviceWorker?.register(CONFIG.serviceWorker).catch(() => {});
