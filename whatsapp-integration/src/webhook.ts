import { Router, Request, Response } from 'express';
import { getWhatsAppConfig } from './config';

export interface StatusCallbackLog {
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed' | string;
  timestamp: Date;
  recipientId: string;
  errors?: any[];
  rawPayload: any;
}

// In-memory store for WhatsApp delivery status logs
const statusLogs: StatusCallbackLog[] = [];

/**
 * Accessor to retrieve the current in-memory status logs.
 */
export function getStatusLogs(): StatusCallbackLog[] {
  return [...statusLogs];
}

/**
 * Helper to clear the logged status updates (useful for testing).
 */
export function clearStatusLogs(): void {
  statusLogs.length = 0;
}

/**
 * Helper function to extract and record status updates from standard Meta Webhook payloads.
 */
export function processWebhookPayload(payload: any): StatusCallbackLog[] {
  const processed: StatusCallbackLog[] = [];

  if (payload && payload.object === 'whatsapp_business_account' && Array.isArray(payload.entry)) {
    for (const entry of payload.entry) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value && Array.isArray(value.statuses)) {
            for (const statusObj of value.statuses) {
              const log: StatusCallbackLog = {
                messageId: statusObj.id,
                status: statusObj.status,
                // Parse UNIX timestamp from payload, default to now if not provided
                timestamp: statusObj.timestamp
                  ? new Date(parseInt(statusObj.timestamp, 10) * 1000)
                  : new Date(),
                recipientId: statusObj.recipient_id,
                errors: statusObj.errors || undefined,
                rawPayload: payload,
              };
              statusLogs.push(log);
              processed.push(log);
            }
          }
        }
      }
    }
  }

  return processed;
}

/**
 * Creates and configures an Express Router with endpoints for Meta's WhatsApp Webhooks.
 *
 * - GET /webhook : Verifies subscription with Meta.
 * - POST /webhook: Receives status change updates and logs them.
 */
export function createWebhookRouter(): Router {
  const router = Router();

  // GET: Webhook validation endpoint
  router.get('/webhook', (req: Request, res: Response) => {
    try {
      const config = getWhatsAppConfig();
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token) {
        if (mode === 'subscribe' && token === config.verifyToken) {
          console.log('[WhatsApp Webhook] Verification successful.');
          res.status(200).send(challenge);
          return;
        } else {
          console.warn('[WhatsApp Webhook] Verification failed. Tokens do not match.');
          res.status(403).send('Forbidden: Token mismatch');
          return;
        }
      }
      res.status(400).send('Bad Request: Missing mode or token');
      return;
    } catch (error: any) {
      console.error('[WhatsApp Webhook] GET Error:', error.message);
      res.status(500).send('Internal Server Error');
      return;
    }
  });

  // POST: Receive event updates from WhatsApp
  router.post('/webhook', (req: Request, res: Response) => {
    try {
      const payload = req.body;
      const processed = processWebhookPayload(payload);

      if (processed.length > 0) {
        console.log(`[WhatsApp Webhook] Processed ${processed.length} status change event(s).`);
      }

      // Meta requires a 200 OK status to be returned for all status callback POST requests
      res.status(200).json({ status: 'success', processedCount: processed.length });
      return;
    } catch (error: any) {
      console.error('[WhatsApp Webhook] POST Error:', error.message);
      res.status(500).json({ error: 'Internal Server Error' });
      return;
    }
  });

  return router;
}
