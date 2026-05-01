import crypto from 'node:crypto';
import axios, { type AxiosResponse } from 'axios';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { MAX_SUBSCRIPTION_DEVICES, resolveSubscriptionUpstreamUrl } from '../services/subProxyService.js';

/** Only rows with this prefix count toward the limit (ignores legacy IP|UA hashes). */
const FP_VERSION_PREFIX = 'v2:';

function clientIp(req: { ip?: string; socket: { remoteAddress?: string } }) {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

/** One slot per public IP (browser + Happ on same Wi‑Fi share one slot). */
function deviceFingerprint(req: { ip?: string; socket: { remoteAddress?: string } }) {
  const ip = clientIp(req) || '0.0.0.0';
  const digest = crypto.createHash('sha256').update(ip, 'utf8').digest('hex');
  return `${FP_VERSION_PREFIX}${digest}`;
}

function tryDecodeProfileBase64(oneLine: string): string | null {
  const compact = oneLine.replace(/\s/g, '');
  if (compact.length < 32) return null;
  if (!/^[A-Za-z0-9+/=_-]+=*$/.test(compact)) return null;
  const stdB64 = compact.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const dec = Buffer.from(stdB64, 'base64').toString('utf8');
    if (
      dec.includes('vless:') ||
      dec.includes('vmess:') ||
      dec.includes('trojan:') ||
      dec.includes('ss://')
    ) {
      return dec;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Happ and many clients expect newline-separated vless:// lines. Marzban often
 * returns a single base64 line; decode when safe so parsers see real nodes.
 */
function normalizeSubscriptionPayload(raw: Buffer, upstreamContentType: string): { body: Buffer; contentType: string } {
  let text: string;
  try {
    text = raw.toString('utf8');
  } catch {
    return { body: raw, contentType: upstreamContentType };
  }
  const trimmed = text.trim();
  if (!trimmed) return { body: raw, contentType: upstreamContentType };

  if (
    trimmed.includes('vless://') ||
    trimmed.includes('vmess://') ||
    trimmed.includes('trojan://') ||
    trimmed.includes('ss://')
  ) {
    return { body: Buffer.from(trimmed, 'utf8'), contentType: 'text/plain; charset=utf-8' };
  }

  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as Record<string, unknown>;
      for (const k of ['subscription', 'data', 'content', 'base64']) {
        const v = j[k];
        if (typeof v === 'string') {
          const inner = tryDecodeProfileBase64(v);
          if (inner) return { body: Buffer.from(inner, 'utf8'), contentType: 'text/plain; charset=utf-8' };
        }
      }
    } catch {
      /* ignore */
    }
  }

  const decoded = tryDecodeProfileBase64(trimmed);
  if (decoded) {
    return { body: Buffer.from(decoded, 'utf8'), contentType: 'text/plain; charset=utf-8' };
  }

  return { body: raw, contentType: upstreamContentType };
}

/** True when someone opens the link in a normal browser tab — show a clean page, not raw config. */
function wantsHtmlBrowserPreview(req: Request): boolean {
  if (req.query?.raw === '1' || req.query?.format === 'raw') return false;

  const dest = req.headers['sec-fetch-dest'];
  if (typeof dest === 'string' && dest.toLowerCase() === 'document') return true;

  const accept = typeof req.headers.accept === 'string' ? req.headers.accept : '';
  const first = accept.split(',')[0]?.trim().split(';')[0]?.trim().toLowerCase();
  if (first === 'text/html') return true;

  return false;
}

function forwardMarzbanSubscriptionHeaders(res: Response, upstreamHeaders: AxiosResponse['headers']): void {
  const h = upstreamHeaders as Record<string, string | string[] | undefined>;
  for (const key of Object.keys(h)) {
    const lower = key.toLowerCase();
    if (
      lower === 'content-type' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding' ||
      lower === 'connection'
    ) {
      continue;
    }
    if (
      lower.startsWith('subscription-') ||
      lower.startsWith('profile-') ||
      lower.startsWith('announce') ||
      lower === 'support-url'
    ) {
      const v = h[key];
      if (typeof v === 'string') res.setHeader(key, v);
      else if (Array.isArray(v) && v.length > 0) res.setHeader(key, v[v.length - 1]!);
    }
  }
}

function subscriptionBrowserLandingHtml(expiresAt: Date): string {
  const base = env.PUBLIC_BASE_URL.replace(/\/+$/g, '');
  const mini = `${base}/mini/`;
  const exp = expiresAt.toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>SYVPN</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; background: #07070f; color: #e4e4ef; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.25rem; }
    .card { max-width: 22rem; width: 100%; background: rgba(255,255,255,.05); border-radius: 1rem; padding: 1.75rem 1.5rem; border: 1px solid rgba(255,255,255,.08); text-align: center; }
    h1 { font-size: 1.125rem; font-weight: 600; margin: 0 0 .75rem; letter-spacing: -0.02em; }
    p { color: #9ca3af; font-size: .8125rem; line-height: 1.55; margin: 0 0 .75rem; }
    .muted { font-size: .75rem; color: #6b7280; margin-top: 1rem; }
    a { color: #60a5fa; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Subscription link</h1>
    <p>This URL is meant to be pasted into <strong>Happ</strong> (or your VPN app) — not read in the browser.</p>
    <p>Open <strong>SYVPN</strong> in Telegram, copy your config link there, and import it in Happ.</p>
    <p class="muted">Valid through ${exp} · <a href="${mini}">Back to SYVPN</a></p>
  </div>
</body>
</html>`;
}

/**
 * One clean URL per user: GET /sub/:token → Marzban subscription body.
 * Up to MAX_SUBSCRIPTION_DEVICES distinct public IPs (v2 fingerprints).
 */
export const proxyPublicSubscription = asyncHandler(async (req, res) => {
  const token = typeof req.params?.token === 'string' ? req.params.token : '';
  if (!token || token.length < 8 || token.length > 200) {
    res.status(404).type('text/plain').send('Invalid link');
    return;
  }

  const sub = await prisma.subscription.findFirst({
    where: { publicSubToken: token, status: 'active' },
  });

  if (!sub?.configUrl) {
    res.status(404).type('text/plain').send('Invalid subscription link');
    return;
  }

  if (sub.expiresAt <= new Date()) {
    res.status(403).type('text/plain').send('Subscription expired');
    return;
  }

  const fp = deviceFingerprint(req);

  const known = await prisma.subDeviceFingerprint.findUnique({
    where: { subscriptionId_fpHash: { subscriptionId: sub.id, fpHash: fp } },
  });

  if (!known) {
    const count = await prisma.subDeviceFingerprint.count({
      where: { subscriptionId: sub.id, fpHash: { startsWith: FP_VERSION_PREFIX } },
    });
    if (count >= MAX_SUBSCRIPTION_DEVICES) {
      res
        .status(403)
        .type('text/plain')
        .send(
          `This subscription is limited to ${MAX_SUBSCRIPTION_DEVICES} devices. Remove it from an old device or reset devices in the SYVPN app.`
        );
      return;
    }
    await prisma.subDeviceFingerprint.create({
      data: { subscriptionId: sub.id, fpHash: fp },
    });
  }

  if (wantsHtmlBrowserPreview(req)) {
    res.status(200).type('html').send(subscriptionBrowserLandingHtml(sub.expiresAt));
    return;
  }

  const fetchUrl = resolveSubscriptionUpstreamUrl(sub.configUrl);

  let upstream;
  try {
    upstream = await axios.get<ArrayBuffer>(fetchUrl, {
      responseType: 'arraybuffer',
      timeout: 20_000,
      headers: { 'accept-encoding': 'identity' },
      validateStatus: (s) => s >= 200 && s < 300,
    });
  } catch {
    throw new HttpError(502, 'Subscription upstream unavailable', true);
  }

  forwardMarzbanSubscriptionHeaders(res, upstream.headers);

  const rawCt = upstream.headers['content-type'];
  const upstreamCt =
    typeof rawCt === 'string'
      ? rawCt
      : Array.isArray(rawCt) && typeof rawCt[0] === 'string'
        ? rawCt[0]
        : 'text/plain; charset=utf-8';

  const buf = Buffer.from(upstream.data);
  const { body, contentType } = normalizeSubscriptionPayload(buf, upstreamCt);
  res.setHeader('content-type', contentType);
  res.status(200).send(body);
});
