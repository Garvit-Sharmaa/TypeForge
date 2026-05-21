/**
 * webhooks.router.ts — QStash "God Handler" endpoint.
 *
 * ═══════════════════════════════════════════════════════════════
 *  MIGRATION STATUS: PHASE 3 — Webhook receiver created.
 *
 *  Mounted at: POST /api/webhooks/process-session
 *
 *  Security:
 *    QStash signs every delivery with an HMAC-SHA256 signature over
 *    the raw request body. The Receiver verifies this before any
 *    business logic runs. In local dev (signing keys absent) the
 *    check is skipped with a loud warning — never disable in prod.
 *
 *  Fan-out strategy:
 *    The three pure worker functions run concurrently via Promise.all.
 *    Any individual failure throws, causing a 500 response that
 *    signals QStash to retry the entire payload (idempotent by design).
 *
 *  Retry contract:
 *    QStash retries on any non-2xx. Workers are idempotent so retries
 *    are safe. Malformed payloads (Zod failure) return 400 — QStash
 *    does NOT retry 4xx, preventing infinite loops on bad data.
 * ═══════════════════════════════════════════════════════════════
 */

import { Router, Request, Response } from 'express';
import { Receiver }                  from '@upstash/qstash';
import { z }                         from 'zod';
import { env }                       from '../../config/env';
import { logger }                    from '../../utils/logger';
import { processAnalytics }          from '../../workers/analyticsWorker';
import { processAchievements }       from '../../workers/achievementWorker';
import { processStreak }             from '../../workers/streakWorker';

const router = Router();

// ── QStash Receiver (lazy) ────────────────────────────────────────────────────
// Initialised on first call so the server still boots in local dev without
// signing keys. getReceiver() returns null → verification is skipped with a
// warning. NEVER skip in production — PUBLIC_API_URL + signing keys must be set.
let _receiver: Receiver | null | undefined; // undefined = not yet attempted

function getReceiver(): Receiver | null {
  if (_receiver !== undefined) return _receiver;

  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
    logger.warn(
      '[Webhook] QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY not set. ' +
      'Signature verification is DISABLED — local dev mode only.',
    );
    _receiver = null;
    return null;
  }

  _receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey:    env.QSTASH_NEXT_SIGNING_KEY,
  });
  return _receiver;
}

// ── Webhook payload schema ────────────────────────────────────────────────────
// Matches SessionWebhookPayload in bullmq.ts (the producer contract).
const SessionWebhookSchema = z.object({
  sessionId: z.string().uuid(),
  userId:    z.string().uuid(),
  wpm:       z.number().int().min(0),
  accuracy:  z.number().int().min(0).max(100),
});

// ── POST /api/webhooks/process-session ───────────────────────────────────────
/**
 * QStash delivers here after dispatchSessionJobs() publishes a session event.
 *
 * Steps:
 *   1. Verify QStash HMAC signature against raw request body
 *   2. Validate JSON payload shape with Zod
 *   3. Fan-out to all three worker pure functions concurrently
 *   4. Return 200 (success) or 500 (retry signal) accordingly
 */
router.post('/process-session', async (req: Request, res: Response): Promise<void> => {
  // ── 1. Signature verification ───────────────────────────────────────────────
  const receiver  = getReceiver();

  if (receiver) {
    const signature = req.headers['upstash-signature'];
    const rawBody   = req.rawBody; // captured by express.json() verify in app.ts

    if (!signature || typeof signature !== 'string') {
      logger.warn('[Webhook] Request missing upstash-signature header — rejected');
      res.status(401).json({ success: false, error: 'Missing signature' });
      return;
    }

    if (!rawBody) {
      // Should never happen if app.ts has the verify callback in place.
      logger.error('[Webhook] rawBody is undefined — verify callback not wired in express.json()');
      res.status(500).json({ success: false, error: 'Raw body unavailable' });
      return;
    }

    if (!env.PUBLIC_API_URL) {
      logger.error('[Webhook] PUBLIC_API_URL not set — cannot construct canonical URL for signature check');
      res.status(500).json({ success: false, error: 'Server misconfiguration' });
      return;
    }

    try {
      const isValid = await receiver.verify({
        body:      rawBody.toString(),
        signature,
        // The canonical URL must exactly match what the producer published to.
        // bullmq.ts sends to: `${PUBLIC_API_URL}/api/webhooks/process-session`
        url: `${env.PUBLIC_API_URL}/api/webhooks/process-session`,
      });

      if (!isValid) {
        logger.warn('[Webhook] Invalid QStash signature — rejected');
        res.status(401).json({ success: false, error: 'Invalid signature' });
        return;
      }
    } catch (err) {
      logger.warn({ err }, '[Webhook] Signature verification threw — rejected');
      res.status(401).json({ success: false, error: 'Signature verification error' });
      return;
    }

    logger.info('[Webhook] Signature verified ✓');
  }

  // ── 2. Payload validation ───────────────────────────────────────────────────
  const parsed = SessionWebhookSchema.safeParse(req.body);

  if (!parsed.success) {
    // Return 400 — Zod failure means malformed data from QStash.
    // QStash does NOT retry 4xx responses, preventing infinite retry loops.
    logger.warn({ issues: parsed.error.issues }, '[Webhook] Invalid payload schema — not retrying');
    res.status(400).json({
      success: false,
      error:   'Invalid payload',
      details: parsed.error.issues.map((i) => i.message),
    });
    return;
  }

  const { sessionId, userId, wpm, accuracy } = parsed.data;

  logger.info({ sessionId, userId, wpm, accuracy }, '[Webhook] Processing session event');

  // ── 3. Concurrent fan-out to all three pure worker functions ────────────────
  // Workers are independent — run them in parallel for lowest latency.
  // A single worker failure throws, which falls through to the 500 handler.
  // QStash will then retry the full payload; all three workers are idempotent
  // so double-execution is safe.
  try {
    await Promise.all([
      processAnalytics  (sessionId, userId),
      processAchievements(userId, wpm, accuracy),
      processStreak     (userId),
    ]);

    logger.info({ sessionId, userId }, '[Webhook] All workers completed ✓');
    res.status(200).json({ success: true });
  } catch (err) {
    // 500 → QStash retries (up to the `retries: 3` set by the producer).
    logger.error({ err, sessionId, userId }, '[Webhook] Worker fan-out failed — QStash will retry');
    res.status(500).json({ success: false, error: 'Processing failed — will retry' });
  }
});

export default router;
