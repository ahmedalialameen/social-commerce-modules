# Location Capture Module

A self-contained, standalone TypeScript/Node.js module to securely capture customer GPS locations using single-use expiring links, update persistent customer addresses, and support manual text fallback routes.

This module features zero assumptions about existing databases and stores all structures in-memory via robust `Map` models, with interfaces designed for future database swaps without changing public function signatures.

---

## Key Concepts

### 1. Link Lifecycle vs. Persistent Address
- **Single-Use, Expiring Links:** Generated link records are tied strictly to an `orderId` and a `customerId`. They expire after a given duration (default: 15 minutes) or become invalid immediately once used (a pin is successfully submitted), or when the associated order is marked complete—whichever comes first.
- **Persistent Address Storage:** The customer's actual GPS address record is decoupled from individual order link lifetimes. Once a customer successfully submits a pin, their persistent location profile is updated. When generating a link for a new order, you can prefill their coordinates using this persistent storage.
- **Text-Address Fallback:** Marketers or administrators can set manual text-fallback addresses for a given order (e.g. "123 Main St, Apt 4B"). Setting this does *not* invalidate or update the customer's stored GPS pins, keeping future automated workflows safe.

---

## Installation & Setup

1. Navigate to the module directory:
   ```bash
   cd location-capture
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run tests:
   ```bash
   npm test
   ```
4. Run compilation:
   ```bash
   npm run build
   ```

---

## Public API Reference

The module exposes core interfaces, a storage class, a management service, and an Express router.

### 1. `LocationCaptureService`
The primary class managing state actions and business logic.

#### `generateLocationLink(customerId: string, orderId: string, expiresInMinutes?: number)`
Generates a secure, temporary location-capture link.
- **Arguments:**
  - `customerId`: non-empty string.
  - `orderId`: non-empty string.
  - `expiresInMinutes` (optional, default: `15`): lifetime of the link.
- **Returns:** `{ linkId: string, url: string, expiresAt: Date }`
- **Throws:** Errors on invalid or empty IDs, or if the order is already marked complete.

#### `submitPin(linkId: string, latitude: number, longitude: number)`
Validates coordinates and single-use link validity, saves the customer's persistent GPS location, and marks the link as used.
- **Arguments:**
  - `linkId`: non-empty string.
  - `latitude`: number (`-90` to `90`).
  - `longitude`: number (`-180` to `180`).
- **Returns:** `{ customerId: string, orderId: string }`
- **Throws:** Defensively throws custom error objects with explicit HTTP-style status codes (`404` for missing links, `410` for expired, already used, or completed-order links).

#### `completeOrder(orderId: string)`
Marks an order as complete, invalidating any active links associated with this order immediately.

#### `getCustomerAddress(customerId: string)`
Retrieves the customer's stored persistent coordinate data.
- **Returns:** `{ latitude: number, longitude: number, lastUpdated: Date } | null`

#### `getPrefilledAddressForNewLink(customerId: string)`
Wraps persistent address fetching for use in pre-filling fields for a new order link.

#### `setManualTextAddress(customerId: string, orderId: string, addressText: string)`
Overrides/bypasses GPS pins for a specific order.
- **Does not affect** the customer's persistent GPS record.

---

### 2. Express Router (`createLocationCaptureRouter`)
Provides a ready-to-mount Express Router mapping standard location endpoints.

#### `POST /location/:linkId`
Accepts a JSON body containing `{ latitude: number, longitude: number }`.
- **Response status codes:**
  - `200 OK`: Pin successfully captured and processed.
  - `400 Bad Request`: Missing body params or invalid coordinate ranges.
  - `404 Not Found`: Link ID does not exist in store.
  - `410 Gone`: Link has expired, already been used, or associated order has been completed.

---

## Example Usage

```typescript
import express from 'express';
import {
  LocationCaptureService,
  LocationCaptureStore,
  createLocationCaptureRouter
} from 'location-capture';

// Initialize core store & service
const store = new LocationCaptureStore();
const service = new LocationCaptureService(store, 'https://my-app.com/capture');

// Set up Express
const app = express();
app.use(express.json());

// Mount the route (e.g. under /location)
app.use('/location', createLocationCaptureRouter(service));

// Link generation flow:
const { linkId, url, expiresAt } = service.generateLocationLink('customer_abc', 'order_999');
console.log(`Send this URL to the customer: ${url}`);
```
