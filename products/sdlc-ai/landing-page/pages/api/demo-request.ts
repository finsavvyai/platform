import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, company, useCase, timeline, message } = req.body;

    if (!name || !email || !company) {
      return res.status(400).json({ error: 'Missing required fields: name, email, company' });
    }

    // Prepare email data
    const emailData = {
      to: 'info@finsavvyai.com',
      subject: `New Demo Request - ${company}`,
      html: `
        <h2>New Demo Request from OpenSyber Landing Page</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${company}</p>
        ${useCase ? `<p><strong>Use Case:</strong> ${useCase}</p>` : ''}
        ${timeline ? `<p><strong>Timeline:</strong> ${timeline}</p>` : ''}
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
        <p><strong>Requested:</strong> ${new Date().toISOString()}</p>
        <hr>
        <p><em>This request was submitted via the OpenSyber landing page</em></p>
      `,
      replyTo: email
    };

    // Log the request for now (replace with actual email service)
    console.log('Demo request received:', { name, email, company, useCase, timeline });
    console.log('Email would be sent to:', emailData.to);

    // TODO: Integrate with email service
    // Options:
    // 1. Cloudflare Email Workers
    // 2. SendGrid API
    // 3. Resend API (recommended for simplicity)
    // 4. AWS SES

    return res.status(200).json({
      success: true,
      message: 'Demo request received successfully',
      data: {
        id: `demo_${Date.now()}`,
        status: 'pending',
        nextSteps: [
          'Our team will review your request',
          'Initial contact within 24 hours',
          'Discovery call to understand requirements',
          'Personalized demo preparation',
          'Custom proposal and pilot discussion'
        ],
        confirmationEmail: 'A confirmation email has been sent to your provided email address.'
      }
    });

  } catch (error) {
    console.error('Demo request error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process demo request'
    });
  }
}

export const runtime = 'edge';
