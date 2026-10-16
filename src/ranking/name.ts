import { NG_WORDS } from "./ng-words";

export type NameCheck =
  { ok: true; name: string } | { ok: false; error: "length" | "chars" | "ng" };

/** いまのところの初期表示名 */
export const DEFAULT_NAME = "名無しさん";

const MIN_LENGTH = 1;
const MAX_LENGTH = 10;
/** 文字(`\p{L}`)、数字(`\p{N}`)、`ー`、`・`、`_`、`-` だけ使える */
const NAME_CHARS = /[\p{L}\p{N}ー・_-]/u;
const KATAKANA_FROM = 0x30a1; // ァ
const KATAKANA_TO = 0x30f6; // ヶ
const KATAKANA_HIRAGANA_GAP = 0x60;
const SEPARATORS = new Set(["ー", "・", "_", "-"]);

/** 照合用の文字列。英字は小文字、カタカナはひらがなにし、区切りの記号は取り除く */
function collationKey(name: string): string {
  let key = "";
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0;
    const isKatakana = code >= KATAKANA_FROM && code <= KATAKANA_TO;
    const converted = String.fromCodePoint(isKatakana ? code - KATAKANA_HIRAGANA_GAP : code);
    const lowered = converted.toLowerCase();
    if (SEPARATORS.has(lowered)) continue;
    key += lowered;
  }
  return key;
}

/** ニックネームを正規化して確かめる */
export function checkName(raw: string): NameCheck {
  const name = raw.normalize("NFKC").trim();
  const characters = [...name];
  if (characters.length < MIN_LENGTH || characters.length > MAX_LENGTH) {
    return { ok: false, error: "length" };
  }
  for (const character of characters) {
    if (!NAME_CHARS.test(character)) return { ok: false, error: "chars" };
  }
  const key = collationKey(name);
  for (const word of NG_WORDS) {
    if (key.includes(word)) return { ok: false, error: "ng" };
  }
  return { ok: true, name };
}
