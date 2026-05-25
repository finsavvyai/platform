import { useUser, UserButton } from "@clerk/nextjs";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Key, Copy, Check, Plus, Trash2 } from "lucide-react";
import { hasValidClerkKeys } from "../lib/clerk-env";
import QuickStartSnippet from "../components/QuickStartSnippet";
import BillingCard from "../components/BillingCard";
import type { ApiKeySummary, CreatedApiKey } from "../lib/api-keys";

export const config = {
  runtime: "experimental-edge",
};

type ApiKeyRecord = ApiKeySummary & {
  key?: string;
};

type ApiKeyListResponse = {
  items?: ApiKeySummary[];
  error?: string;
  message?: string;
};

type ApiKeyMutationResponse = Partial<CreatedApiKey> & {
  error?: string;
  message?: string;
};

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return body.message || body.error || fallback;
  } catch {
    return fallback;
  }
};

function DashboardNoAuth() {
  return (
    <div className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
      <section className="max-w-md w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Dashboard</h1>
        <p className="text-gray-300 mb-6">
          Sign in is required to view the dashboard. Auth is not configured in
          this environment.
        </p>
        <Link
          href="/"
          className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
        >
          Back to home
        </Link>
      </section>
    </div>
  );
}

function DashboardSignInRequired() {
  return (
    <div className="min-h-screen bg-sdlc-dark flex items-center justify-center px-4">
      <section className="max-w-md w-full rounded-2xl border border-gray-800 bg-gray-900/80 p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-3">Sign in required</h1>
        <p className="text-gray-300 mb-6">
          Use your account to manage API keys and usage from the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/sign-in"
            className="inline-flex items-center rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-gray-700 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </section>
    </div>
  );
}

function DashboardContent() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isApiKeyManagementAvailable, setIsApiKeyManagementAvailable] =
    useState(true);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) {
      setIsLoadingKeys(false);
      return;
    }

    let isCancelled = false;

    const loadApiKeys = async () => {
      setIsLoadingKeys(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/keys", {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const message = await getErrorMessage(
            response,
            "Failed to load API keys",
          );

          if (!isCancelled) {
            setIsApiKeyManagementAvailable(response.status !== 503);
            setApiKeys([]);
            setErrorMessage(message);
          }
          return;
        }

        const payload = (await response.json()) as ApiKeyListResponse;

        if (!isCancelled) {
          setApiKeys(payload.items || []);
          setIsApiKeyManagementAvailable(true);
        }
      } catch (error) {
        console.error("Error loading API keys:", error);

        if (!isCancelled) {
          setApiKeys([]);
          setErrorMessage("Failed to load API keys");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingKeys(false);
        }
      }
    };

    void loadApiKeys();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, isSignedIn, user]);

  const generateApiKey = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = await getErrorMessage(
          response,
          "Failed to generate API key",
        );
        setIsApiKeyManagementAvailable(response.status !== 503);
        setErrorMessage(message);
        return;
      }

      const newKey = (await response.json()) as ApiKeyMutationResponse;

      if (!newKey.id || !newKey.key || !newKey.keyPreview || !newKey.createdAt) {
        setErrorMessage("API key response was incomplete");
        return;
      }

      const createdKey: ApiKeyRecord = {
        id: newKey.id,
        key: newKey.key,
        keyPreview: newKey.keyPreview,
        createdAt: newKey.createdAt,
        status: "active",
      };

      setApiKeys((currentKeys) => [
        createdKey,
        ...currentKeys.filter((currentKey) => currentKey.id !== newKey.id),
      ]);
      setIsApiKeyManagementAvailable(true);
      setSuccessMessage(
        newKey.message || "New API key created. Store it now because it will not be shown again.",
      );
    } catch (error) {
      console.error("Error generating API key:", error);
      setErrorMessage("Error generating API key");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async (keyId: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
    } catch (error) {
      console.error("Error copying API key:", error);
      setErrorMessage("Failed to copy API key to the clipboard");
    }
  };

  const deleteApiKey = async (keyId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this API key? This action cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingKeyId(keyId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/keys/${keyId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = await getErrorMessage(
          response,
          "Failed to delete API key",
        );
        setErrorMessage(message);
        return;
      }

      setApiKeys((currentKeys) =>
        currentKeys.filter((apiKey) => apiKey.id !== keyId),
      );
      setSuccessMessage("API key deleted");
    } catch (error) {
      console.error("Error deleting API key:", error);
      setErrorMessage("Error deleting API key");
    } finally {
      setDeletingKeyId(null);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-sdlc-dark flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn || !user) {
    return <DashboardSignInRequired />;
  }

  return (
    <>
      <Head>
        <title>Dashboard | SDLC.ai</title>
        <meta
          name="description"
          content="Manage your SDLC.ai API keys and usage"
        />
      </Head>

      <div className="min-h-screen bg-sdlc-dark">
        {/* Header */}
        <header className="border-b border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">
                SDLC.ai Dashboard
              </h1>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <h2 className="text-3xl font-bold text-white mb-2">
              Welcome, {user?.firstName || "there"}! 👋
            </h2>
            <p className="text-gray-400">
              Manage your API keys and monitor your usage
            </p>
          </motion.div>

          {/* API Keys Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-900 rounded-lg border border-gray-800 p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">API Keys</h3>
                <p className="text-sm text-gray-400">
                  Use these keys to authenticate your requests. Full secrets are
                  only shown once when created.
                </p>
              </div>
              <button
                onClick={generateApiKey}
                disabled={isGenerating || !isApiKeyManagementAvailable}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Generate New Key"}
              </button>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100"
              >
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {successMessage}
              </div>
            ) : null}

            {isLoadingKeys ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                <Key className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Loading API keys...</p>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-700 rounded-lg">
                <Key className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">
                  {isApiKeyManagementAvailable
                    ? "No API keys yet"
                    : "API key management is unavailable"}
                </p>
                <p className="text-sm text-gray-500">
                  {isApiKeyManagementAvailable
                    ? 'Click "Generate New Key" to create your first API key'
                    : "Configure a Cloudflare KV binding for API key storage before enabling dashboard key management."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="text-sm font-mono text-gray-300">
                          {apiKey.key || apiKey.keyPreview}
                        </code>
                        {apiKey.key ? (
                          <button
                            onClick={() => copyToClipboard(apiKey.id, apiKey.key!)}
                            className="text-gray-400 hover:text-white transition-colors"
                            aria-label="Copy API key"
                          >
                            {copiedKeyId === apiKey.id ? (
                              <Check className="h-4 w-4 text-green-400" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="rounded-full border border-gray-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Hidden
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                      </div>
                      {!apiKey.key ? (
                        <div className="mt-2 text-xs text-amber-300">
                          Full API keys are only available immediately after
                          creation.
                        </div>
                      ) : null}
                      <div className="mt-1 text-xs uppercase tracking-wide text-emerald-400">
                        {apiKey.status}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteApiKey(apiKey.id)}
                      disabled={deletingKeyId === apiKey.id}
                      className="text-red-400 hover:text-red-300 transition-colors ml-4"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Usage Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 bg-gray-900 rounded-lg border border-gray-800 p-6"
          >
            <h3 className="text-xl font-bold text-white mb-4">Usage</h3>
            <div className="text-center py-8 border-2 border-dashed border-gray-700 rounded-lg">
              <p className="text-gray-400 mb-2">
                Usage is tracked when you call the API with your key.
              </p>
              <p className="text-sm text-gray-500 mb-4">
                To view stats, call the usage endpoint with your API key (same as in Quick Start):
              </p>
              <p className="text-xs text-gray-500 font-mono break-all px-2">
                GET {process.env.NEXT_PUBLIC_GATEWAY_URL || "https://api.sdlc.cc"}/api/v1/usage/stats
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Include header: Authorization: Bearer &lt;your-api-key&gt;
              </p>
            </div>
          </motion.div>

          <BillingCard />

          {/* Quick Start */}
          <QuickStartSnippet apiKeys={apiKeys} />
        </main>
      </div>
    </>
  );
}

export default function Dashboard() {
  if (!hasValidClerkKeys()) {
    return <DashboardNoAuth />;
  }
  return <DashboardContent />;
}

// Force server-side rendering to avoid build-time pre-rendering with invalid Clerk keys
export async function getServerSideProps() {
  return { props: {} };
}
