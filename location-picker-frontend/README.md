# Google Maps Location Picker Frontend

This is a lightweight, mobile-friendly, standalone location picker frontend designed for customers to select their precise delivery coordinates. It pairs with the `location-capture` backend module.

The frontend is loaded by the customer via a secure, single-use WhatsApp link, allowing them to place a precise pin on the map and confirm their coordinates.

---

## Features

- **Mobile First Design:** Large click/tap targets, optimized layouts, greedy map gesture controls, and clean modern aesthetic perfect for small touchscreens.
- **Interactive Map:** Displays Google Maps. Allows customers to tap/click on the map or drag-and-drop the marker to specify their exact address.
- **Browser Geolocation:** Includes a "Use My Current Location" button leveraging the native HTML5 Geolocation API to auto-center and place the pin instantly.
- **Status Overlay System:** Intuitive UI messaging for API request states (Submitting loader, Success, Invalid Coordinates (400), Link Invalid (404), Link Expired (410), and Network Connectivity errors), rather than raw JSON/stack dumps.
- **Smart Fallback/Demo Mode:** If loaded without a configured Google Maps API key (i.e. left as `"REPLACE WITH YOUR API KEY"`), it enters a legitimate local demo mode with an interactive mock fallback map for offline testing and visual verification.
- **Reliable Failure Detection (No Silent Fallback):** Real-world load failures (e.g., script load errors due to network drops, bad API keys, domain restrictions, or runtime exceptions) do *not* silently fall back to the mock map. Instead, they trigger a full-screen, non-dismissible load error state with a **Reload Page** button, preventing customers from placing or submitting inaccurate coordinates.

---

## Setup & Configuration

### 1. Obtain a Google Maps API Key

To load the interactive map, you need a Google Maps JavaScript API key.

#### Production Cloud Console Key:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Search for and enable the **Maps JavaScript API**.
4. Go to **APIs & Services > Credentials** and click **Create Credentials > API Key**.
5. *Highly Recommended for Production:* Restrict the API key to HTTP Referrers matching your production domain to prevent unauthorized quota usage.

#### Free Testing / Developer Demo Mode:
- If you don't have an active Cloud Console billing account, you can also test or run local visual checks using a Google Maps "Demo Key" (available through Google Maps Platform quickstarts) or simply let the frontend fall back to its visual demo mock-up map.

### 2. Insert the Key in `index.html`

Open `location-picker-frontend/index.html` and locate the configuration block at the top of the `<script>` tag:

```javascript
// ==========================================
// CONFIGURATION
// ==========================================
const GOOGLE_MAPS_API_KEY = "REPLACE WITH YOUR API KEY";
const API_BASE_URL = ""; // Empty string for relative calls, or absolute path like "http://localhost:3000"
```

Replace `"REPLACE WITH YOUR API KEY"` with your actual Google Maps API key:

```javascript
const GOOGLE_MAPS_API_KEY = "AIzaSyD_Your_Actual_API_Key_Here";
```

You can also configure `API_BASE_URL` to point directly to your hosted `location-capture` microservice if they are hosted on different subdomains/domains (ensure appropriate CORS headers are configured on the Express backend).

---

## How It Is Meant To Be Used

This page acts as a standalone static frontend. The `location-capture` backend service generates unique links for orders.

1. **Link Generation:**
   The backend service creates a link such as:
   `https://yourdeliverydomain.com/capture.html?linkId=abc123`
   where `abc123` represents the unique, single-use `linkId`.

2. **Customer Interaction:**
   - The user opens the link on their mobile device.
   - The frontend parses the `linkId` query parameter from the URL (`?linkId=abc123`).
   - The user places their pin using tap/click or "Use My Current Location".
   - Clicking **Confirm Location** triggers a `POST` request to:
     `POST {API_BASE_URL}/location/{linkId}`
     with a JSON body containing the precise coordinate payload:
     ```json
     {
       "latitude": 15.5007,
       "longitude": 32.5599
     }
     ```

3. **Response Handling:**
   The page interprets and presents human-readable screens matching standard backend statuses:
   - `200 OK`: Green success confirmation page ("Location Confirmed!").
   - `410 Gone`: Expired/used link warning ("Link Expired").
   - `404 Not Found`: Link not found warning ("Invalid Link").
   - `400 Bad Request`: Incorrect coordinates range warning.
