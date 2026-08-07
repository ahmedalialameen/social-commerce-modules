import axios from 'axios';
import { getWhatsAppConfig, TemplateRegistry, WhatsAppConfig } from './config';

export interface SendMessageOptions {
  /**
   * Overrides the language code for the template (defaults to the configured default, e.g., 'en_US').
   */
  languageCode?: string;
  /**
   * Custom configuration to override standard environment variables.
   * Useful for supporting multiple WhatsApp Business Accounts or dynamic tenant setups.
   */
  configOverride?: Partial<WhatsAppConfig>;
}

export interface WhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
    message_status?: string;
  }>;
}

/**
 * Sends a templated WhatsApp message using the Meta WhatsApp Cloud API.
 *
 * @param templateName The name/ID of the template registered in WhatsApp Business Manager.
 * @param recipientPhoneNumber The recipient's phone number in E.164 format (e.g. "+15550199").
 * @param parameters A key-value map of parameters to substitute into the template body.
 * @param options Additional messaging options like custom config overrides or language code.
 * @returns The parsed API response.
 */
export async function sendWhatsAppMessage(
  templateName: string,
  recipientPhoneNumber: string,
  parameters: Record<string, string | number>,
  options: SendMessageOptions = {}
): Promise<WhatsAppApiResponse> {
  // Retrieve config and apply overrides if specified
  const baseConfig = getWhatsAppConfig();
  const config: WhatsAppConfig = {
    ...baseConfig,
    ...options.configOverride,
  };

  const language = options.languageCode || config.defaultLanguage;

  // Clean the recipient phone number: WhatsApp expects a clean numeric string (no spaces, +, dashes)
  // e.g., '+1 555-1234' becomes '15551234'
  const cleanTo = recipientPhoneNumber.replace(/\D/g, '');
  if (!cleanTo) {
    throw new Error(`Invalid recipient phone number: ${recipientPhoneNumber}`);
  }

  // Get positional mapping for template parameters
  const expectedKeys = TemplateRegistry.getTemplateKeys(templateName);
  let orderedParamValues: string[] = [];

  if (!expectedKeys) {
    throw new Error(
      `Template "${templateName}" is not registered in TemplateRegistry. Register it first using TemplateRegistry.registerTemplate() before sending.`
    );
  }

  // Standard path: mapping keys sequentially using registered order
  for (const key of expectedKeys) {
    if (!(key in parameters)) {
      throw new Error(
        `Missing required parameter "${key}" for template "${templateName}". Expected parameters: ${expectedKeys.join(', ')}`
      );
    }
    orderedParamValues.push(String(parameters[key]));
  }

  // Build the Meta WhatsApp Cloud API template components structure
  // WhatsApp parameters inside components must be objects of shape { type: 'text', text: 'value' }
  const formattedParams = orderedParamValues.map((val) => ({
    type: 'text',
    text: val,
  }));

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanTo,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: language,
      },
      components: formattedParams.length > 0 ? [
        {
          type: 'body',
          parameters: formattedParams,
        },
      ] : [],
    },
  };

  const url = `${config.apiBaseUrl}/${config.phoneNumberId}/messages`;

  try {
    const response = await axios.post<WhatsAppApiResponse>(
      url,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    // Enhance error output for easier debugging of Meta API rejections
    if (error.response && error.response.data) {
      const apiError = error.response.data.error;
      const details = apiError ? `${apiError.message} (code: ${apiError.code}, subcode: ${apiError.error_subcode})` : JSON.stringify(error.response.data);
      throw new Error(`WhatsApp API call failed: ${details}`);
    }
    throw new Error(`WhatsApp API call failed: ${error.message}`);
  }
}
