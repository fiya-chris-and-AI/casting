import type { Messages } from "./locales";

export function translate(messages: Messages, fallback: Messages, key: string, vars?: Record<string, string | number>): string {
  let str = messages[key] ?? fallback[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

// "and"-joined list in the active locale, matching the demo script's mandated
// phrasing exactly (e.g. "I, III, IV and VI") — never "I to VI", never "all six types".
export function andJoin(items: string[], and: string): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} ${and} ${items[items.length - 1]}`;
}
