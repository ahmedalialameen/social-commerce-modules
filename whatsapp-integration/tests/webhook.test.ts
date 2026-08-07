import express from 'express';
import request from 'supertest';
import {
  createWebhookRouter,
  getStatusLogs,
  clearStatusLogs,
} from '../src/webhook';

describe('Webhook Router', () => {
  let app: express.Express;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    clearStatusLogs();
    process.env = {
      ...originalEnv,
      WHATSAPP_PHONE_NUMBER_ID: '123456789',
      WHATSAPP_ACCESS_TOKEN: 'test-token-abc',
      WHATSAPP_VERIFY_TOKEN: 'my_verify_token_123',
    };

    app = express();
    app.use(express.json());
    app.use('/whatsapp', createWebhookRouter());
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /webhook verification', () => {
    it('should verify webhook successfully with correct verify token', async () => {
      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_verify_token_123',
          'hub.challenge': 'random_challenge_abc_123',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('random_challenge_abc_123');
    });

    it('should fail verification if verify token does not match', async () => {
      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'random_challenge_abc_123',
        });

      expect(response.status).toBe(403);
      expect(response.text).toContain('Forbidden');
    });

    it('should return bad request if parameters are missing', async () => {
      const response = await request(app)
        .get('/whatsapp/webhook')
        .query({
          'hub.mode': 'subscribe',
        });

      expect(response.status).toBe(400);
      expect(response.text).toContain('Bad Request');
    });
  });

  describe('POST /webhook event notifications', () => {
    it('should parse and log standard delivered status callback successfully', async () => {
      const samplePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '987654321',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15555555555',
                    phone_number_id: '123456789'
                  },
                  statuses: [
                    {
                      id: 'wamid.HBgLMTU1NTAxOTk2MjcVAgARGBI1RjREMTIzNDU2Nzg5MAA=',
                      status: 'delivered',
                      timestamp: '1700000000',
                      recipient_id: '15550199'
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/whatsapp/webhook')
        .send(samplePayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'success',
        processedCount: 1,
      });

      // Verify the status log was updated in memory
      const logs = getStatusLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual({
        messageId: 'wamid.HBgLMTU1NTAxOTk2MjcVAgARGBI1RjREMTIzNDU2Nzg5MAA=',
        status: 'delivered',
        timestamp: new Date(1700000000 * 1000),
        recipientId: '15550199',
        errors: undefined,
        rawPayload: samplePayload,
      });
    });

    it('should parse and log failed status callbacks with error info', async () => {
      const samplePayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '987654321',
            changes: [
              {
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '15555555555',
                    phone_number_id: '123456789'
                  },
                  statuses: [
                    {
                      id: 'wamid.HBgLMTU1NTAxOTk2MjcVAgARGBI1RjREMTIzNDU2Nzg5MAA=',
                      status: 'failed',
                      timestamp: '1700000100',
                      recipient_id: '15550199',
                      errors: [
                        {
                          code: 131042,
                          title: 'Payment required'
                        }
                      ]
                    }
                  ]
                },
                field: 'messages'
              }
            ]
          }
        ]
      };

      const response = await request(app)
        .post('/whatsapp/webhook')
        .send(samplePayload);

      expect(response.status).toBe(200);
      expect(response.body.processedCount).toBe(1);

      const logs = getStatusLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].errors).toEqual([
        {
          code: 131042,
          title: 'Payment required',
        },
      ]);
    });

    it('should handle irrelevant webhook calls gracefully without logging', async () => {
      const samplePayload = {
        object: 'some_other_object',
      };

      const response = await request(app)
        .post('/whatsapp/webhook')
        .send(samplePayload);

      expect(response.status).toBe(200);
      expect(response.body.processedCount).toBe(0);

      const logs = getStatusLogs();
      expect(logs).toHaveLength(0);
    });
  });
});
