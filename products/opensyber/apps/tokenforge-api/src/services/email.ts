/**
 * Sends a payment-failure notification email via Resend.
 */
export async function sendPaymentFailedEmail(
  apiKey: string,
  tenantName: string,
): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'TokenForge <billing@tokenforge.opensyber.cloud>',
      to: 'billing@tokenforge.opensyber.cloud',
      subject: `Payment failed for ${tenantName}`,
      text: `Payment failed for tenant "${tenantName}". A 7-day grace period has been applied.`,
    }),
  });
}
