import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file if it exists
dotenv.config();

export interface WhatsAppConfig {
  apiBaseUrl: string;
  phoneNumberId: string;
  accessToken: string;
  verifyToken: string;
  defaultLanguage: string;
}

/**
 * Loads and validates WhatsApp API configuration.
 * Throws a detailed error if any required environment variable is missing.
 */
export function getWhatsAppConfig(): WhatsAppConfig {
  const apiBaseUrl = process.env.WHATSAPP_API_BASE_URL || 'https://graph.facebook.com/v21.0';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || '';
  const defaultLanguage = process.env.WHATSAPP_TEMPLATE_DEFAULT_LANG || 'en_US';

  const missing: string[] = [];
  if (!phoneNumberId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
  if (!accessToken) missing.push('WHATSAPP_ACCESS_TOKEN');
  if (!verifyToken) missing.push('WHATSAPP_VERIFY_TOKEN');

  if (missing.length > 0) {
    throw new Error(
      `WhatsApp Business API configuration error: Missing required environment variable(s): ${missing.join(', ')}`
    );
  }

  return {
    apiBaseUrl,
    phoneNumberId,
    accessToken,
    verifyToken,
    defaultLanguage,
  };
}

/**
 * Registry to define the expected positional parameter order for WhatsApp message templates.
 * Since Meta's WhatsApp Cloud API uses positional parameters (e.g. {{1}}, {{2}}, etc.),
 * this registry maps key-value parameter names to their exact required positional index.
 */
export class TemplateRegistry {
  private static registry: Map<string, string[]> = new Map([
    [
      'order_confirmation',
      ['orderId', 'productName', 'deliveryPinOrLink'],
    ],
    [
      'shipment_update',
      ['trackingStatus', 'estimatedDelivery'],
    ],
    [
      'payment_confirmed',
      ['amountConfirmed', 'orderId'],
    ],
  ]);

  /**
   * Register a new template or override an existing parameter mapping.
   * @param templateName Name of the template (e.g., 'invoice_paid')
   * @param parameterKeys Order of keys in the parameters object (e.g., ['invoiceId', 'dueDate', 'amount'])
   */
  public static registerTemplate(templateName: string, parameterKeys: string[]): void {
    this.registry.set(templateName, parameterKeys);
  }

  /**
   * Get the registered parameter keys for a given template name.
   * Returns undefined if the template is not registered.
   */
  public static getTemplateKeys(templateName: string): string[] | undefined {
    return this.registry.get(templateName);
  }

  /**
   * Removes a template from the registry.
   */
  public static removeTemplate(templateName: string): boolean {
    return this.registry.delete(templateName);
  }

  /**
   * Get all registered templates and their parameter structures.
   */
  public static getAllTemplates(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [key, val] of this.registry.entries()) {
      result[key] = val;
    }
    return result;
  }
}
