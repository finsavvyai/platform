/**
 * Invitation email service — split from email.ts to respect 200-line limit.
 */

interface SendInvitationOpts {
  to: string;
  orgName: string;
  role: string;
  token: string;
  apiKey: string;
}

export async function sendInvitationEmail({
  to,
  orgName,
  role,
  token,
  apiKey,
}: SendInvitationOpts): Promise<void> {
  const acceptUrl = `https://opensyber.cloud/invitations/${token}/accept`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'OpenSyber <noreply@opensyber.cloud>',
      to: [to],
      subject: `You've been invited to ${orgName} on OpenSyber`,
      html: `<p>You've been invited to join <strong>${orgName}</strong> on OpenSyber as a <strong>${role}</strong>.</p>
<p><a href="${acceptUrl}">Accept Invitation</a></p>
<p>This invitation expires in 7 days.</p>
<p>— The OpenSyber Team</p>`,
    }),
  });

  if (!response.ok) {
    console.error('[Email] Failed to send invitation email:', await response.text());
  }
}
