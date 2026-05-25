'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Sparkles,
    Copy,
    Check,
    Play,
    Code2,
    Zap,
    ArrowRight,
    RefreshCw,
    Download,
    ExternalLink
} from 'lucide-react'

// API endpoint
const API_URL = 'https://mcpoverflow-api.broad-dew-49ad.workers.dev';

// Sample OpenAPI spec URLs for demo
const SAMPLE_SPECS = {
    petstore: {
        name: 'Pet Store',
        url: 'https://petstore3.swagger.io/api/v3/openapi.json',
        yaml: `openapi: "3.0.3"
info:
  title: Swagger Petstore
  version: "1.0.27"
servers:
  - url: https://petstore3.swagger.io/api/v3
paths:
  /pet:
    post:
      operationId: addPet
      summary: Add a new pet to the store
    put:
      operationId: updatePet
      summary: Update an existing pet
  /pet/findByStatus:
    get:
      operationId: findPetsByStatus
      summary: Finds Pets by status
  /pet/{petId}:
    get:
      operationId: getPetById
      summary: Find pet by ID
    delete:
      operationId: deletePet
      summary: Deletes a pet
  /store/inventory:
    get:
      operationId: getInventory
      summary: Returns pet inventories
  /user/login:
    get:
      operationId: loginUser
      summary: Logs user into the system`
    },
    github: {
        name: 'GitHub',
        url: null, // No public OpenAPI URL
        yaml: `openapi: "3.0.0"
info:
  title: GitHub API
  version: "1.0.0"
servers:
  - url: https://api.github.com
paths:
  /repos/{owner}/{repo}:
    get:
      operationId: getRepository
      summary: Get a repository
  /repos/{owner}/{repo}/issues:
    get:
      operationId: listIssues
      summary: List repository issues
    post:
      operationId: createIssue
      summary: Create an issue
  /users/{username}:
    get:
      operationId: getUser
      summary: Get a user
  /user/repos:
    get:
      operationId: listUserRepos
      summary: List repositories for authenticated user`
    },
    stripe: {
        name: 'Stripe',
        url: null,
        yaml: `openapi: "3.0.0"
info:
  title: Stripe API
  version: "1.0.0"
servers:
  - url: https://api.stripe.com
paths:
  /v1/customers:
    get:
      operationId: listCustomers
      summary: List all customers
    post:
      operationId: createCustomer
      summary: Create a customer
  /v1/customers/{id}:
    get:
      operationId: getCustomer
      summary: Retrieve a customer
  /v1/charges:
    post:
      operationId: createCharge
      summary: Create a charge
  /v1/payment_intents:
    post:
      operationId: createPaymentIntent
      summary: Create a PaymentIntent`
    }
}

interface GenerationResult {
    success: boolean;
    files?: Array<{ name: string; content: string }>;
    manifest?: {
        name: string;
        version: string;
        tools: Array<{ name: string; description: string }>;
    };
    error?: string;
}

interface InteractiveDemoProps {
    className?: string
}

export function InteractiveDemo({ className = '' }: InteractiveDemoProps) {
    const [selectedSpec, setSelectedSpec] = useState<keyof typeof SAMPLE_SPECS>('petstore')
    const [customSpec, setCustomSpec] = useState('')
    const [isCustom, setIsCustom] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [result, setResult] = useState<GenerationResult | null>(null)
    const [displayedCode, setDisplayedCode] = useState('')
    const [copied, setCopied] = useState(false)
    const [generationTime, setGenerationTime] = useState(0)

    const currentSpec = SAMPLE_SPECS[selectedSpec];

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true)
        setResult(null)
        setDisplayedCode('')
        const startTime = Date.now()

        try {
            let response;
            
            // Use URL if available, otherwise parse YAML to JSON
            if (currentSpec.url) {
                response = await fetch(`${API_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        specUrl: currentSpec.url,
                        serviceName: currentSpec.name
                    })
                });
            } else {
                // Parse basic YAML to JSON for demo
                const spec = parseYamlToJson(isCustom ? customSpec : currentSpec.yaml);
                response = await fetch(`${API_URL}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        spec,
                        serviceName: currentSpec.name
                    })
                });
            }

            const data = await response.json() as GenerationResult;
            setGenerationTime(Date.now() - startTime);
            
            if (data.success && data.files) {
                setResult(data);
                // Animate the server.ts file display
                const serverFile = data.files.find(f => f.name === 'server.ts');
                if (serverFile) {
                    await typeCode(serverFile.content);
                }
            } else {
                setResult({ success: false, error: data.error || 'Generation failed' });
            }
        } catch (error) {
            setGenerationTime(Date.now() - startTime);
            setResult({ 
                success: false, 
                error: error instanceof Error ? error.message : 'Network error' 
            });
        }

        setIsGenerating(false)
    }, [currentSpec, isCustom, customSpec])

    // Simple typing animation
    const typeCode = async (code: string) => {
        const lines = code.split('\n');
        let displayed = '';
        
        // Show first 50 lines with animation, then show rest instantly
        for (let i = 0; i < Math.min(lines.length, 50); i++) {
            displayed += lines[i] + '\n';
            setDisplayedCode(displayed);
            await new Promise(r => setTimeout(r, 20));
        }
        
        if (lines.length > 50) {
            setDisplayedCode(code);
        }
    }

    // Basic YAML to JSON parser for demo specs
    const parseYamlToJson = (yaml: string): any => {
        const lines = yaml.split('\n');
        const result: any = { paths: {} };
        let currentPath = '';
        let currentMethod = '';
        
        for (const line of lines) {
            if (line.startsWith('  title:')) {
                result.info = { title: line.split(':')[1].trim().replace(/"/g, '') };
            }
            if (line.startsWith('  version:')) {
                result.info = result.info || {};
                result.info.version = line.split(':')[1].trim().replace(/"/g, '');
            }
            if (line.startsWith('    - url:')) {
                result.servers = [{ url: line.split('url:')[1].trim() }];
            }
            if (line.match(/^  \/[^:]+:$/)) {
                currentPath = line.trim().replace(':', '');
                result.paths[currentPath] = {};
            }
            if (line.match(/^    (get|post|put|delete|patch):$/)) {
                currentMethod = line.trim().replace(':', '');
                result.paths[currentPath][currentMethod] = {};
            }
            if (line.includes('operationId:')) {
                result.paths[currentPath][currentMethod].operationId = line.split(':')[1].trim();
            }
            if (line.includes('summary:')) {
                result.paths[currentPath][currentMethod].summary = line.split('summary:')[1].trim();
            }
        }
        
        return result;
    }

    const handleCopy = useCallback(async () => {
        if (result?.files) {
            const serverFile = result.files.find(f => f.name === 'server.ts');
            if (serverFile) {
                await navigator.clipboard.writeText(serverFile.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }
        }
    }, [result])

    const handleDownload = useCallback(() => {
        if (result?.files) {
            result.files.forEach(file => {
                const blob = new Blob([file.content], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                URL.revokeObjectURL(url);
            });
        }
    }, [result])

    const handleReset = useCallback(() => {
        setResult(null)
        setDisplayedCode('')
        setIsGenerating(false)
    }, [])

    return (
        <section id="demo" className={`relative py-24 ${className}`}>
            <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-950/20 to-black" />

            <div className="relative z-10 max-w-7xl mx-auto px-6">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6">
                        <Sparkles className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-blue-300">Try it live — no signup required</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        See the magic in action
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Select an API and watch us generate a complete MCP server instantly
                    </p>
                </motion.div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Input Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <Code2 className="w-5 h-5 text-blue-400" />
                                    <span className="font-medium text-white">OpenAPI Spec</span>
                                </div>
                                <div className="flex gap-2">
                                    {(Object.keys(SAMPLE_SPECS) as (keyof typeof SAMPLE_SPECS)[]).map((key) => (
                                        <button
                                            key={key}
                                            onClick={() => { setSelectedSpec(key); setIsCustom(false); handleReset() }}
                                            className={`px-3 py-1 rounded-lg text-sm transition-all ${selectedSpec === key && !isCustom
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {SAMPLE_SPECS[key].name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Code Area */}
                            <div className="relative">
                                <pre className="h-80 overflow-auto p-4 text-gray-300 font-mono text-sm">
                                    <code>{currentSpec.yaml}</code>
                                </pre>
                            </div>

                            {/* Generate Button */}
                            <div className="p-4 border-t border-white/5">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white font-semibold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            Generating MCP Server...
                                        </>
                                    ) : (
                                        <>
                                            <Zap className="w-5 h-5" />
                                            Generate MCP Server
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Output Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="relative"
                    >
                        <div className="bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden h-full flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    <span className="font-medium text-white">Generated MCP Server</span>
                                </div>
                                {result?.success && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleCopy}
                                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
                                        >
                                            {copied ? (
                                                <>
                                                    <Check className="w-4 h-4 text-green-400" />
                                                    <span className="text-green-400">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-4 h-4" />
                                                    Copy
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={handleDownload}
                                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-sm bg-white/5 text-gray-400 hover:bg-white/10 transition-all"
                                        >
                                            <Download className="w-4 h-4" />
                                            Download
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Output Area */}
                            <div className="relative flex-1 h-80 overflow-auto">
                                <AnimatePresence mode="wait">
                                    {result?.error ? (
                                        <motion.div
                                            key="error"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center justify-center h-full text-red-400 p-4"
                                        >
                                            <p className="text-center">Error: {result.error}</p>
                                        </motion.div>
                                    ) : displayedCode ? (
                                        <motion.pre
                                            key="code"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="p-4 text-green-400 font-mono text-xs leading-relaxed"
                                        >
                                            <code>{displayedCode}</code>
                                            {isGenerating && (
                                                <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-1" />
                                            )}
                                        </motion.pre>
                                    ) : (
                                        <motion.div
                                            key="empty"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex flex-col items-center justify-center h-full text-gray-500"
                                        >
                                            <Play className="w-12 h-12 mb-4 opacity-50" />
                                            <p>Click "Generate" to create your MCP server</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Stats Footer */}
                            {result?.success && result.manifest && !isGenerating && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="p-4 border-t border-white/5 bg-green-500/5"
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-4">
                                            <span className="text-green-400">✓ {result.manifest.tools.length} MCP tools generated</span>
                                            <span className="text-gray-400">
                                                {result.files?.length} files
                                            </span>
                                        </div>
                                        <span className="text-gray-400">
                                            {(generationTime / 1000).toFixed(2)}s
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {result.manifest.tools.slice(0, 5).map(tool => (
                                            <span key={tool.name} className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                                                {tool.name}
                                            </span>
                                        ))}
                                        {result.manifest.tools.length > 5 && (
                                            <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                                                +{result.manifest.tools.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="text-center mt-12"
                >
                    <p className="text-gray-400 mb-4">Ready to deploy your connectors to production?</p>
                    <a
                        href="/signup"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full hover:bg-gray-100 transition-all"
                    >
                        Start Building Free
                        <ArrowRight className="w-5 h-5" />
                    </a>
                </motion.div>
            </div>
        </section>
    )
}

export default InteractiveDemo
