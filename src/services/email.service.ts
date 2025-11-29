import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
  const port = parseInt(process.env.SMTP_PORT || '465');
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'mail.digistore1.com',
    port: port,
    secure: secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Email templates
const getBaseTemplate = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #000 0%, #dc2626 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 14px 28px; background: #dc2626; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600; }
    .button:hover { background: #b91c1c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Digistore1</h1>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Digistore1. All rights reserved.</p>
      <p>Digital Products Marketplace</p>
    </div>
  </div>
</body>
</html>
`;

// Send verification email
export const sendVerificationEmail = async (email: string, name: string, token: string) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const content = `
    <h2>Welcome to Digistore1, ${name}!</h2>
    <p>Thank you for creating an account. Please verify your email address to get started.</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" class="button">Verify Email Address</a>
    </p>
    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color: #666; font-size: 12px; word-break: break-all;">${verifyUrl}</p>
    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
  `;

  const transporter = createTransporter();
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Digistore1 <noreply@digistore1.com>',
    to: email,
    subject: 'Verify Your Email - Digistore1',
    html: getBaseTemplate(content),
  });
};

// Send password reset email
export const sendPasswordResetEmail = async (email: string, name: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const content = `
    <h2>Password Reset Request</h2>
    <p>Hi ${name},</p>
    <p>We received a request to reset your password. Click the button below to create a new password:</p>
    <p style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
  `;

  const transporter = createTransporter();
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Digistore1 <noreply@digistore1.com>',
    to: email,
    subject: 'Reset Your Password - Digistore1',
    html: getBaseTemplate(content),
  });
};

// Send order confirmation email
export const sendOrderConfirmationEmail = async (
  email: string,
  name: string,
  order: {
    id: string;
    total: number;
    currency: string;
    items: Array<{
      title: string;
      price: number;
      quantity: number;
      license: string;
    }>;
  }
) => {
  const orderUrl = `${process.env.FRONTEND_URL}/account?tab=orders`;
  
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.title}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.license}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${order.currency} ${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  const content = `
    <h2>Order Confirmed! 🎉</h2>
    <p>Hi ${name},</p>
    <p>Thank you for your purchase! Your order has been confirmed and your digital products are ready for download.</p>
    
    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0 0 10px;"><strong>Order ID:</strong> ${order.id}</p>
      <p style="margin: 0;"><strong>Total:</strong> ${order.currency} ${order.total.toFixed(2)}</p>
    </div>

    <h3>Order Items</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f5f5f5;">
          <th style="padding: 12px; text-align: left;">Product</th>
          <th style="padding: 12px; text-align: center;">License</th>
          <th style="padding: 12px; text-align: center;">Qty</th>
          <th style="padding: 12px; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <p style="text-align: center; margin: 30px 0;">
      <a href="${orderUrl}" class="button">View Order & Download</a>
    </p>
    
    <p style="color: #666; font-size: 14px;">Your download links are available in your account for 7 days.</p>
  `;

  const transporter = createTransporter();
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Digistore1 <noreply@digistore1.com>',
    to: email,
    subject: `Order Confirmed - ${order.id} - Digistore1`,
    html: getBaseTemplate(content),
  });
};

