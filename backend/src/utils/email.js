const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'support@oov.digital';
const FROM_EMAIL = 'oov <notify@oov.digital>';

/**
 * Notify admin of a new affiliate application.
 * Uses Resend API if key is set, otherwise falls back to console log.
 */
export const notifyAffiliateApplication = async ({ code, name, email }) => {
  const subject = `[Affiliate] New application: ${code}`;
  const body = [
    `New affiliate application:`,
    ``,
    `Promo code:  ${code}`,
    `Name:        ${name}`,
    `Wise email:  ${email}`,
    ``,
    `Activate it:`,
    `UPDATE promo_codes SET is_active = true WHERE code = '${code}';`,
    ``,
    `Then email ${email} to let them know.`
  ].join('\n');

  if (!RESEND_API_KEY) {
    console.log('[Email] RESEND_API_KEY not set. Application details:\n' + body);
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject,
        text: body
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || res.statusText);
    }

    console.log('[Email] Affiliate notification sent to', ADMIN_EMAIL);
  } catch (err) {
    console.error('[Email] Resend failed:', err.message);
    console.log('[Email] Fallback — application details:\n' + body);
  }
};
