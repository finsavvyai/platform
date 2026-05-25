/**
 * Register a customer's hostname with Cloudflare Custom Hostnames.
 * This enables SSL and routing for the customer's domain to our proxy worker.
 */

interface CustomHostnameResult {
  success: boolean;
  hostname?: string;
  status?: string;
  verificationTxt?: string;
  error?: string;
}

export async function registerCustomHostname(
  hostname: string,
  cfApiToken: string,
  cfZoneId: string,
): Promise<CustomHostnameResult> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
          },
        },
      }),
    },
  );

  const data = (await res.json()) as {
    success: boolean;
    result?: {
      id: string;
      hostname: string;
      status: string;
      verification_errors?: string[];
      ssl?: { txt_name?: string; txt_value?: string; status: string };
    };
    errors?: { message: string }[];
  };

  if (!data.success) {
    const msg = data.errors?.[0]?.message ?? 'Failed to register hostname';
    return { success: false, error: msg };
  }

  const result = data.result!;
  const txtName = result.ssl?.txt_name;
  const txtValue = result.ssl?.txt_value;
  const verificationTxt = txtName && txtValue
    ? `${txtName} TXT ${txtValue}`
    : undefined;

  return {
    success: true,
    hostname: result.hostname,
    status: result.status,
    verificationTxt,
  };
}

export async function deleteCustomHostname(
  hostname: string,
  cfApiToken: string,
  cfZoneId: string,
): Promise<void> {
  // Find the custom hostname ID first
  const listRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames?hostname=${hostname}`,
    { headers: { Authorization: `Bearer ${cfApiToken}` } },
  );

  const listData = (await listRes.json()) as {
    result?: { id: string }[];
  };

  const id = listData.result?.[0]?.id;
  if (!id) return;

  await fetch(
    `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/custom_hostnames/${id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${cfApiToken}` },
    },
  );
}

/**
 * Generate DNS instructions based on the customer's likely hosting provider.
 */
export function getDnsInstructions(hostname: string): {
  cname: string;
  providers: { name: string; instructions: string }[];
} {
  const target = 'tokenforge-proxy.broad-dew-49ad.workers.dev';

  return {
    cname: `${hostname} CNAME ${target}`,
    providers: [
      {
        name: 'Cloudflare',
        instructions: `DNS → Add Record → Type: CNAME, Name: ${hostname.split('.')[0]}, Target: ${target}, Proxy: ON`,
      },
      {
        name: 'Vercel',
        instructions: `Settings → Domains → Add "${hostname}" → Set CNAME to ${target}`,
      },
      {
        name: 'AWS Route53',
        instructions: `Hosted Zone → Create Record → Type: CNAME, Name: ${hostname}, Value: ${target}`,
      },
      {
        name: 'GoDaddy',
        instructions: `DNS Management → Add Record → Type: CNAME, Host: ${hostname.split('.')[0]}, Points to: ${target}`,
      },
      {
        name: 'Namecheap',
        instructions: `Advanced DNS → Add Record → Type: CNAME, Host: ${hostname.split('.')[0]}, Value: ${target}`,
      },
    ],
  };
}
