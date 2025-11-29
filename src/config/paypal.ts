import axios from 'axios';

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' 
  ? 'https://api-m.paypal.com' 
  : 'https://api-m.sandbox.paypal.com';

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

// Get PayPal access token
export const getPayPalAccessToken = async (): Promise<string> => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured');
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post(
    `${PAYPAL_API}/v1/oauth2/token`,
    'grant_type=client_credentials',
    {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  return response.data.access_token;
};

// Create PayPal order
export const createPayPalOrder = async (
  amount: number,
  currency: string = 'USD',
  items: Array<{
    name: string;
    quantity: number;
    unit_amount: number;
  }>
) => {
  const accessToken = await getPayPalAccessToken();

  const itemTotal = items.reduce((sum, item) => sum + (item.unit_amount * item.quantity), 0);

  const response = await axios.post(
    `${PAYPAL_API}/v2/checkout/orders`,
    {
      intent: 'CAPTURE',
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
            breakdown: {
              item_total: {
                currency_code: currency,
                value: itemTotal.toFixed(2),
              },
            },
          },
          items: items.map(item => ({
            name: item.name.substring(0, 127), // PayPal limit
            quantity: item.quantity.toString(),
            unit_amount: {
              currency_code: currency,
              value: item.unit_amount.toFixed(2),
            },
            category: 'DIGITAL_GOODS',
          })),
        },
      ],
      application_context: {
        brand_name: 'Digistore1',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/checkout/success`,
        cancel_url: `${process.env.FRONTEND_URL}/checkout`,
      },
    },
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// Capture PayPal payment
export const capturePayPalPayment = async (orderId: string) => {
  const accessToken = await getPayPalAccessToken();

  const response = await axios.post(
    `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return response.data;
};

// Verify PayPal webhook signature
export const verifyPayPalWebhook = async (
  webhookId: string,
  eventBody: any,
  headers: any
): Promise<boolean> => {
  try {
    const accessToken = await getPayPalAccessToken();

    const response = await axios.post(
      `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
      {
        auth_algo: headers['paypal-auth-algo'],
        cert_url: headers['paypal-cert-url'],
        transmission_id: headers['paypal-transmission-id'],
        transmission_sig: headers['paypal-transmission-sig'],
        transmission_time: headers['paypal-transmission-time'],
        webhook_id: webhookId,
        webhook_event: eventBody,
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.verification_status === 'SUCCESS';
  } catch (error) {
    console.error('PayPal webhook verification failed:', error);
    return false;
  }
};

export { PAYPAL_API };

