import crypto from 'node:crypto';
import axios from 'axios';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { MAX_SUBSCRIPTION_DEVICES, resolveSubscriptionUpstreamUrl } from '../services/subProxyService.js';

function clientIp(req: { ip?: string; socket: { remoteAddress?: string } }) {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip.replace(/^::ffff:/, '');
}

function deviceFingerprint(req: { ip?: string; socket: { remoteAddress?: string }; headers: { [k: string]: unknown } }) {
  const ip = clientIp(req);
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : '';
  return crypto.createHash('sha256').update(`${ip}|${ua}`).digest('hex');
}

/**
 * One clean URL per user: GET /sub/:token → Marzban subscription body.
 * Allows up to MAX_SUBSCRIPTION_DEVICES distinct (IP + User-Agent) fingerprints.
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
    const count = await prisma.subDeviceFingerprint.count({ where: { subscriptionId: sub.id } });
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

  const rawCt = upstream.headers['content-type'];
  const ct =
    typeof rawCt === 'string'
      ? rawCt
      : Array.isArray(rawCt) && typeof rawCt[0] === 'string'
        ? rawCt[0]
        : 'text/plain; charset=utf-8';
  res.setHeader('content-type', ct);
  res.status(200).send(Buffer.from(upstream.data));
});
