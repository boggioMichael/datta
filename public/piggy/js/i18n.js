/* Translation and formatting. Words come from strings.js; numbers, money, dates,
 * language and currency names come from Intl, so nothing here is spelled by hand. */

const FIRST_STRONG_ISOLATE = '⁨';
const POP_ISOLATE = '⁩';
const PLACEHOLDER = /\{(\w+)\}/g;
const PLURAL_JOIN = '.';
const PLURAL_FALLBACK = 'other';
const ATTR_LIST = ';';
const ATTR_PAIR = ':';
const DAY_MS = 86400000;
const WEEK_DAYS = 7;
const DAY_UNIT = 'day';
const RELATIVE_UNITS = Object.freeze([['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]);
const PART = Object.freeze({ CURRENCY: 'currency', INTEGER: 'integer' });
const SELECTOR = Object.freeze({ text: '[data-i18n]', attr: '[data-i18n-attr]' });

/** Intl options for every format the page shows. */
const MONEY = Object.freeze({ style: 'currency', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const FORMAT = Object.freeze({
  number: { maximumFractionDigits: 0 },
  percent: { style: 'percent', maximumFractionDigits: 0 },
  signed: { signDisplay: 'exceptZero' },
  time: { hour: '2-digit', minute: '2-digit' },
  decimal: { maximumFractionDigits: 1 },
  days: { style: 'unit', unit: 'day', unitDisplay: 'long' },
  shortDay: { day: 'numeric', month: 'short', timeZone: 'UTC' },
  longDay: { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' },
  weekday: { weekday: 'long' },
  date: { day: 'numeric', month: 'long' },
  dateYear: { day: 'numeric', month: 'long', year: 'numeric' },
  relative: { numeric: 'auto' },
  currencyNames: { type: 'currency' },
  languageNames: { type: 'language' },
});

/** Local calendar day number of a timestamp (days since the epoch, in local time). */
export const dayNumber = (ts) => {
  const d = new Date(ts);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
};

export function createI18n({ strings, fallback }) {
  let locale = fallback;
  let currency = null;
  let fmt = null;

  const lookup = (key) => (strings[locale] && strings[locale][key]) ?? strings[fallback][key];

  /** t('key', { name: value }) — every value is bidi-isolated, so numbers and Latin names sit right in Hebrew. */
  function t(key, params) {
    const text = lookup(key);
    if (text == null) return key;
    if (!params) return text;
    return text.replace(PLACEHOLDER, (match, name) => (name in params ? FIRST_STRONG_ISOLATE + params[name] + POP_ISOLATE : match));
  }

  /** plural('today.count', 3) picks today.count.one / .two / .other for the active language. */
  function plural(key, n, params = {}) {
    const exact = key + PLURAL_JOIN + fmt.plural.select(n);
    const chosen = lookup(exact) != null ? exact : key + PLURAL_JOIN + PLURAL_FALLBACK;
    return t(chosen, { n: fmt.number.format(n), ...params });
  }

  function configure(nextLocale, nextCurrency) {
    locale = strings[nextLocale] ? nextLocale : fallback;
    currency = nextCurrency;
    const money = { ...MONEY, currency };
    fmt = {
      plural: new Intl.PluralRules(locale),
      number: new Intl.NumberFormat(locale, FORMAT.number),
      percent: new Intl.NumberFormat(locale, FORMAT.percent),
      money: new Intl.NumberFormat(locale, money),
      signed: new Intl.NumberFormat(locale, { ...money, ...FORMAT.signed }),
      time: new Intl.DateTimeFormat(locale, FORMAT.time),
      decimal: new Intl.NumberFormat(locale, FORMAT.decimal),
      days: new Intl.NumberFormat(locale, FORMAT.days),
      shortDay: new Intl.DateTimeFormat(locale, FORMAT.shortDay),
      longDay: new Intl.DateTimeFormat(locale, FORMAT.longDay),
      weekday: new Intl.DateTimeFormat(locale, FORMAT.weekday),
      date: new Intl.DateTimeFormat(locale, FORMAT.date),
      dateYear: new Intl.DateTimeFormat(locale, FORMAT.dateYear),
      relative: new Intl.RelativeTimeFormat(locale, FORMAT.relative),
      currencyNames: new Intl.DisplayNames([locale], FORMAT.currencyNames),
    };
  }

  const money = (amount) => fmt.money.format(amount);
  const signed = (amount) => fmt.signed.format(amount);
  const number = (n) => fmt.number.format(n);
  const percent = (fraction) => fmt.percent.format(fraction);
  const time = (ts) => fmt.time.format(ts);
  const decimal = (n) => fmt.decimal.format(n);
  const days = (n) => fmt.days.format(n);
  /** Dates of local day numbers (see dayNumber): the number is a UTC midnight, so format in UTC. */
  const shortDay = (day) => fmt.shortDay.format(day * DAY_MS);
  const longDay = (day) => fmt.longDay.format(day * DAY_MS);

  /** "5 minutes ago", "yesterday" … in the largest unit that fits. */
  function ago(ts, now = Date.now()) {
    const seconds = Math.round((ts - now) / 1000);
    for (const [unit, size] of RELATIVE_UNITS) {
      if (Math.abs(seconds) >= size || unit === RELATIVE_UNITS[RELATIVE_UNITS.length - 1][0]) return fmt.relative.format(Math.round(seconds / size), unit);
    }
    return '';
  }

  /** The currency symbol, and whether this language writes it before the number. */
  function currencyLayout() {
    const parts = fmt.money.formatToParts(1);
    const symbolAt = parts.findIndex((p) => p.type === PART.CURRENCY);
    const numberAt = parts.findIndex((p) => p.type === PART.INTEGER);
    return { symbol: parts[symbolAt].value, first: symbolAt < numberAt };
  }

  const currencySymbol = (code) =>
    new Intl.NumberFormat(locale, { ...MONEY, currency: code })
      .formatToParts(0)
      .find((p) => p.type === PART.CURRENCY).value;

  const currencyName = (code) => fmt.currencyNames.of(code);

  /** A language's name in that language: עברית, English. */
  const languageName = (id) => new Intl.DisplayNames([id], FORMAT.languageNames).of(id);

  /** "Today", "Yesterday", a weekday within the week, otherwise a date. */
  function dayLabel(ts, now = Date.now()) {
    const diff = dayNumber(ts) - dayNumber(now);
    if (diff > -2) return fmt.relative.format(diff, DAY_UNIT);
    if (diff > -WEEK_DAYS) return fmt.weekday.format(ts);
    return dateLabel(ts, now);
  }

  const dateLabel = (ts, now = Date.now()) =>
    (new Date(ts).getFullYear() === new Date(now).getFullYear() ? fmt.date : fmt.dateYear).format(ts);

  /** Fill [data-i18n] text and [data-i18n-attr="attr:key;attr:key"] attributes under root. */
  function apply(root) {
    root.querySelectorAll(SELECTOR.text).forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll(SELECTOR.attr).forEach((el) => {
      el.dataset.i18nAttr.split(ATTR_LIST).forEach((pair) => {
        const [attr, key] = pair.split(ATTR_PAIR);
        el.setAttribute(attr.trim(), t(key.trim()));
      });
    });
  }

  return {
    t, plural, configure, apply,
    money, signed, number, percent, time, dayLabel, dateLabel, decimal, days, shortDay, longDay, ago,
    currencyLayout, currencySymbol, currencyName, languageName,
    get locale() { return locale; },
    get currency() { return currency; },
  };
}
