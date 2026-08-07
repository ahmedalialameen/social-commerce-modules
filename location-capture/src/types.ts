export interface LocationLink {
  linkId: string;
  customerId: string;
  orderId: string;
  url: string;
  expiresAt: Date;
  used: boolean;
  invalidated: boolean; // marked true if order is completed before the link is used
}

export interface CustomerAddress {
  customerId: string;
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

export interface ManualTextAddress {
  customerId: string;
  orderId: string;
  addressText: string;
  createdAt: Date;
}
