import { LocationLink, CustomerAddress, ManualTextAddress } from './types';

export class LocationCaptureStore {
  // In-memory maps
  private links = new Map<string, LocationLink>();
  private customerAddresses = new Map<string, CustomerAddress>();
  private manualTextAddresses = new Map<string, ManualTextAddress[]>();
  private completedOrders = new Set<string>();

  // Clean / helper for testing
  public clear(): void {
    this.links.clear();
    this.customerAddresses.clear();
    this.manualTextAddresses.clear();
    this.completedOrders.clear();
  }

  // Links operations
  public saveLink(link: LocationLink): void {
    this.links.set(link.linkId, link);
  }

  public getLink(linkId: string): LocationLink | null {
    return this.links.get(linkId) || null;
  }

  public getLinksForOrder(orderId: string): LocationLink[] {
    const results: LocationLink[] = [];
    for (const link of this.links.values()) {
      if (link.orderId === orderId) {
        results.push(link);
      }
    }
    return results;
  }

  // Persistent address record operations
  public saveCustomerAddress(address: CustomerAddress): void {
    this.customerAddresses.set(address.customerId, address);
  }

  public getCustomerAddress(customerId: string): CustomerAddress | null {
    return this.customerAddresses.get(customerId) || null;
  }

  // Manual fallback text address operations
  public saveManualTextAddress(manualAddress: ManualTextAddress): void {
    const key = `${manualAddress.customerId}:${manualAddress.orderId}`;
    let list = this.manualTextAddresses.get(key);
    if (!list) {
      list = [];
      this.manualTextAddresses.set(key, list);
    }
    list.push(manualAddress);
  }

  public getManualTextAddresses(customerId: string, orderId: string): ManualTextAddress[] {
    const key = `${customerId}:${orderId}`;
    return this.manualTextAddresses.get(key) || [];
  }

  // Completed Orders operations
  public markOrderComplete(orderId: string): void {
    this.completedOrders.add(orderId);
    // Invalidate any links associated with this order
    const links = this.getLinksForOrder(orderId);
    for (const link of links) {
      link.invalidated = true;
    }
  }

  public isOrderComplete(orderId: string): boolean {
    return this.completedOrders.has(orderId);
  }
}

// Export a singleton instance for default usage, but allow constructing new ones
export const defaultStore = new LocationCaptureStore();
