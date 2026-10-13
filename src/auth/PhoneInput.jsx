import { useRef, useLayoutEffect } from "react";

// Live-formatting phone field. The grouping is an accessibility aid (parens and dashes let a
// dyslexic reader count digits and spot a missing/doubled/swapped one), not decoration.
//   US:            (401) 651-4117     — formatted as you type; a leading 1 is dropped
//   international: +5511999990000     — anything starting with "+" is left to the Worker's normalizePhone
// The value the parent receives is the DISPLAYED string; the Worker strips the punctuation itself.

const digitsOf = (s) => s.replace(/\D/g, "");

export const formatPhone = (raw) => {
  if (raw.trimStart().startsWith("+")) return "+" + digitsOf(raw).slice(0, 15);
  let d = digitsOf(raw);
  if (d.length > 10 && d[0] === "1") d = d.slice(1); // pasted "1 401 651 4117"
  d = d.slice(0, 10);
  if (d.length === 0) return "";
  if (d.length <= 3) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

// Index in `formatted` just after its n-th digit (so the caret stays beside the digit being edited).
export const caretAfterDigits = (formatted, n) => {
  const start = formatted.startsWith("+") ? 1 : 0;
  if (n <= 0) return start;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === n) return i + 1;
  }
  return formatted.length;
};

export default function PhoneInput({ value, onChange, ...rest }) {
  const ref = useRef(null);
  const caretDigits = useRef(null);

  const handle = (e) => {
    const raw = e.target.value;
    const pos = e.target.selectionStart ?? raw.length;
    let digitsBefore = digitsOf(raw.slice(0, pos)).length;
    let next = raw;
    const type = e.nativeEvent && e.nativeEvent.inputType;
    // Backspace/Delete over a separator "(", ")", " " or "-" removes no digit, so reformatting would
    // put it straight back and the key would seem dead. Remove the neighbouring digit instead.
    if ((type === "deleteContentBackward" || type === "deleteContentForward") && digitsOf(raw).length === digitsOf(value).length) {
      const all = digitsOf(raw);
      const at = type === "deleteContentBackward" ? digitsBefore - 1 : digitsBefore;
      if (at >= 0 && at < all.length) {
        next = (value.startsWith("+") ? "+" : "") + all.slice(0, at) + all.slice(at + 1);
        digitsBefore = at;
      }
    }
    caretDigits.current = digitsBefore;
    onChange(formatPhone(next));
  };

  // After React writes the new value, put the caret back beside the digit being edited.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && caretDigits.current !== null && document.activeElement === el) {
      const p = caretAfterDigits(value, caretDigits.current);
      el.setSelectionRange(p, p);
    }
    caretDigits.current = null;
  }, [value]);

  return <input ref={ref} type="tel" inputMode="tel" autoComplete="tel" value={value} onChange={handle} {...rest} />;
}
