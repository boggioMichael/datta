/* A tap you can feel. Android has the Vibration API and plays the whole pattern.
 * iPhone has no Vibration API, but since iOS 18 toggling a switch control gives a system
 * haptic tick — so a hidden switch is toggled from inside the tap that asked for it.
 * Anywhere else this does nothing. */

const TAG = Object.freeze({ label: 'label', input: 'input' });
const SWITCH = 'switch';
const CHECKBOX = 'checkbox';
const CLASS = 'haptic-switch';
const ATTR = Object.freeze({ hidden: 'aria-hidden', true: 'true' });

export function createHaptics() {
  const vibrate = typeof navigator.vibrate === 'function' ? (pattern) => navigator.vibrate(pattern) : null;
  let tick = null;
  if (!vibrate && globalThis.HTMLInputElement && SWITCH in HTMLInputElement.prototype) {
    const label = document.createElement(TAG.label);
    const input = document.createElement(TAG.input);
    input.type = CHECKBOX;
    input.setAttribute(SWITCH, '');
    input.tabIndex = -1;
    label.className = CLASS;
    label.setAttribute(ATTR.hidden, ATTR.true);
    label.append(input);
    document.body.append(label);
    tick = () => {
      const focused = document.activeElement;
      label.click();
      focused?.focus?.({ preventScroll: true }); // the switch must not keep the focus
    };
  }
  /** Play a vibration pattern (ms), or a single tick where only that exists. */
  return (pattern) => {
    try {
      if (vibrate) vibrate(pattern);
      else tick?.();
    } catch { /* no haptics here */ }
  };
}
