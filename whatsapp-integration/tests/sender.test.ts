import axios from 'axios';
import { sendWhatsAppMessage } from '../src/sender';
import { TemplateRegistry, getWhatsAppConfig } from '../src/config';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('sendWhatsAppMessage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      WHATSAPP_PHONE_NUMBER_ID: '123456789',
      WHATSAPP_ACCESS_TOKEN: 'test-token-abc',
      WHATSAPP_VERIFY_TOKEN: 'verify-token-123',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('should successfully send an order_confirmation template message', async () => {
    const mockApiResponse = {
      data: {
        messaging_product: 'whatsapp',
        contacts: [{ input: '+15550199', wa_id: '15550199' }],
        messages: [{ id: 'wamid.HBgLMTU1NTAxOTk2MjcVAgARGBI1RjREMTIzNDU2Nzg5MAA=' }],
      },
    };

    mockedAxios.post.mockResolvedValueOnce(mockApiResponse);

    const params = {
      orderId: 'ORD-9988',
      productName: 'Wireless Headphones',
      deliveryPinOrLink: 'https://ship.co/pin/9922',
    };

    const res = await sendWhatsAppMessage(
      'order_confirmation',
      '+1 (555) 019-9',
      params
    );

    expect(res).toEqual(mockApiResponse.data);

    // Verify axios was called with the correct mapped parameters
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [calledUrl, calledPayload, calledConfig] = mockedAxios.post.mock.calls[0];

    expect(calledUrl).toBe('https://graph.facebook.com/v21.0/123456789/messages');
    expect(calledPayload).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '15550199', // should be cleaned of formatting
      type: 'template',
      template: {
        name: 'order_confirmation',
        language: {
          code: 'en_US',
        },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'ORD-9988' }, // orderId
              { type: 'text', text: 'Wireless Headphones' }, // productName
              { type: 'text', text: 'https://ship.co/pin/9922' }, // deliveryPinOrLink
            ],
          },
        ],
      },
    });

    expect(calledConfig?.headers).toEqual({
      Authorization: 'Bearer test-token-abc',
      'Content-Type': 'application/json',
    });
  });

  it('should successfully send a shipment_update template message', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { messaging_product: 'whatsapp', messages: [{ id: 'msg-ship-1' }] },
    });

    const params = {
      trackingStatus: 'In Transit',
      estimatedDelivery: 'Oct 15, 2026',
    };

    await sendWhatsAppMessage('shipment_update', '12345', params);

    const [, payload] = mockedAxios.post.mock.calls[0];
    expect((payload as any).template.components[0].parameters).toEqual([
      { type: 'text', text: 'In Transit' },
      { type: 'text', text: 'Oct 15, 2026' },
    ]);
  });

  it('should successfully send a payment_confirmed template message', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { messaging_product: 'whatsapp', messages: [{ id: 'msg-pay-1' }] },
    });

    const params = {
      amountConfirmed: '$120.50',
      orderId: 'ORD-7766',
    };

    await sendWhatsAppMessage('payment_confirmed', '12345', params);

    const [, payload] = mockedAxios.post.mock.calls[0];
    expect((payload as any).template.components[0].parameters).toEqual([
      { type: 'text', text: '$120.50' },
      { type: 'text', text: 'ORD-7766' },
    ]);
  });

  it('should throw an error when a required parameter is missing in a registered template', async () => {
    const params = {
      orderId: 'ORD-9988',
      // productName is missing!
      deliveryPinOrLink: 'https://ship.co/pin/9922',
    };

    await expect(
      sendWhatsAppMessage('order_confirmation', '12345', params)
    ).rejects.toThrow('Missing required parameter "productName" for template "order_confirmation"');
  });

  it('should handle custom registered templates correctly', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { messaging_product: 'whatsapp', messages: [{ id: 'msg-custom-1' }] },
    });

    // Register a new template dynamic parameter mapping
    TemplateRegistry.registerTemplate('welcome_offer', ['customerName', 'discountCode', 'expiryDate']);

    const params = {
      expiryDate: 'Dec 31',
      customerName: 'Alice',
      discountCode: 'WELCOME20',
    };

    await sendWhatsAppMessage('welcome_offer', '12345', params);

    const [, payload] = mockedAxios.post.mock.calls[0];
    expect((payload as any).template.components[0].parameters).toEqual([
      { type: 'text', text: 'Alice' },
      { type: 'text', text: 'WELCOME20' },
      { type: 'text', text: 'Dec 31' },
    ]);

    // Clean up
    TemplateRegistry.removeTemplate('welcome_offer');
  });

  it('should throw an error if the template is unregistered', async () => {
    const params = {
      zebra: 'stripes',
      apple: 'fruit',
    };

    await expect(
      sendWhatsAppMessage('completely_unregistered_template', '12345', params)
    ).rejects.toThrow(
      'Template "completely_unregistered_template" is not registered in TemplateRegistry. Register it first using TemplateRegistry.registerTemplate() before sending.'
    );
  });

  it('should support dynamic configuration overrides', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { messaging_product: 'whatsapp', messages: [{ id: 'msg-override' }] },
    });

    await sendWhatsAppMessage(
      'payment_confirmed',
      '12345',
      { amountConfirmed: '50', orderId: 'O1' },
      {
        languageCode: 'es_ES',
        configOverride: {
          phoneNumberId: 'override-phone-id',
          accessToken: 'override-token',
          apiBaseUrl: 'https://override-base.com',
        },
      }
    );

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [calledUrl, calledPayload, calledConfig] = mockedAxios.post.mock.calls[0];

    expect(calledUrl).toBe('https://override-base.com/override-phone-id/messages');
    expect((calledPayload as any).template.language.code).toBe('es_ES');
    expect(calledConfig?.headers?.Authorization).toBe('Bearer override-token');
  });

  it('should throw an error if configuration parameters are missing', async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = ''; // missing

    await expect(
      sendWhatsAppMessage('payment_confirmed', '12345', { amountConfirmed: '50', orderId: 'O1' })
    ).rejects.toThrow(/Missing required environment variable/);
  });

  it('should parse and throw clear error when Meta API rejects the request', async () => {
    const apiErrorResponse = {
      response: {
        data: {
          error: {
            message: '(#100) Parameter to is invalid',
            type: 'OAuthException',
            code: 100,
            error_subcode: 33,
            fbtrace_id: 'An8_T3-T2A1'
          }
        }
      }
    };

    mockedAxios.post.mockRejectedValueOnce(apiErrorResponse);

    await expect(
      sendWhatsAppMessage('payment_confirmed', '12345', { amountConfirmed: '50', orderId: 'O1' })
    ).rejects.toThrow('WhatsApp API call failed: (#100) Parameter to is invalid (code: 100, subcode: 33)');
  });
});
