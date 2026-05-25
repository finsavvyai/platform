"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type Protocol = "saml" | "oidc";

interface IdPConfig {
  id?: string;
  protocol: Protocol;
  // SAML
  idpEntityId?: string;
  ssoUrl?: string;
  idpCertPem?: string;
  spEntityId?: string;
  acsUrl?: string;
  // OIDC
  issuerUrl?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUrl?: string;
  // Common
  mfaRequired: boolean;
}

async function fetchIdPConfig(): Promise<IdPConfig | null> {
  const res = await fetch("/api/v1/settings/sso");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load SSO config");
  return res.json();
}

async function saveIdPConfig(cfg: IdPConfig): Promise<IdPConfig> {
  const res = await fetch("/api/v1/settings/sso", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!res.ok) throw new Error("Failed to save SSO config");
  return res.json();
}

export default function SSOSettingsPage() {
  const qc = useQueryClient();
  const { data: saved, isLoading } = useQuery({
    queryKey: ["sso-config"],
    queryFn: fetchIdPConfig,
  });

  const [protocol, setProtocol] = useState<Protocol>(
    saved?.protocol ?? "saml"
  );
  const [form, setForm] = useState<Partial<IdPConfig>>({});
  const [saved_ok, setSavedOk] = useState(false);

  const mutation = useMutation({
    mutationFn: saveIdPConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sso-config"] });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
  });

  const merged: Partial<IdPConfig> = { ...(saved ?? {}), ...form };

  function field(name: keyof IdPConfig) {
    return {
      value: (merged[name] as string) ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [name]: e.target.value })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate({
      ...merged,
      protocol,
      mfaRequired: merged.mfaRequired ?? false,
    } as IdPConfig);
  }

  if (isLoading) return <p className="p-4 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">SSO Configuration</h1>
      <p className="text-sm text-gray-500 mb-6">
        Connect your Identity Provider via SAML 2.0 or OIDC. Secrets are
        encrypted before storage.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Protocol selector */}
        <div>
          <label className="block text-sm font-medium mb-1">Protocol</label>
          <div className="flex gap-4">
            {(["saml", "oidc"] as Protocol[]).map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="protocol"
                  value={p}
                  checked={protocol === p}
                  onChange={() => setProtocol(p)}
                />
                <span className="uppercase text-sm font-semibold">{p}</span>
              </label>
            ))}
          </div>
        </div>

        {protocol === "saml" ? (
          <>
            <Field label="IdP Entity ID" {...field("idpEntityId")} />
            <Field label="SSO URL (HTTP-Redirect)" {...field("ssoUrl")} />
            <TextareaField
              label="IdP Certificate (PEM)"
              {...field("idpCertPem")}
              rows={5}
            />
            <Field label="SP Entity ID" {...field("spEntityId")} readOnly />
            <Field label="ACS URL" {...field("acsUrl")} readOnly />
          </>
        ) : (
          <>
            <Field label="Issuer URL (OIDC Discovery)" {...field("issuerUrl")} />
            <Field label="Client ID" {...field("clientId")} />
            <Field
              label="Client Secret"
              {...field("clientSecret")}
              type="password"
            />
            <Field label="Redirect URL" {...field("redirectUrl")} readOnly />
          </>
        )}

        {/* MFA enforcement toggle */}
        <div className="flex items-center gap-3">
          <input
            id="mfa"
            type="checkbox"
            checked={merged.mfaRequired ?? false}
            onChange={(e) =>
              setForm((f) => ({ ...f, mfaRequired: e.target.checked }))
            }
            className="h-4 w-4"
          />
          <label htmlFor="mfa" className="text-sm font-medium">
            Require MFA for step-up actions (key rotation, retention changes)
          </label>
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
        >
          {mutation.isPending ? "Saving…" : "Save Configuration"}
        </button>

        {saved_ok && (
          <p className="text-sm text-green-600">Configuration saved.</p>
        )}
        {mutation.isError && (
          <p className="text-sm text-red-600">{String(mutation.error)}</p>
        )}
      </form>
    </div>
  );
}

function Field({
  label,
  readOnly,
  type = "text",
  ...props
}: {
  label: string;
  readOnly?: boolean;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type={type}
        readOnly={readOnly}
        className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
        {...props}
      />
    </div>
  );
}

function TextareaField({
  label,
  rows = 3,
  ...props
}: {
  label: string;
  rows?: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        rows={rows}
        className="w-full border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
        {...props}
      />
    </div>
  );
}
