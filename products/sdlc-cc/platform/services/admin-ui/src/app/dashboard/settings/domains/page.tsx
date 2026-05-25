"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface DomainRecord {
  domain: string;
  method: "dns" | "http";
  status: "pending" | "verified" | "expired";
  verified_at?: string;
  expires_at?: string;
}

interface RegisteredDomain extends DomainRecord {
  token?: string;
}

async function fetchDomains(): Promise<DomainRecord[]> {
  const res = await fetch("/api/v1/domains");
  if (!res.ok) throw new Error("Failed to load domains");
  return res.json();
}

async function registerDomain(body: {
  domain: string;
  method: string;
}): Promise<RegisteredDomain> {
  const res = await fetch("/api/v1/domains", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to register domain");
  return res.json();
}

async function verifyDomain(domain: string): Promise<DomainRecord> {
  const res = await fetch(`/api/v1/domains/${encodeURIComponent(domain)}/verify`, {
    method: "POST",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Verification failed");
  }
  return res.json();
}

async function deleteDomain(domain: string): Promise<void> {
  await fetch(`/api/v1/domains/${encodeURIComponent(domain)}`, {
    method: "DELETE",
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-600 bg-yellow-50",
  verified: "text-green-700 bg-green-50",
  expired: "text-red-600 bg-red-50",
};

export default function DomainsPage() {
  const qc = useQueryClient();
  const { data: domains = [], isLoading } = useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });

  const [newDomain, setNewDomain] = useState("");
  const [newMethod, setNewMethod] = useState<"dns" | "http">("dns");
  const [pendingToken, setPendingToken] = useState<{
    domain: string;
    token: string;
    method: string;
  } | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerDomain,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      if (data.token) {
        setPendingToken({ domain: data.domain, token: data.token, method: data.method });
      }
      setNewDomain("");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: verifyDomain,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["domains"] });
      setPendingToken(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDomain,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["domains"] }),
  });

  if (isLoading) return <p className="p-4 text-sm text-gray-500">Loading…</p>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-1">Domain Verification</h1>
      <p className="text-sm text-gray-500 mb-6">
        Verify domain ownership so users on your domain are automatically
        redirected to your configured SSO. Verification expires quarterly.
      </p>

      {/* Register form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newDomain) registerMutation.mutate({ domain: newDomain, method: newMethod });
        }}
        className="flex gap-2 mb-6"
      >
        <input
          type="text"
          placeholder="acme.com"
          value={newDomain}
          onChange={(e) => setNewDomain(e.target.value)}
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={newMethod}
          onChange={(e) => setNewMethod(e.target.value as "dns" | "http")}
          className="border rounded-md px-2 py-2 text-sm"
        >
          <option value="dns">DNS TXT</option>
          <option value="http">HTTP file</option>
        </select>
        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
        >
          {registerMutation.isPending ? "Adding…" : "Add Domain"}
        </button>
      </form>

      {/* Token instructions */}
      {pendingToken && (
        <div className="mb-6 p-4 border rounded-md bg-amber-50 text-sm space-y-2">
          <p className="font-medium">
            Publish this token for <strong>{pendingToken.domain}</strong>:
          </p>
          {pendingToken.method === "dns" ? (
            <code className="block bg-white border rounded px-3 py-2 font-mono text-xs break-all">
              {`sdlc-cc-verification=${pendingToken.token}`}
            </code>
          ) : (
            <p>
              Host the token at{" "}
              <code className="font-mono text-xs bg-white border rounded px-1">
                {`https://${pendingToken.domain}/.well-known/sdlc-cc-verification`}
              </code>
            </p>
          )}
          <button
            onClick={() => verifyMutation.mutate(pendingToken.domain)}
            disabled={verifyMutation.isPending}
            className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium disabled:opacity-50"
          >
            {verifyMutation.isPending ? "Checking…" : "Verify Now"}
          </button>
          {verifyMutation.isError && (
            <p className="text-red-600">{String(verifyMutation.error)}</p>
          )}
        </div>
      )}

      {/* Domain list */}
      {domains.length === 0 ? (
        <p className="text-sm text-gray-400">No domains registered yet.</p>
      ) : (
        <ul className="divide-y border rounded-md">
          {domains.map((d) => (
            <li key={d.domain} className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-mono text-sm">{d.domain}</span>
                <span
                  className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[d.status] ?? ""
                  }`}
                >
                  {d.status}
                </span>
                {d.expires_at && (
                  <span className="ml-2 text-xs text-gray-400">
                    expires {new Date(d.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(d.domain)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
