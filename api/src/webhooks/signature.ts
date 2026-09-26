import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 300;

export type SignatureResult = { ok: true } | { ok: false; reason: string };

export function sign(rawBody: string, secret: string, timestamp?: number): string {
    const t = timestamp ?? Math.floor(Date.now() / 1000);
    const digest = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
    return `t=${t},v1=${digest}`;
}

export function verifySignature(
    rawBody: Buffer | string | undefined,
    header: string | undefined,
    secret: string,
): SignatureResult {
    if (!rawBody) return { ok: false, reason: 'missing raw body' };
    if (!header) return { ok: false, reason: 'missing signature header' };

    const parts: Record<string, string> = {};
    for (const chunk of header.split(',')) {
        const [k, v] = chunk.trim().split('=');
        if (k && v) parts[k] = v;
    }

    const timestamp = parts['t'];
    const received = parts['v1'];
    if (!timestamp || !received) return { ok: false, reason: 'malformed signature header' };

    const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
    if (Number.isNaN(age)) return { ok: false, reason: 'invalid timestamp' };
    if (age > TOLERANCE_SECONDS) return { ok: false, reason: 'timestamp outside tolerance' };

    const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(received, 'hex');
    if (a.length !== b.length) return { ok: false, reason: 'signature length mismatch' };
    if (!timingSafeEqual(a, b)) return { ok: false, reason: 'signature mismatch' };

    return { ok: true };
}