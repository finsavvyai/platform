'use client'

import { useState } from 'react'
import { Play, Copy, Check } from 'lucide-react'
import { Button } from '@mcpoverflow/ui'
import { CodeBlock } from './code-block'

interface InteractiveDemoProps {
  example: string
}

export function InteractiveDemo({ example }: InteractiveDemoProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const demos: Record<string, {
    title: string
    description: string
    code: string
    expectedOutput: string
  }> = {
    'simple-agent': {
      title: 'Simple Agent Example',
      description: 'Create a basic agent that responds to user messages',
      code: `import { MCPAgent } from '@mcpoverflow/sdk'

const agent = new MCPAgent({
  name: 'Hello World Agent',
  description: 'A simple greeting agent',
  tools: {
    greet: {
      description: 'Greet the user',
      parameters: {
        name: { type: 'string', description: 'User name' }
      }
    }
  }
})

agent.on('greet', async (params) => {
  return \`Hello, \${params.name}! Welcome to MCPOverflow.\`
})

await agent.start()`,
      expectedOutput: 'Hello, World! Welcome to MCPOverflow.'
    },

    'chat-bot': {
      title: 'Chat Bot Example',
      description: 'Build a conversational AI agent with memory',
      code: `import { MCPAgent, MemoryStore } from '@mcpoverflow/sdk'

const agent = new MCPAgent({
  name: 'Chat Bot',
  description: 'A conversational agent with memory',
  memory: new MemoryStore(),
  tools: {
    chat: {
      description: 'Chat with the user',
      parameters: {
        message: { type: 'string', description: 'User message' }
      }
    },
    remember: {
      description: 'Remember important information',
      parameters: {
        key: { type: 'string', description: 'Memory key' },
        value: { type: 'string', description: 'Memory value' }
      }
    }
  }
})

agent.on('chat', async (params) => {
  const context = await agent.memory.get('conversation_context')
  const response = await generateResponse(params.message, context)
  await agent.memory.set('last_message', params.message)
  return response
})`,
      expectedOutput: 'I understand your message. Let me help you with that!'
    },

    'data-processing': {
      title: 'Data Processing Agent',
      description: 'Create an agent that processes and analyzes data',
      code: `import { MCPAgent } from '@mcpoverflow/sdk'

const agent = new MCPAgent({
  name: 'Data Processor',
  description: 'Processes and analyzes datasets',
  tools: {
    analyze: {
      description: 'Analyze uploaded data',
      parameters: {
        data: { type: 'object', description: 'Dataset to analyze' }
      }
    },
    visualize: {
      description: 'Create data visualizations',
      parameters: {
        type: {
          type: 'string',
          enum: ['chart', 'graph', 'table'],
          description: 'Visualization type'
        }
      }
    }
  }
})

agent.on('analyze', async (params) => {
  const stats = calculateStatistics(params.data)
  return {
    rowCount: stats.count,
    columns: stats.columns,
    summary: stats.summary
  }
})`,
      expectedOutput: 'Analysis complete: 1000 rows, 5 columns processed.'
    },

    'custom-tools': {
      title: 'Custom Tools Example',
      description: 'Extend agent capabilities with custom tools',
      code: `import { MCPAgent, Tool } from '@mcpoverflow/sdk'

class WeatherTool extends Tool {
  name = 'get_weather'
  description = 'Get current weather for a location'

  async execute(params: { location: string }) {
    const weather = await fetchWeatherData(params.location)
    return {
      location: params.location,
      temperature: weather.temp,
      condition: weather.condition,
      humidity: weather.humidity
    }
  }
}

const agent = new MCPAgent({
  name: 'Weather Assistant',
  description: 'Provides weather information',
  tools: {
    get_weather: new WeatherTool(),
    forecast: {
      description: 'Get weather forecast',
      parameters: {
        location: { type: 'string' },
        days: { type: 'number', default: 7 }
      }
    }
  }
})`,
      expectedOutput: 'Weather in San Francisco: 72°F, Sunny, 65% humidity'
    }
  }

  const demo = demos[example]

  if (!demo) {
    return <div className="text-center text-muted-foreground">Demo not available for this example.</div>
  }

  const handleRun = async () => {
    setIsRunning(true)
    setOutput([])

    // Simulate running the code
    await new Promise(resolve => setTimeout(resolve, 2000))

    setOutput([
      '🚀 Starting agent...',
      '✅ Agent initialized successfully',
      '📊 Processing request...',
      '✅ Request completed',
      `📤 Output: ${demo.expectedOutput}`
    ])

    setIsRunning(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(demo.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="interactive-demo">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">{demo.title}</h3>
        <p className="text-muted-foreground">{demo.description}</p>
      </div>

      {/* Code Editor */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">Code</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <CodeBlock code={demo.code} language="typescript" />
      </div>

      {/* Run Button */}
      <div className="mb-6">
        <Button
          onClick={handleRun}
          disabled={isRunning}
          className="bg-purple-600 hover:bg-purple-700"
        >
          <Play className="h-4 w-4 mr-2" />
          {isRunning ? 'Running...' : 'Run Demo'}
        </Button>
      </div>

      {/* Output */}
      {(output.length > 0 || isRunning) && (
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Output</h4>
          <div className="bg-black/90 text-green-400 p-4 rounded-lg font-mono text-sm">
            {isRunning ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full" />
                <span>Processing...</span>
              </div>
            ) : (
              <div className="space-y-1">
                {output.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Expected Output */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Expected Output</h4>
        <p className="text-blue-800 dark:text-blue-200">{demo.expectedOutput}</p>
      </div>
    </div>
  )
}