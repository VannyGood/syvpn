import axios from 'axios';
import net from 'node:net';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

function isPrivateHostname(hostname: string) {
  const h = hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  const ipVersion = net.isIP(hostname);
  if (!ipVersion) return false;

  const ip = hostname;
  if (ipVersion === 4) {
    const [a, b] = ip.split('.').map((x) => Number(x));
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  // IPv6
  if (ip === '::1') return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true; // unique local
  if (ip.startsWith('fe80:')) return true; // link-local
  return false;
}

function looksLikeBase64(s: string) {
  const t = s.trim();
  if (!t) return false;
  if (t.includes('://')) return false;
  if (t.length < 16) return false;
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(t)) return false;
  return true;
}

function decodeMaybeBase64(body: string): { decoded: string; wasBase64: boolean } {
  const t = body.trim();
  if (!looksLikeBase64(t)) return { decoded: body, wasBase64: false };
  try {
    const decoded = Buffer.from(t.replace(/\s+/g, ''), 'base64').toString('utf8');
    // Heuristic: decoded subscription should contain at least one URI scheme.
    if (decoded.includes('://')) return { decoded, wasBase64: true };
    return { decoded: body, wasBase64: false };
  } catch {
    return { decoded: body, wasBase64: false };
  }
}

const COUNTRY_ALIASES: Array<[RegExp, string]> = [
  // United States
  [/\b(us|usa|united[-\s_]?states|america|newyork|losangeles|dallas|miami|chicago)\b/i, 'us'],
  // United Kingdom
  [/\b(uk|u\.k\.|united[-\s_]?kingdom|london|manchester)\b/i, 'gb'],
  // Germany
  [/\b(de|ger|germany|deutschland|frankfurt|berlin|munich)\b/i, 'de'],
  // France
  [/\b(fr|france|paris)\b/i, 'fr'],
  // Netherlands
  [/\b(nl|netherlands|holland|amsterdam)\b/i, 'nl'],
  // Sweden / Norway / Finland / Denmark
  [/\b(se|sweden|stockholm)\b/i, 'se'],
  [/\b(no|norway|oslo)\b/i, 'no'],
  [/\b(fi|finland|helsinki)\b/i, 'fi'],
  [/\b(dk|denmark|copenhagen)\b/i, 'dk'],
  // Canada
  [/\b(ca|canada|toronto|montreal|vancouver)\b/i, 'ca'],
  // Russia
  [/\b(ru|russia|moscow|spb|saint[-\s_]?petersburg)\b/i, 'ru'],
  // Turkey
  [/\b(tr|turkey|istanbul)\b/i, 'tr'],
  // UAE
  [/\b(ae|uae|dubai|abu[-\s_]?dhabi)\b/i, 'ae'],
  // Iran (if you label nodes)
  [/\b(ir|iran|tehran)\b/i, 'ir'],
  // Singapore / Japan / Korea / India
  [/\b(sg|singapore)\b/i, 'sg'],
  [/\b(jp|japan|tokyo|osaka)\b/i, 'jp'],
  [/\b(kr|korea|seoul)\b/i, 'kr'],
  [/\b(in|india|mumbai|delhi)\b/i, 'in'],
  // Australia
  [/\b(au|australia|sydney|melbourne)\b/i, 'au'],
];

function detectCountryFromName(name: string): string | null {
  const n = name.trim();
  if (!n) return null;
  for (const [re, iso2] of COUNTRY_ALIASES) {
    if (re.test(n)) return iso2;
  }
  return null;
}

function iso2ToFlagEmoji(iso2: string): string | null {
  const s = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(s)) return null;
  const A = 0x1f1e6;
  const first = A + (s.charCodeAt(0) - 65);
  const second = A + (s.charCodeAt(1) - 65);
  try {
    return String.fromCodePoint(first, second);
  } catch {
    return null;
  }
}

function nameHasLeadingFlagEmoji(name: string) {
  // Matches any regional-indicator flag at the start of the string.
  // eslint-disable-next-line no-control-regex
  return /^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u.test(name);
}

function parseHash(hashRaw: string): { name: string; params: Record<string, string> } {
  const raw = hashRaw.startsWith('#') ? hashRaw.slice(1) : hashRaw;
  if (!raw) return { name: '', params: {} };

  const decoded = (() => {
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  })();

  const parts = decoded.split('&').filter(Boolean);
  const params: Record<string, string> = {};
  let name = '';
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq === -1 && !name) {
      name = p;
      continue;
    }
    if (eq === -1) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1);
    if (!k) continue;
    params[k] = v;
  }
  return { name, params };
}

function buildHash(input: { name: string; params: Record<string, string> }) {
  const parts: string[] = [];
  if (input.name) parts.push(encodeURIComponent(input.name));
  for (const [k, v] of Object.entries(input.params)) {
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  }
  return parts.length ? `#${parts.join('&')}` : '';
}

function flagifyNodeLink(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return line;

  // Most Marzban subscriptions are vless:// links. We only touch URI-like lines.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) return line;

  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return line;
  }

  // Skip vmess:// because it carries base64 JSON, not URL params.
  if (u.protocol === 'vmess:') return line;

  const parsed = parseHash(u.hash);
  let name = parsed.name;
  const params = parsed.params;
  const iso2 = detectCountryFromName(name);
  if (!iso2) return line;

  const flagUrl = `https://flagcdn.com/${iso2}.svg`;
  // Different clients read hints from different places; set both query and fragment hints.
  // - Some clients may look for a country code (e.g. NL) and render their own icon.
  // - Some may accept a direct icon URL (flag).
  u.searchParams.set('country', iso2);
  u.searchParams.set('flag', flagUrl);
  params.country = iso2;
  params.flag = flagUrl;

  // Happ often displays the first emoji in the name as the icon.
  // If the name begins with a non-flag emoji (e.g. 💊), Happ won't show the country flag.
  // Prepend the detected flag emoji to the name to make it consistently visible.
  const flagEmoji = iso2ToFlagEmoji(iso2);
  if (flagEmoji && !nameHasLeadingFlagEmoji(name)) {
    name = `${flagEmoji} ${name}`.trim();
  }

  u.hash = buildHash({ name, params });
  return u.toString();
}

function flagifySubscriptionText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => flagifyNodeLink(l))
    .join('\n');
}

export const flagify = asyncHandler(async (req, res) => {
  const urlRaw = typeof req.query.url === 'string' ? req.query.url : '';
  if (!urlRaw) throw new HttpError(400, 'Missing url');
  if (urlRaw.length > 4000) throw new HttpError(400, 'URL too long');

  let url: URL;
  try {
    url = new URL(urlRaw);
  } catch {
    throw new HttpError(400, 'Invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'Only http/https urls are allowed');
  if (isPrivateHostname(url.hostname)) throw new HttpError(400, 'Private/localhost urls are not allowed');

  const { data } = await axios.get<string>(url.toString(), {
    responseType: 'text' as any,
    timeout: 15_000,
    // Avoid compressions that sometimes break heuristics in edge proxies
    headers: { 'accept-encoding': 'identity' },
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const { decoded, wasBase64 } = decodeMaybeBase64(String(data ?? ''));
  const updated = flagifySubscriptionText(decoded);
  const out = wasBase64 ? Buffer.from(updated, 'utf8').toString('base64') : updated;

  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.send(out);
});

function ensureProfileTitle(text: string, title: string) {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  const hasTitle = lines.some((l) => l.trim().toLowerCase().startsWith('#profile-title:'));
  if (hasTitle) return normalized;
  return `#profile-title: ${title}\n${normalized}`;
}

export const happSub = asyncHandler(async (req, res) => {
  const urlRaw = typeof req.query.url === 'string' ? req.query.url : '';
  const titleRaw = typeof req.query.title === 'string' ? req.query.title : 'SYVPN';
  const title = (titleRaw || 'SYVPN').slice(0, 25);

  if (!urlRaw) throw new HttpError(400, 'Missing url');
  if (urlRaw.length > 4000) throw new HttpError(400, 'URL too long');

  let url: URL;
  try {
    url = new URL(urlRaw);
  } catch {
    throw new HttpError(400, 'Invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new HttpError(400, 'Only http/https urls are allowed');
  if (isPrivateHostname(url.hostname)) throw new HttpError(400, 'Private/localhost urls are not allowed');

  const { data } = await axios.get<string>(url.toString(), {
    responseType: 'text' as any,
    timeout: 15_000,
    headers: { 'accept-encoding': 'identity' },
    validateStatus: (s) => s >= 200 && s < 300,
  });

  const { decoded, wasBase64 } = decodeMaybeBase64(String(data ?? ''));
  const updated = ensureProfileTitle(decoded, title);
  const out = wasBase64 ? Buffer.from(updated, 'utf8').toString('base64') : updated;

  // Happ supports profile-title via HTTP headers.
  res.setHeader('profile-title', title);
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.send(out);
});

