import express from 'express';
import request from 'supertest';
import { LocationCaptureStore } from '../src/store';
import { LocationCaptureService } from '../src/service';
import { createLocationCaptureRouter } from '../src/router';

describe('Location Capture Module Tests', () => {
  let store: LocationCaptureStore;
  let service: LocationCaptureService;
  let app: express.Express;

  beforeEach(() => {
    store = new LocationCaptureStore();
    service = new LocationCaptureService(store, 'https://example.com/capture');
    app = express();
    app.use(express.json());
    app.use('/location', createLocationCaptureRouter(service));
  });

  describe('Core Service Logic', () => {
    test('successful link generation', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';

      const result = service.generateLocationLink(customerId, orderId, 15);

      expect(result.linkId).toBeDefined();
      expect(typeof result.linkId).toBe('string');
      expect(result.url).toBe(`https://example.com/capture/${result.linkId}`);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    test('rejection of invalid input on link generation', () => {
      expect(() => service.generateLocationLink('', 'order-456')).toThrow('Missing or invalid customerId.');
      expect(() => service.generateLocationLink('  ', 'order-456')).toThrow('Missing or invalid customerId.');
      expect(() => service.generateLocationLink('cust-123', '')).toThrow('Missing or invalid orderId.');
      expect(() => service.generateLocationLink('cust-123', 'order-456', 0)).toThrow('Expiration duration must be greater than zero.');
    });

    test('successful pin submission and persistent address record creation', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';
      const linkData = service.generateLocationLink(customerId, orderId, 10);

      // Verify no address exists initially
      expect(service.getCustomerAddress(customerId)).toBeNull();

      // Submit pin
      const submitResult = service.submitPin(linkData.linkId, 12.345, 67.890);
      expect(submitResult.customerId).toBe(customerId);
      expect(submitResult.orderId).toBe(orderId);

      // Address should now exist persistently
      const address = service.getCustomerAddress(customerId);
      expect(address).not.toBeNull();
      expect(address!.latitude).toBe(12.345);
      expect(address!.longitude).toBe(67.890);
      expect(address!.lastUpdated).toBeInstanceOf(Date);

      // A new order prefill should work
      const prefilled = service.getPrefilledAddressForNewLink(customerId);
      expect(prefilled).toEqual(address);
    });

    test('address persistence across multiple links for same customer', () => {
      const customerId = 'cust-same';

      // First link
      const link1 = service.generateLocationLink(customerId, 'order-1', 10);
      service.submitPin(link1.linkId, 10, 20);

      const addr1 = service.getCustomerAddress(customerId);
      expect(addr1!.latitude).toBe(10);
      expect(addr1!.longitude).toBe(20);

      // Second link - should update address
      const link2 = service.generateLocationLink(customerId, 'order-2', 10);
      service.submitPin(link2.linkId, 30, 40);

      const addr2 = service.getCustomerAddress(customerId);
      expect(addr2!.latitude).toBe(30);
      expect(addr2!.longitude).toBe(40);
    });

    test('already-used link rejection', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';
      const linkData = service.generateLocationLink(customerId, orderId, 10);

      // First submit succeeds
      service.submitPin(linkData.linkId, 12.345, 67.890);

      // Second submit fails with explicit error
      expect(() => {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      }).toThrow('Link has already been used.');

      try {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      } catch (err: any) {
        expect(err.statusCode).toBe(410);
      }
    });

    test('expired link rejection', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';

      // Generate valid link
      const linkData = service.generateLocationLink(customerId, orderId, 10);

      // Manually expire it in the store
      const storedLink = store.getLink(linkData.linkId);
      if (storedLink) {
        storedLink.expiresAt = new Date(Date.now() - 1000);
      }

      expect(() => {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      }).toThrow('Link has expired.');

      try {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      } catch (err: any) {
        expect(err.statusCode).toBe(410);
      }
    });

    test('completed order link rejection', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';
      const linkData = service.generateLocationLink(customerId, orderId, 10);

      // Complete order
      service.completeOrder(orderId);

      // Link becomes invalid/invalidated
      expect(() => {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      }).toThrow('Link has been invalidated because the order is completed.');

      try {
        service.submitPin(linkData.linkId, 12.345, 67.890);
      } catch (err: any) {
        expect(err.statusCode).toBe(410);
      }

      // Trying to generate a link for an already completed order should also fail
      expect(() => {
        service.generateLocationLink(customerId, orderId, 10);
      }).toThrow(`Cannot generate location link for already completed order: ${orderId}`);
    });

    test('rejection of invalid coordinates', () => {
      const customerId = 'cust-123';
      const orderId = 'order-456';
      const linkData = service.generateLocationLink(customerId, orderId, 10);

      // Latitude bounds check
      expect(() => service.submitPin(linkData.linkId, -91, 100)).toThrow('Invalid latitude. Latitude must be a number between -90 and 90.');
      expect(() => service.submitPin(linkData.linkId, 91, 100)).toThrow('Invalid latitude. Latitude must be a number between -90 and 90.');

      // Longitude bounds check
      expect(() => service.submitPin(linkData.linkId, 45, -181)).toThrow('Invalid longitude. Longitude must be a number between -180 and 180.');
      expect(() => service.submitPin(linkData.linkId, 45, 181)).toThrow('Invalid longitude. Longitude must be a number between -180 and 180.');

      // Check NaN / Type
      expect(() => service.submitPin(linkData.linkId, NaN, 100)).toThrow('Invalid latitude');
      expect(() => service.submitPin(linkData.linkId, 45, NaN)).toThrow('Invalid longitude');
    });

    test('manual text-address fallback path', () => {
      const customerId = 'cust-fallback';
      const orderId = 'order-fallback';

      // Marketer sets manual text fallback
      service.setManualTextAddress(customerId, orderId, '123 Fake Street, Springfield');

      // Verify that manual text fallback does not pollute or touch persistent GPS pin record
      expect(service.getCustomerAddress(customerId)).toBeNull();

      // Retrieve manual text fallback address
      const fallbacks = service.getManualTextAddresses(customerId, orderId);
      expect(fallbacks.length).toBe(1);
      expect(fallbacks[0].addressText).toBe('123 Fake Street, Springfield');
      expect(fallbacks[0].customerId).toBe(customerId);
      expect(fallbacks[0].orderId).toBe(orderId);
    });
  });

  describe('Express Router Endpoints (POST /location/:linkId)', () => {
    test('POST /location/:linkId success path', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Location pin submitted successfully.',
        customerId: 'cust-express',
        orderId: 'order-express',
      });

      // Verify persistency
      const address = service.getCustomerAddress('cust-express');
      expect(address).not.toBeNull();
      expect(address!.latitude).toBe(35.6762);
      expect(address!.longitude).toBe(139.6503);
    });

    test('POST /location/:linkId missing request body parameters', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Both latitude and longitude must be provided');
    });

    test('POST /location/:linkId non-existent link ID', async () => {
      const response = await request(app)
        .post('/location/non-existent-link-id')
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
      expect(response.body.message).toBe('Link not found.');
    });

    test('POST /location/:linkId expired link', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      // Manually expire it in store
      const storedLink = store.getLink(linkData.linkId);
      if (storedLink) {
        storedLink.expiresAt = new Date(Date.now() - 1000);
      }

      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Gone');
      expect(response.body.message).toBe('Link has expired.');
    });

    test('POST /location/:linkId already used link', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      // Use it once
      await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762, longitude: 139.6503 });

      // Use it twice
      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Gone');
      expect(response.body.message).toBe('Link has already been used.');
    });

    test('POST /location/:linkId completed order', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      service.completeOrder('order-express');

      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Gone');
      expect(response.body.message).toBe('Link has been invalidated because the order is completed.');
    });

    test('POST /location/:linkId invalid coordinate ranges', async () => {
      const linkData = service.generateLocationLink('cust-express', 'order-express', 10);

      const response = await request(app)
        .post(`/location/${linkData.linkId}`)
        .send({ latitude: 95.0, longitude: 139.6503 });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Invalid latitude');
    });
  });
});
