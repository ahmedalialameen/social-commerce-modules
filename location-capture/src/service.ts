import { LocationCaptureStore, defaultStore } from './store';
import { LocationLink, CustomerAddress, ManualTextAddress } from './types';

// Simple unique ID generator to keep module self-contained (no external uuid dependency required unless preferred)
function generateUniqueId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Validation helper for latitude and longitude
export function validateCoordinates(latitude: number, longitude: number): void {
  if (typeof latitude !== 'number' || isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Invalid latitude. Latitude must be a number between -90 and 90.');
  }
  if (typeof longitude !== 'number' || isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Invalid longitude. Longitude must be a number between -180 and 180.');
  }
}

export class LocationCaptureService {
  private store: LocationCaptureStore;
  private baseUrl: string;

  constructor(store: LocationCaptureStore = defaultStore, baseUrl: string = 'https://example.com/capture') {
    this.store = store;
    this.baseUrl = baseUrl;
  }

  /**
   * Generates a single-use expiring location link.
   * Each link is tied to one specific order and customer.
   */
  public generateLocationLink(
    customerId: string,
    orderId: string,
    expiresInMinutes: number = 15
  ): { linkId: string; url: string; expiresAt: Date } {
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      throw new Error('Missing or invalid customerId.');
    }
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      throw new Error('Missing or invalid orderId.');
    }
    if (expiresInMinutes <= 0) {
      throw new Error('Expiration duration must be greater than zero.');
    }

    // Check if the order is already marked complete. If so, throw/reject.
    if (this.store.isOrderComplete(orderId)) {
      throw new Error(`Cannot generate location link for already completed order: ${orderId}`);
    }

    const linkId = generateUniqueId();
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
    const url = `${this.baseUrl}/${linkId}`;

    const link: LocationLink = {
      linkId,
      customerId,
      orderId,
      url,
      expiresAt,
      used: false,
      invalidated: false,
    };

    this.store.saveLink(link);

    return {
      linkId,
      url,
      expiresAt,
    };
  }

  /**
   * Marks an order as complete, invalidating any active links for this order immediately.
   */
  public completeOrder(orderId: string): void {
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      throw new Error('Missing or invalid orderId.');
    }
    this.store.markOrderComplete(orderId);
  }

  /**
   * Submits a pin location for a given link ID.
   * Validates the link (existence, expiration, used, order completed),
   * updates persistent customer address record, and marks link as used.
   */
  public submitPin(linkId: string, latitude: number, longitude: number): { customerId: string; orderId: string } {
    if (!linkId || typeof linkId !== 'string' || linkId.trim() === '') {
      throw new Error('Missing or invalid linkId.');
    }

    validateCoordinates(latitude, longitude);

    const link = this.store.getLink(linkId);
    if (!link) {
      const err = new Error('Link not found.');
      (err as any).statusCode = 404;
      throw err;
    }

    if (link.used) {
      const err = new Error('Link has already been used.');
      (err as any).statusCode = 410;
      throw err;
    }

    if (link.invalidated || this.store.isOrderComplete(link.orderId)) {
      link.invalidated = true; // Sync state
      const err = new Error('Link has been invalidated because the order is completed.');
      (err as any).statusCode = 410;
      throw err;
    }

    if (Date.now() > link.expiresAt.getTime()) {
      const err = new Error('Link has expired.');
      (err as any).statusCode = 410;
      throw err;
    }

    // Persist GPS address against customer record
    this.saveCustomerAddress(link.customerId, latitude, longitude);

    // Mark link as used
    link.used = true;

    return {
      customerId: link.customerId,
      orderId: link.orderId,
    };
  }

  /**
   * Saves a customer persistent address record.
   */
  public saveCustomerAddress(customerId: string, latitude: number, longitude: number): void {
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      throw new Error('Missing or invalid customerId.');
    }

    validateCoordinates(latitude, longitude);

    const address: CustomerAddress = {
      customerId,
      latitude,
      longitude,
      lastUpdated: new Date(),
    };

    this.store.saveCustomerAddress(address);
  }

  /**
   * Retrieves a customer's persistent address record.
   */
  public getCustomerAddress(customerId: string): { latitude: number; longitude: number; lastUpdated: Date } | null {
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      throw new Error('Missing or invalid customerId.');
    }

    const address = this.store.getCustomerAddress(customerId);
    if (!address) {
      return null;
    }

    return {
      latitude: address.latitude,
      longitude: address.longitude,
      lastUpdated: address.lastUpdated,
    };
  }

  /**
   * Prefills address for a new link using the customer's last saved address.
   */
  public getPrefilledAddressForNewLink(customerId: string): { latitude: number; longitude: number; lastUpdated: Date } | null {
    return this.getCustomerAddress(customerId);
  }

  /**
   * Fallback text-address that a marketer can call to bypass the pin entirely for a specific order,
   * without invalidating the customer's stored GPS pin (if one exists) for future orders.
   */
  public setManualTextAddress(customerId: string, orderId: string, addressText: string): void {
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      throw new Error('Missing or invalid customerId.');
    }
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      throw new Error('Missing or invalid orderId.');
    }
    if (!addressText || typeof addressText !== 'string' || addressText.trim() === '') {
      throw new Error('Missing or invalid addressText.');
    }

    const manualAddress: ManualTextAddress = {
      customerId,
      orderId,
      addressText,
      createdAt: new Date(),
    };

    this.store.saveManualTextAddress(manualAddress);
  }

  /**
   * Helper to retrieve any manual text fallback address set for a specific customer and order.
   */
  public getManualTextAddresses(customerId: string, orderId: string): ManualTextAddress[] {
    if (!customerId || typeof customerId !== 'string' || customerId.trim() === '') {
      throw new Error('Missing or invalid customerId.');
    }
    if (!orderId || typeof orderId !== 'string' || orderId.trim() === '') {
      throw new Error('Missing or invalid orderId.');
    }
    return this.store.getManualTextAddresses(customerId, orderId);
  }
}
