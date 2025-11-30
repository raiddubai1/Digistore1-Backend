import nodemailer from 'nodemailer';

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// Send newsletter welcome email
export const sendNewsletterWelcome = async (email: string, name?: string) => {
  const unsubscribeUrl = `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`;
  const displayName = name || 'there';

  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #000 0%, #dc2626 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Digistore1</h1>
    </div>
    <div class="content">
      <h2>Welcome to Our Newsletter! 🎉</h2>
      <p>Hi ${displayName}, thank you for subscribing to the Digistore1 newsletter!</p>
      <p>You'll be the first to know about:</p>
      <ul>
        <li>🆕 New digital products</li>
        <li>🏷️ Exclusive discounts and deals</li>
        <li>📢 Special announcements</li>
        <li>💡 Tips and tutorials</li>
      </ul>
      <p>Stay tuned for amazing content!</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Digistore1. All rights reserved.</p>
      <p><a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;

  const transporter = createTransporter();
  
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Digistore1 <noreply@digistore1.com>',
    to: email,
    subject: 'Welcome to Digistore1 Newsletter! 🎉',
    html: content,
  });
};

// Send promotional newsletter
export const sendPromotionalEmail = async (
  emails: string[],
  subject: string,
  title: string,
  body: string,
  ctaText?: string,
  ctaUrl?: string
) => {
  const transporter = createTransporter();

  const ctaHtml = ctaText && ctaUrl ? `
    <p style="text-align: center; margin: 30px 0;">
      <a href="${ctaUrl}" style="display: inline-block; padding: 14px 28px; background: #dc2626; color: white !important; text-decoration: none; border-radius: 8px; font-weight: 600;">${ctaText}</a>
    </p>
  ` : '';

  const content = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #000 0%, #dc2626 100%); padding: 30px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 28px; }
    .content { padding: 30px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Digistore1</h1>
    </div>
    <div class="content">
      <h2>${title}</h2>
      ${body}
      ${ctaHtml}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Digistore1. All rights reserved.</p>
      <p><a href="${process.env.FRONTEND_URL}/unsubscribe" style="color: #666;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `;

  // Send in batches to avoid rate limiting
  const batchSize = 50;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(email =>
        transporter.sendMail({
          from: process.env.EMAIL_FROM || 'Digistore1 <noreply@digistore1.com>',
          to: email,
          subject,
          html: content.replace('${unsubscribeUrl}', `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}`),
        }).catch(err => console.error(`Failed to send to ${email}:`, err))
      )
    );

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
};

