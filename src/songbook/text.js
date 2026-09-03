// Pure text helpers: accent folding, normalization, language + title parsing.

export const fold = (s) => String(s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export const normalize = (s) => fold(s).replace(/[^a-z0-9]+/g, " ").trim();
export const tokens = (s) => normalize(s).split(" ").filter(Boolean);

// A line is "all caps" when it has letters and none of them are lowercase.
export const isAllCaps = (s) => /\p{Lu}/u.test(s) && !/\p{Ll}/u.test(s);

const PT_WORDS = new Set(["e", "o", "a", "que", "de", "do", "da", "em", "nao", "e", "meu", "minha", "deus", "senhor", "tu", "es", "nos", "por", "com", "ao", "os", "as", "teu", "tua", "seu", "sua", "para", "pra", "um", "uma", "me", "se", "ele", "eu", "voce", "vem", "sou", "esta", "ha", "sempre", "santo", "jesus", "amor", "rei", "quem"]);
const EN_WORDS = new Set(["the", "and", "you", "your", "is", "of", "in", "my", "i", "we", "god", "lord", "to", "are", "me", "our", "all", "will", "for", "with", "on", "it", "not", "be", "this", "that", "have", "holy", "forever", "heaven", "king", "who", "what", "as", "here"]);

// Stopword vote. Returns "pt", "en" or null when there is nothing to go on.
export const langOfText = (s) => {
  const raw = String(s || "");
  const hasPtDiacritics = /[ãõçáéíóúâêôà]/i.test(raw);
  let pt = hasPtDiacritics ? 2 : 0, en = 0;
  for (const t of tokens(raw)) { if (PT_WORDS.has(t)) pt++; if (EN_WORDS.has(t)) en++; }
  if (pt === en) return null;
  return pt > en ? "pt" : "en";
};

// "House of the Lord (Casa do Pai) EN" -> primary + alternates + flags.
export const parseTitle = (raw) => {
  let t = String(raw || "").trim();
  let enMarker = false;
  if (/\s+EN$/.test(t)) { enMarker = true; t = t.replace(/\s+EN$/, ""); }
  if (/\s*-\s*English$/i.test(t)) { enMarker = true; t = t.replace(/\s*-\s*English$/i, ""); }
  const alts = [];
  const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(t);
  let primary = t;
  if (m) {
    primary = m[1].trim();
    m[2].split("/").map((x) => x.trim()).filter((x) => x && !/^medley$/i.test(x)).forEach((x) => alts.push(x));
  }
  return { primary, alts, enMarker };
};

// Planning Center titles carry a trailing leader name: "Teu Toque - Kenia ".
export const stripLeader = (title) => String(title || "").replace(/\s*-\s*[^-()]*$/u, (m, off, str) => {
  // Only strip when what follows the dash looks like a short name (1-3 words, no digits).
  const tail = m.replace(/^\s*-\s*/, "").trim();
  return tail && tail.split(/\s+/).length <= 3 && !/\d/.test(tail) ? "" : m;
}).trim();
