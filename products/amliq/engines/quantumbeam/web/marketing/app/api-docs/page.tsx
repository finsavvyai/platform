'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Copy, Terminal, Code, Zap, Shield, Search } from 'lucide-react'

const apiExamples = [
  {
    title: 'Transaction Analysis',
    description: 'Analyze a transaction for fraud risk using quantum-enhanced algorithms',
    method: 'POST',
    endpoint: '/api/v1/analyze',
    code: `curl -X POST https://api.quantumbeam.io/api/v1/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transaction": {
      "amount": 1250.00,
      "currency": "USD",
      "merchant_id": "merch_123456",
      "user_id": "user_789012",
      "card_number": "4242424242424242",
      "timestamp": "2024-01-15T10:30:00Z",
      "location": {
        "ip": "192.168.1.1",
        "country": "US",
        "city": "New York"
      },
      "device_fingerprint": "fp_abc123def456"
    }
  }'`,
    response: `{
  "transaction_id": "txn_abcdef123456",
  "risk_score": 0.12,
  "risk_level": "low",
  "quantum_confidence": 0.987,
  "recommendation": "approve",
  "analysis": {
    "quantum_features": {
      "superposition_state": " Fraud: 0.12, Legitimate: 0.88",
      "entanglement_score": 0.045,
      "quantum_interference": -0.023
    },
    "pattern_matches": [],
    "anomaly_indicators": []
  },
  "processing_time_ms": 127,
  "timestamp": "2024-01-15T10:30:00.127Z"
}`
  },
  {
    title: 'Batch Processing',
    description: 'Process multiple transactions simultaneously with quantum parallelism',
    method: 'POST',
    endpoint: '/api/v1/batch',
    code: `curl -X POST https://api.quantumbeam.io/api/v1/batch \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "transactions": [
      {
        "amount": 250.00,
        "merchant_id": "merch_111111",
        "user_id": "user_222222",
        "card_number": "4111111111111111",
        "timestamp": "2024-01-15T11:00:00Z"
      },
      {
        "amount": 5000.00,
        "merchant_id": "merch_333333",
        "user_id": "user_444444",
        "card_number": "5555555555554444",
        "timestamp": "2024-01-15T11:05:00Z"
      }
    ]
  }'`,
    response: `{
  "batch_id": "batch_789xyz",
  "processed_count": 2,
  "results": [
    {
      "transaction_id": "txn_111111",
      "risk_score": 0.08,
      "risk_level": "low",
      "quantum_confidence": 0.992,
      "recommendation": "approve"
    },
    {
      "transaction_id": "txn_222222",
      "risk_score": 0.89,
      "risk_level": "high",
      "quantum_confidence": 0.967,
      "recommendation": "review",
      "flags": ["unusual_location", "high_amount_anomaly"]
    }
  ],
  "processing_time_ms": 342,
  "timestamp": "2024-01-15T11:05:00.342Z"
}`
  },
  {
    title: 'Real-time Monitoring',
    description: 'Subscribe to real-time fraud alerts and quantum pattern detection',
    method: 'WebSocket',
    endpoint: 'wss://api.quantumbeam.io/ws/monitor',
    code: `const ws = new WebSocket('wss://api.quantumbeam.io/ws/monitor?token=YOUR_API_KEY');

ws.onopen = () => {
  // Subscribe to specific transaction streams
  ws.send(JSON.stringify({
    action: 'subscribe',
    filters: {
      risk_threshold: 0.7,
      user_ids: ['user_123', 'user_456'],
      merchant_categories: ['electronics', 'jewelry']
    }
  }));
};

ws.onmessage = (event) => {
  const alert = JSON.parse(event.data);
  console.log('Quantum Alert:', alert);
  /*
  {
    "type": "fraud_alert",
    "alert_id": "alert_abc123",
    "severity": "high",
    "confidence": 0.945,
    "quantum_pattern": "coordinated_attack",
    "affected_transactions": ["txn_a", "txn_b", "txn_c"],
    "recommended_action": "block_user"
  }
  */
};`,
    response: `WebSocket Connection Established
Subscription Confirmed

Real-time Alerts:
{
  "type": "quantum_pattern_detected",
  "pattern_id": "pattern_xyz789",
  "pattern_type": "quantum_entanglement_cluster",
  "confidence": 0.967,
  "affected_entities": 15,
  "detection_time_ms": 23,
  "quantum_state": {
    "entanglement_strength": 0.892,
    "coherence_time": "127ms",
    "measurement_basis": "fraud_detection"
  }
}`
  }
]

const codeBlockVariants = {
  method: {
    GET: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    POST: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }
}

export default function APIDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-gradient-to-r from-quantum-600 to-brand-purple text-white">
        <div className="container-padding section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto text-center"
          >
            <div className="flex items-center justify-center space-x-2 mb-6">
              <Code className="w-8 h-8" />
              <h1 className="text-4xl md:text-5xl font-bold">API Documentation</h1>
            </div>
            <p className="text-xl opacity-90 mb-8">
              Integrate quantum-enhanced fraud detection into your applications with our RESTful API and real-time WebSocket endpoints.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
              <button className="bg-white text-quantum-600 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Get API Key
              </button>
              <button className="border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-quantum-600 transition-colors">
                View Playground
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="container-padding section-padding">
        <div className="max-w-6xl mx-auto">
          {/* Authentication Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <h2 className="text-3xl font-bold mb-6">Authentication</h2>
            <div className="bg-muted/50 rounded-lg p-6 mb-6">
              <p className="text-lg mb-4">
                All API requests require authentication using a Bearer token. Include your API key in the Authorization header:
              </p>
              <div className="bg-background rounded-lg p-4 border border-border">
                <code className="text-sm">Authorization: Bearer YOUR_API_KEY</code>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-quantum-600 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Secure</h4>
                  <p className="text-sm text-muted-foreground">Industry-standard authentication with quantum-resistant encryption</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="w-5 h-5 text-quantum-600 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Fast</h4>
                  <p className="text-sm text-muted-foreground">Optimized for high-throughput processing with minimal latency</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Search className="w-5 h-5 text-quantum-600 mt-1" />
                <div>
                  <h4 className="font-semibold mb-1">Scalable</h4>
                  <p className="text-sm text-muted-foreground">Handle millions of requests with quantum parallelism</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* API Examples */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-6">API Examples</h2>

            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-8 border-b border-border">
              {apiExamples.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                    activeTab === index
                      ? 'text-quantum-600 border-quantum-600'
                      : 'text-muted-foreground border-transparent hover:text-foreground'
                  }`}
                >
                  {example.title}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="space-y-8">
              {apiExamples.map((example, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  animate={activeTab === index ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
                  className={activeTab === index ? 'block' : 'hidden'}
                >
                  <div className="bg-card rounded-lg border border-border overflow-hidden">
                    {/* Header */}
                    <div className="bg-muted/50 px-6 py-4 border-b border-border">
                      <h3 className="text-xl font-semibold mb-2">{example.title}</h3>
                      <p className="text-muted-foreground mb-4">{example.description}</p>
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${codeBlockVariants.method[example.method as keyof typeof codeBlockVariants.method]}`}>
                          {example.method}
                        </span>
                        <code className="bg-background px-3 py-1 rounded text-sm">{example.endpoint}</code>
                      </div>
                    </div>

                    {/* Request Code */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">Request</h4>
                        <button
                          onClick={() => copyToClipboard(example.code)}
                          className="flex items-center space-x-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedCode === example.code ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-background rounded-lg border border-border overflow-hidden">
                        <pre className="p-4 text-sm overflow-x-auto">
                          <code>{example.code}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Response Code */}
                    <div className="p-6 border-t border-border">
                      <h4 className="font-semibold mb-4">Response</h4>
                      <div className="bg-background rounded-lg border border-border overflow-hidden">
                        <pre className="p-4 text-sm overflow-x-auto">
                          <code>{example.response}</code>
                        </pre>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Rate Limits */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold mb-6">Rate Limits</h2>
            <div className="bg-muted/50 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-semibold mb-4">Standard Plan</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• 1,000 requests per minute</li>
                    <li>• 100,000 requests per day</li>
                    <li>• Batch processing up to 100 transactions</li>
                    <li>• Standard quantum algorithms</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-4">Enterprise Plan</h4>
                  <ul className="space-y-2 text-sm">
                    <li>• Unlimited requests per minute</li>
                    <li>• Unlimited daily requests</li>
                    <li>• Batch processing up to 10,000 transactions</li>
                    <li>• Advanced quantum algorithms & custom models</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Error Handling */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-16"
          >
            <h2 className="text-3xl font-bold mb-6">Error Handling</h2>
            <div className="space-y-4">
              {[
                { code: '400', message: 'Bad Request - Invalid input data' },
                { code: '401', message: 'Unauthorized - Invalid or missing API key' },
                { code: '429', message: 'Too Many Requests - Rate limit exceeded' },
                { code: '500', message: 'Internal Server Error - Quantum processing error' },
                { code: '503', message: 'Service Unavailable - Quantum backend maintenance' }
              ].map((error) => (
                <div key={error.code} className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-sm bg-background px-2 py-1 rounded">{error.code}</span>
                    <span className="text-sm">{error.message}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  )
}