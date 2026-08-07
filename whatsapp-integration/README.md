# WhatsApp Business API Integration Module

A standalone, reusable, production-ready WhatsApp Business Cloud API (Meta's official Platform API) integration module written in TypeScript/Node.js.

This module is designed to be fully self-contained, allowing you to easily drop it into a monorepo or import it into any larger Node.js/TypeScript application. Swapping between Sandbox and Production environments requires **zero code changes**—only updating environment variables.

---

## Features

- **Template Message Abstraction:** Generic `sendWhatsAppMessage` function mapping structured key-value parameters to the positional parameters required by Meta's WhatsApp Business Platform.
- **Pre-Registered Standard Templates:** Built-in parameter ordering for standard operations:
  - `order_confirmation`: Mapped to `['orderId', 'productName', 'deliveryPinOrLink']`
  - `shipment_update`: Mapped to `['trackingStatus', 'estimatedDelivery']`
  - `payment_confirmed`: Mapped to `['amountConfirmed', 'orderId']`
- **Extensible & Dynamically Customizable:** Support for custom template registration at runtime via `TemplateRegistry.registerTemplate(...)`.
- **Express.js Webhook Router:** Robust webhook receiver that supports Meta's `GET /webhook` handshake verification and captures status callback events (`sent`, `delivered`, `read`, `failed`) into a thread-safe, in-memory log list.
- **Robust Error Handling:** Intercepts and parses Meta API error codes/subcodes and translates them into developer-friendly error messages.
- **Full Test Suite:** 15 unit/integration tests with 100% mocked dependencies for safe testing.

---

## Directory Structure

```text
whatsapp-integration/
├── dist/                # Compiled JavaScript & Type declaration files
├── src/
│   ├── config.ts        # Configuration manager & Template mapping registry
│   ├── sender.ts        # sendWhatsAppMessage implementation
│   ├── webhook.ts       # Express Webhook GET handshake & POST status updates
│   └── index.ts         # Central entrypoint exporting all modules
├── tests/
│   ├── sender.test.ts   # Mocked unit tests for message sending & validations
│   └── webhook.test.ts  # Webhook handshake & event callback supertest tests
├── .env.example         # Template for environment configurations
├── tsconfig.json        # TypeScript compilation settings
├── jest.config.js       # Jest testing configuration
└── package.json         # Module scripts and dependencies
```

---

## Installation & Setup

Navigate into the integration folder and install dependencies:

```bash
cd whatsapp-integration
npm install
```

### Development Scripts

- **Run Tests:** `npm test`
- **Build / Compile Typescript:** `npm run build`
- **TypeScript Typecheck:** `npm run typecheck`

---

## Configuration & Sandbox Setup

To test against the Meta WhatsApp Cloud API Sandbox, follow these steps:

### 1. Create a Meta Developer Account & App
1. Go to [Meta for Developers](https://developers.facebook.com/) and register.
2. Create a new app (Select **Other** -> **Business** app type).
3. Under the app dashboard, find **WhatsApp** and click **Set up**.

### 2. Configure Sandbox Settings
1. Go to the WhatsApp **API Setup** page.
2. You will see a temporary **Access Token** and a **Phone Number ID**.
3. In the **To** field, add your own personal WhatsApp phone number to the sandbox recipient allowlist, and follow the validation steps on your phone.

### 3. Setup Local Environment Variables
Create a `.env` file in the root of your application (or copy `.env.example`) and fill in your sandbox credentials:

```env
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0
WHATSAPP_PHONE_NUMBER_ID=123456789012345  # From Meta App Dashboard
WHATSAPP_ACCESS_TOKEN=EAAG...             # Temporary or Permanent Access Token
WHATSAPP_VERIFY_TOKEN=my_secure_secret_token_123 # Choose your own secret string
WHATSAPP_TEMPLATE_DEFAULT_LANG=en_US
```

---

## Usage Guide

### 1. Sending Messages

Import and call `sendWhatsAppMessage`. The mapping registry handles arranging the parameters in the exact sequential order defined on Meta.

```typescript
import { sendWhatsAppMessage } from './whatsapp-integration/src';

// Example 1: Order Confirmation (built-in template)
async function sendOrderConf() {
  try {
    const response = await sendWhatsAppMessage(
      'order_confirmation', // Template name registered on Meta
      '+15550199000',      // Recipient phone number in E.164 format
      {
        orderId: 'ORD-12345',
        productName: 'Self-Cleaning Water Bottle',
        deliveryPinOrLink: 'https://myshop.com/pin/5590'
      }
    );
    console.log('Message sent successfully:', response);
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}

// Example 2: Dynamically registering custom templates
import { TemplateRegistry } from './whatsapp-integration/src';

TemplateRegistry.registerTemplate('account_created', ['username', 'referralBonus']);

async function sendCustomWelcome() {
  await sendWhatsAppMessage(
    'account_created',
    '+15550199000',
    {
      username: 'johndoe',
      referralBonus: '$10'
    }
  );
}
```

### 2. Webhook Setup & Handling

Mount the provided webhook router inside your Express application:

```typescript
import express from 'express';
import { createWebhookRouter, getStatusLogs } from './whatsapp-integration/src';

const app = express();
app.use(express.json());

// Mount the webhook router under /whatsapp-webhook
// This creates GET /whatsapp-webhook/webhook and POST /whatsapp-webhook/webhook
app.use('/whatsapp-webhook', createWebhookRouter());

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
```

#### Local Webhook Testing with Ngrok
1. Expose your local port 3000 to the public:
   ```bash
   ngrok http 3000
   ```
2. Copy the public HTTPS URL from ngrok (e.g. `https://a1b2-34-56-78.ngrok-free.app`).
3. Go to the Meta Developer Dashboard under **WhatsApp** -> **Configuration**.
4. Set the **Callback URL** to `https://a1b2-34-56-78.ngrok-free.app/whatsapp-webhook/webhook`.
5. Set the **Verify Token** to the exact value of `WHATSAPP_VERIFY_TOKEN` defined in your `.env` file (e.g. `my_secure_secret_token_123`).
6. Click **Verify and Save**. Meta will execute a GET request to verify your router.
7. Under **Webhook fields**, click **Manage** and subscribe to **messages** events to start receiving status callback logs.

---

## Moving to Production

Transitioning from Sandbox to a Live Production environment requires **zero code modifications**. Only configuration values in your environment variables need to change.

### Checklist for Production:
1. **Change Credentials in `.env`:**
   - Swap `WHATSAPP_PHONE_NUMBER_ID` with your verified permanent Phone Number ID.
   - Swap `WHATSAPP_ACCESS_TOKEN` with a **Permanent System User Access Token** generated in your Facebook Business Manager (the temporary developer token expires in 24 hours).
2. **Template Name Alignment:**
   - Ensure the template names you pass (e.g., `'order_confirmation'`) match the exact approved template names in your production Meta Business Manager account.
   - Register any custom production templates using `TemplateRegistry.registerTemplate('prod_template_name', ['ordered_field_1', 'ordered_field_2'])`.
3. **Register Verified Phone Numbers:**
   - Your production account will be able to send to any phone number without adding them to a sandbox recipient allowlist first.
4. **Update Webhook URL:**
   - Change your Webhook URL in Meta App Dashboard to your live production server endpoint (e.g., `https://api.yourdomain.com/whatsapp-webhook/webhook`).
