/* קופת הלא · The No Bank — the page controller.
 * Tap the pig every time you say no to yourself: the chosen size of "no" flies in as a
 * coin, a bill or a gold bar, and the register rolls. Several banks, each its own pig.
 * Banks can be shown to everyone; anyone can look at the banks others chose to show. */

import { CONFIG, SOUND, VISIBILITY } from './config.js';
import { STRINGS, KEYS } from './strings.js';
import { createI18n, dayNumber } from './i18n.js';
import { createStore, STORE_EVENT, REASON, BackupError, balanceOf, sizeById, glazeById } from './store.js';
import { createRegister } from './register.js';
import { createParticles } from './fx.js';
import { createSound } from './sound.js';
import { createStage } from './stage.js';
import { moneyMarkup, moneyDefs } from './art.js';
import { createHaptics } from './haptics.js';
import { createCloud, CLOUD } from './cloud.js';
import { createReport } from './report.js';

/* ───────────────────────── names used in index.html ───────────────────────── */

const ID = Object.freeze({
  plans: 'plans', openPeople: 'open-people', cloudDot: 'cloud-dot', openSettings: 'open-settings',
  viewing: 'viewing', viewingName: 'viewing-name', viewingLive: 'viewing-live', viewingExit: 'viewing-exit',
  register: 'register', goal: 'goal', goalFill: 'goal-fill', goalCaption: 'goal-caption',
  stage: 'stage', rosette: 'rosette', pig: 'pig', pigShadow: 'pig-shadow', pigJump: 'pig-jump', pigSquash: 'pig-squash', pigFat: 'pig-fat', pigArt: 'pig-art',
  toast: 'toast', toastText: 'toast-text', toastAction: 'toast-action',
  today: 'today', sizes: 'sizes', openHistory: 'open-history',
  clip: 'drop-clip', floatLayer: 'float-layer', fx: 'fx', defs: 'defs', download: 'download', importFile: 'import-file',
  editor: 'editor', editorForm: 'editor-form', editorTitle: 'editor-title', editorName: 'editor-name', editorGlazes: 'editor-glazes',
  editorVisibility: 'editor-visibility', editorVisibilityHint: 'editor-visibility-hint',
  editorGoal: 'editor-goal', editorAmounts: 'editor-amounts', editorSubmit: 'editor-submit', editorDanger: 'editor-danger',
  editorBreak: 'editor-break', editorDelete: 'editor-delete',
  settings: 'settings', settingsLocales: 'settings-locales', settingsSound: 'settings-sound', settingsCurrencies: 'settings-currencies',
  settingsExport: 'settings-export', settingsImport: 'settings-import',
  accountCopy: 'account-copy', accountUse: 'account-use', accountEntry: 'account-entry', accountKey: 'account-key', accountApply: 'account-apply',
  people: 'people', profileName: 'profile-name', profileStatus: 'profile-status', profileShare: 'profile-share',
  peopleEmpty: 'people-empty', peopleList: 'people-list',
  history: 'history', historyTitle: 'history-title', historySummary: 'history-summary', historyEmpty: 'history-empty',
  historyList: 'history-list', historyMore: 'history-more', historyRounds: 'history-rounds', historyRoundsList: 'history-rounds-list',
  report: 'report',
  confirm: 'confirm', confirmTitle: 'confirm-title', confirmBody: 'confirm-body', confirmOk: 'confirm-ok',
  tplTab: 'tpl-tab', tplAdd: 'tpl-add', tplSize: 'tpl-size', tplGlaze: 'tpl-glaze', tplAmount: 'tpl-amount', tplSegment: 'tpl-segment',
  tplSummary: 'tpl-summary', tplDay: 'tpl-day', tplRow: 'tpl-row', tplRound: 'tpl-round', tplPerson: 'tpl-person',
});
const PART = Object.freeze({
  dot: 'dot', name: 'name', edit: 'edit', input: 'input', money: 'money', amount: 'amount', swatch: 'swatch', symbol: 'symbol',
  label: 'label', count: 'count', total: 'total', rows: 'rows', time: 'time', size: 'size', remove: 'remove', dates: 'dates',
  live: 'live', meta: 'meta', button: 'button',
});
const CLS = Object.freeze({
  selected: 'is-selected', closing: 'is-closing', danger: 'is-danger', shown: 'is-shown', symbolAfter: 'is-symbol-after',
  viewing: 'is-viewing', online: 'is-online',
});
const SEL = Object.freeze({
  tab: '[data-plan], [data-add], [data-view-bank]',
  close: '[data-close]',
  currencySymbol: '[data-currency-symbol]',
  moneyInput: '.money-input',
  amountInput: 'input[data-size]',
  removeEntry: '[data-entry]',
  person: '[data-person]',
  openDialog: 'dialog[open]',
  typing: 'input, textarea, select',
});
const DATA = Object.freeze({ plan: 'plan', add: 'add', size: 'size', entry: 'entry', viewBank: 'viewBank', person: 'person' });
const ATTR = Object.freeze({ label: 'aria-label', current: 'aria-current', title: 'title', lang: 'lang', hidden: 'hidden' });
const GROUP = Object.freeze({ size: 'size', glaze: 'glaze', locale: 'locale', currency: 'currency', visibility: 'visibility' });
const VAR = Object.freeze({ dot: '--dot', iconWidth: '--w', columns: '--n', glazeLight: '--g-light', glazeBase: '--g-base', glazeDark: '--g-dark' });
const EV = Object.freeze({
  click: 'click', change: 'change', submit: 'submit', keydown: 'keydown', cancel: 'cancel', close: 'close',
  animationend: 'animationend', contextmenu: 'contextmenu', visibility: 'visibilitychange', touchstart: 'touchstart', hashchange: 'hashchange',
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
const SHORT_ID = 4;
const LIVE_GAP_MS = 260;
const LIVE_LEVEL = 0.6;

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
const cloud = createCloud({ store });
const report = createReport({ root: dom.report, i18n, keys: KEYS, ...CONFIG.report });

const ui = {
  /** Entries whose money is still in the air: not on the register yet. id → { planId, amount } */
  inFlight: new Map(),
  /** Cancel functions of flights, so undo can stop a coin mid-air. id → cancel() */
  flights: new Map(),
  /** Whether each bank's pig was gold the last time it was shown (celebrate the change only). */
  gilded: new Map(),
  /** Someone else's banks, while looking at them: { id, name, banks, bankId, incoming, timer }. */
  view: null,
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
const viewing = () => ui.view !== null;
const shownBanks = () => (viewing() ? ui.view.banks : state().plans);
const shownPlan = () => (viewing() ? ui.view.banks.find((b) => b.id === ui.view.bankId) ?? ui.view.banks[0] : activePlan());
const planName = (plan) => plan.name || t(KEYS.planFallback, { n: i18n.number(shownBanks().findIndex((p) => p.id === plan.id) + 1) });
const personName = (person) => person.name || t(KEYS.peopleFallback, { id: person.id.slice(0, SHORT_ID) });
const sizeLabel = (id) => t(KEYS.sizePrefix + id);
const pendingFor = (planId) => [...ui.inFlight.values()].reduce((sum, f) => (f.planId === planId ? sum + f.amount : sum), 0);
const shownBalance = (plan) => balanceOf(plan) - (viewing() ? ui.view.incoming : pendingFor(plan.id));
const lookFor = (size, amount) => ({ tone: size.tone, colors: CONFIG.tones[size.tone], mark: t(KEYS.coinMark), value: i18n.number(amount) });
const showerLook = () => ({ tone: CONFIG.showerTone, colors: CONFIG.tones[CONFIG.showerTone], mark: t(KEYS.coinMark), value: '' });
const shareLink = (id) => `${CONFIG.site.url}#${CONFIG.cloud.shareParam}=${encodeURIComponent(id)}`;
const sharedId = () => new URLSearchParams(location.hash.slice(1)).get(CONFIG.cloud.shareParam);

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
  ui.signatures = {};
}

function renderTabs() {
  const banks = shownBanks();
  const current = shownPlan();
  const signature = JSON.stringify([i18n.locale, viewing(), current.id, banks.map((p) => [p.id, p.name, p.glaze])]);
  if (ui.signatures.tabs === signature) return;
  ui.signatures.tabs = signature;
  const tabs = banks.map((plan) => {
    const node = cloneTemplate(dom.tplTab);
    const isCurrent = plan.id === current.id;
    node.dataset[viewing() ? DATA.viewBank : DATA.plan] = plan.id;
    node.setAttribute(ATTR.current, String(isCurrent));
    node.setAttribute(ATTR.label, isCurrent && !viewing() ? t(KEYS.planEdit, { plan: planName(plan) }) : planName(plan));
    part(node, PART.dot).style.setProperty(VAR.dot, glazeById(plan.glaze).base);
    part(node, PART.name).textContent = planName(plan);
    part(node, PART.edit).toggleAttribute(ATTR.hidden, !isCurrent || viewing());
    return node;
  });
  dom.plans.replaceChildren(...tabs, ...(viewing() ? [] : [cloneTemplate(dom.tplAdd)]));
  dom.plans.querySelector(`[${ATTR.current}="${String(true)}"]`)?.scrollIntoView(SCROLL_NEAREST);
}

function renderSizes() {
  dom.sizes.hidden = viewing();
  if (viewing()) return;
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
  const plan = shownPlan();
  const shown = shownBalance(plan);
  register.set(shown, { animate });
  renderGoal(plan, shown);
  renderPig(plan, shown, { celebrate: animate });
  dom.pig.setAttribute(ATTR.label, viewing()
    ? t(KEYS.viewPig, { plan: planName(plan) })
    : t(KEYS.pigTap, { amount: i18n.money(plan.amounts[plan.size]), plan: planName(plan) }));
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
    sound.play(SOUND.GOAL, { level: viewing() ? LIVE_LEVEL : 1 });
    if (!viewing()) {
      haptic(CONFIG.haptics.goal);
      toast(t(KEYS.toastGoal));
    }
  }
}

function renderToday() {
  const plan = shownPlan();
  const { count } = since(plan, dayNumber(Date.now()));
  if (viewing()) dom.today.textContent = count ? i18n.plural(KEYS.viewToday, count) : t(KEYS.viewNone);
  else if (count) dom.today.textContent = i18n.plural(KEYS.todayCount, count);
  else dom.today.textContent = t(plan.entries.length || plan.rounds.length ? KEYS.todayNone : KEYS.todayFirst);
}

function renderViewing() {
  document.body.classList.toggle(CLS.viewing, viewing());
  dom.viewing.hidden = !viewing();
  if (!viewing()) return;
  dom.viewingName.textContent = t(KEYS.viewTitle, { name: personName(ui.view) });
  const last = Math.max(0, ...ui.view.banks.map((b) => (b.entries.length ? b.entries[b.entries.length - 1].at : 0)));
  dom.viewingLive.hidden = Date.now() - last > CONFIG.cloud.liveWithinMs;
}

function renderCloud() {
  dom.cloudDot.hidden = cloud.status !== CLOUD.ONLINE;
  if (dom.people.open) renderProfile();
}

function renderAll({ animate = true } = {}) {
  renderViewing();
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
  if (viewing()) { stage.nudge(); return; } // someone else's bank: look, don't touch
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
      if (!viewing() && activePlan().id === plan.id) renderVault();
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

/* ───────────────────────── looking at someone's banks ───────────────────────── */

/** Money that arrived since the last look flies in, a few coins at a time. */
function playIncoming(bank, fresh) {
  if (document.hidden) return; // nobody is watching: the register already shows the total
  const shown = fresh.slice(-CONFIG.cloud.liveDrops);
  ui.view.incoming = shown.reduce((sum, e) => sum + e.amount, 0);
  renderVault();
  shown.forEach((entry, i) => setTimeout(() => {
    if (!viewing() || shownPlan().id !== bank.id) return;
    const size = sizeById(entry.size);
    stage.drop(size, lookFor(size, entry.amount), {
      showerLook: showerLook(),
      onEnter: () => {
        if (!viewing()) return;
        sound.play(size.sound, { level: LIVE_LEVEL });
        stage.react(size);
        stage.sparkle(size);
        stage.float(i18n.signed(entry.amount));
        ui.view.incoming = Math.max(0, ui.view.incoming - entry.amount);
        renderVault();
        renderToday();
      },
      onShowerCoin: () => sound.play(SOUND.TINK, { level: LIVE_LEVEL / 2 }),
    });
  }, i * LIVE_GAP_MS));
}

async function refreshView() {
  if (!viewing()) return;
  const { id } = ui.view;
  let person;
  try { person = await cloud.person(id); } catch { return; }
  if (!viewing() || ui.view.id !== id) return;
  const before = shownPlan();
  ui.view = { ...ui.view, name: person.name, banks: person.banks };
  if (!person.banks.some((b) => b.id === ui.view.bankId)) ui.view.bankId = person.banks[0].id;
  const after = shownPlan();
  const known = new Set(before.entries.map((e) => e.id));
  const fresh = after.id === before.id ? after.entries.filter((e) => !known.has(e.id)) : [];
  renderAll();
  if (fresh.length) playIncoming(after, fresh);
}

async function openPerson(id) {
  let person;
  try {
    person = await cloud.person(id);
  } catch {
    toast(t(cloud.status === CLOUD.ONLINE ? KEYS.toastPersonMissing : KEYS.toastOffline));
    return;
  }
  if (person.id === cloud.me.id) { exitView(); return; }
  clearInterval(ui.view?.timer);
  ui.view = { id: person.id, name: person.name, banks: person.banks, bankId: person.banks[0].id, incoming: 0, timer: setInterval(refreshView, CONFIG.cloud.watchMs) };
  history.replaceState(null, '', `#${CONFIG.cloud.shareParam}=${encodeURIComponent(person.id)}`);
  stage.nudge();
  renderAll();
}

function exitView() {
  if (!viewing()) return;
  clearInterval(ui.view.timer);
  ui.view = null;
  history.replaceState(null, '', location.pathname + location.search);
  stage.nudge();
  renderAll();
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

async function shareOrCopy(text, copiedKey) {
  if (matchMedia(POINTER_COARSE).matches && navigator.share) {
    try { await navigator.share({ url: text }); return; } catch (error) { if (error?.name === ABORT) return; }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(t(copiedKey));
  } catch {
    window.prompt('', text);
  }
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

function renderVisibility(selected) {
  renderSegmented(dom.editorVisibility, GROUP.visibility, Object.values(VISIBILITY).map((value) => ({ value, label: t(KEYS.visibilityPrefix + value) })), selected);
  dom.editorVisibilityHint.textContent = t(KEYS.visibilityPrefix + selected + KEYS.hintSuffix);
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
    visibility: CONFIG.defaultVisibility,
    amounts: Object.fromEntries(CONFIG.sizes.map((s) => [s.id, s.amount])),
  };
  dom.editorTitle.textContent = t(plan ? KEYS.editorEdit : KEYS.editorNew);
  dom.editorSubmit.textContent = t(plan ? KEYS.editorSave : KEYS.editorCreate);
  dom.editorName.value = source.name;
  dom.editorName.maxLength = CONFIG.limits.nameLength;
  dom.editorGoal.max = CONFIG.limits.goalMax;
  dom.editorGoal.value = source.goal > 0 ? source.goal : '';
  renderGlazes(source.glaze);
  renderVisibility(source.visibility);
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
    visibility: dom.editorForm.elements[GROUP.visibility]?.value,
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

async function useAccountKey() {
  const key = dom.accountKey.value;
  if (!cloud.isKey(key)) { toast(t(KEYS.toastKeyInvalid)); return; }
  const ok = await confirmDialog({ title: t(KEYS.confirmKeyTitle), body: t(KEYS.confirmKeyBody), ok: t(KEYS.confirmKeyOk), danger: true });
  if (!ok) return;
  exitView();
  dropAllFlights();
  ui.gilded.clear();
  await cloud.useKey(key);
  dom.accountKey.value = '';
  dom.accountEntry.hidden = true;
  await closeSheet(dom.settings);
  toast(t(cloud.status === CLOUD.ONLINE ? KEYS.toastKeyUsed : KEYS.toastOffline));
}

/* ───────────────────────── people ───────────────────────── */

const STATUS_KEY = Object.freeze({ [CLOUD.ONLINE]: KEYS.profileOnline, [CLOUD.OFFLINE]: KEYS.profileOffline, [CLOUD.CONNECTING]: KEYS.profileConnecting });

function renderProfile() {
  const online = cloud.status === CLOUD.ONLINE;
  if (document.activeElement !== dom.profileName) dom.profileName.value = cloud.me.name;
  dom.profileName.disabled = !online;
  dom.profileShare.disabled = !online || !cloud.me.id;
  dom.profileStatus.textContent = t(STATUS_KEY[cloud.status]);
}

async function renderPeople() {
  dom.peopleList.replaceChildren();
  if (cloud.status !== CLOUD.ONLINE) {
    dom.peopleEmpty.hidden = false;
    dom.peopleEmpty.textContent = t(KEYS.peopleOffline);
    return;
  }
  dom.peopleEmpty.hidden = false;
  dom.peopleEmpty.textContent = t(KEYS.peopleLoading);
  let people;
  try {
    people = (await cloud.people()).filter((person) => person.id !== cloud.me.id);
  } catch {
    dom.peopleEmpty.textContent = t(KEYS.peopleOffline);
    return;
  }
  dom.peopleEmpty.hidden = people.length > 0;
  dom.peopleEmpty.textContent = t(KEYS.peopleEmpty);
  dom.peopleList.replaceChildren(...people.map((person) => {
    const node = cloneTemplate(dom.tplPerson);
    part(node, PART.button).dataset[DATA.person] = person.id;
    part(node, PART.live).hidden = Date.now() - person.lastAt > CONFIG.cloud.liveWithinMs;
    part(node, PART.name).textContent = personName(person);
    part(node, PART.meta).textContent = i18n.plural(KEYS.peopleMeta, person.banks, { seen: i18n.ago(person.lastAt) });
    part(node, PART.total).textContent = i18n.money(person.total);
    return node;
  }));
}

function openPeople() {
  renderProfile();
  openSheet(dom.people);
  renderPeople();
}

async function saveName() {
  const name = dom.profileName.value;
  if (name.trim() === cloud.me.name) return;
  try {
    await cloud.setName(name);
    toast(t(KEYS.toastNameSaved));
  } catch {
    toast(t(KEYS.toastOffline));
  }
}

/* ───────────────────────── history and the daily report ───────────────────────── */

function renderHistory() {
  const plan = shownPlan();
  const today = dayNumber(Date.now());
  dom.historyTitle.textContent = viewing() ? `${personName(ui.view)}, ${planName(plan)}` : planName(plan);

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

  dom.report.hidden = !plan.entries.length;
  if (plan.entries.length) report.render(plan.entries, isRtl());

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
    part(node, PART.count).textContent = i18n.plural(KEYS.historyTimes, entries.length);
    part(node, PART.total).textContent = i18n.money(entries.reduce((sum, e) => sum + e.amount, 0));
    part(node, PART.rows).replaceChildren(...entries.map((entry) => {
      const row = cloneTemplate(dom.tplRow);
      const time = part(row, PART.time);
      time.textContent = i18n.time(entry.at);
      time.dateTime = new Date(entry.at).toISOString();
      part(row, PART.size).textContent = sizeLabel(entry.size);
      part(row, PART.amount).textContent = i18n.money(entry.amount);
      const remove = part(row, PART.remove);
      remove.hidden = viewing();
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
  if (reason === REASON.IMPORTED || reason === REASON.EXTERNAL || reason === REASON.REMOTE) {
    dropAllFlights();
    if (reason !== REASON.REMOTE) ui.gilded.clear();
  }
  if (reason === REASON.SETTINGS || reason === REASON.IMPORTED || reason === REASON.EXTERNAL) {
    applyLocale();
    sound.setEnabled(state().settings.sound);
  }
  if ((reason === REASON.ACTIVE || reason === REASON.PLAN_CREATED) && !viewing()) stage.nudge();
  renderAll({ animate: reason !== REASON.SETTINGS });
});

cloud.subscribe(renderCloud);

/* ───────────────────────── events ───────────────────────── */

dom.pig.addEventListener(EV.click, dropNo);
dom.pig.addEventListener(EV.contextmenu, (event) => event.preventDefault());

dom.plans.addEventListener(EV.click, (event) => {
  const tab = event.target.closest(SEL.tab);
  if (!tab) return;
  if (DATA.viewBank in tab.dataset) {
    ui.view.bankId = tab.dataset[DATA.viewBank];
    ui.view.incoming = 0;
    stage.nudge();
    renderAll();
    return;
  }
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

dom.viewingExit.addEventListener(EV.click, exitView);
dom.openPeople.addEventListener(EV.click, openPeople);
dom.profileName.addEventListener(EV.change, saveName);
dom.profileShare.addEventListener(EV.click, () => shareOrCopy(shareLink(cloud.me.id), KEYS.toastLinkCopied));
dom.peopleList.addEventListener(EV.click, async (event) => {
  const button = event.target.closest(SEL.person);
  if (!button) return;
  await closeSheet(dom.people);
  openPerson(button.dataset[DATA.person]);
});

dom.openSettings.addEventListener(EV.click, () => { renderSettings(); openSheet(dom.settings); });
dom.openHistory.addEventListener(EV.click, () => {
  ui.historyLimit = CONFIG.limits.historyPage;
  renderHistory();
  openSheet(dom.history);
  renderHistory(); // again, now that the sheet has a width for the chart
});
dom.historyMore.addEventListener(EV.click, () => {
  ui.historyLimit += CONFIG.limits.historyPage;
  renderHistory();
});
dom.historyList.addEventListener(EV.click, (event) => {
  const button = event.target.closest(SEL.removeEntry);
  if (!button || viewing()) return;
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
dom.editorVisibility.addEventListener(EV.change, (event) => {
  dom.editorVisibilityHint.textContent = t(KEYS.visibilityPrefix + event.target.value + KEYS.hintSuffix);
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
dom.accountCopy.addEventListener(EV.click, () => shareOrCopy(cloud.key, KEYS.toastKeyCopied));
dom.accountUse.addEventListener(EV.click, () => { dom.accountEntry.hidden = !dom.accountEntry.hidden; if (!dom.accountEntry.hidden) dom.accountKey.focus(); });
dom.accountApply.addEventListener(EV.click, useAccountKey);

// Every sheet closes with its × button, a tap on the backdrop, or Escape — always animated.
[dom.editor, dom.settings, dom.history, dom.people, dom.confirm].forEach((dialog) => {
  dialog.addEventListener(EV.click, (event) => {
    if (event.target === dialog || event.target.closest(SEL.close)) closeSheet(dialog);
  });
  dialog.addEventListener(EV.cancel, (event) => {
    event.preventDefault();
    closeSheet(dialog);
  });
});

document.addEventListener(EV.keydown, (event) => {
  if (document.querySelector(SEL.openDialog) || event.target.closest?.(SEL.typing) || viewing()) return;
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

// Back after midnight: today's count starts over; back online: sync again.
document.addEventListener(EV.visibility, () => {
  if (document.hidden) return;
  renderToday();
  if (cloud.status === CLOUD.OFFLINE) cloud.connect();
});

// A shared link opened while the page is already open.
window.addEventListener(EV.hashchange, () => {
  const id = sharedId();
  if (id && id !== ui.view?.id) openPerson(id);
});

/* ───────────────────────── start ───────────────────────── */

dom.defs.innerHTML = `<defs>${moneyDefs(CONFIG.tones)}</defs>`;
dom.profileName.maxLength = CONFIG.limits.nameLength;
sound.setEnabled(state().settings.sound);
applyLocale();
renderAll({ animate: false });
renderCloud();
navigator.serviceWorker?.register(CONFIG.serviceWorker).catch(() => {});
cloud.connect().then(() => {
  const id = sharedId();
  if (id) openPerson(id);
});
