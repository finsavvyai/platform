import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Square, 
  Smartphone, 
  Monitor, 
  Settings, 
  Eye, 
  Download,
  Upload,
  Zap,
  Target,
  Camera
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RecordingSession {
  id: string;
  type: 'mobile' | 'web';
  platform?: 'ios' | 'android' | 'chrome' | 'firefox' | 'safari';
  status: 'idle' | 'recording' | 'processing' | 'completed';
  duration: number;
  actions: RecordedAction[];
  metadata: {
    deviceName?: string;
    appId?: string;
    url?: string;
    viewport?: { width: number; height: number };
  };
}

interface RecordedAction {
  id: string;
  type: 'tap' | 'type' | 'swipe' | 'scroll' | 'assert' | 'wait' | 'screenshot';
  timestamp: number;
  coordinates?: { x: number; y: number };
  text?: string;
  element?: string;
  screenshot?: string;
}

export default function RecordingStudio() {
  const [session, setSession] = useState<RecordingSession | null>(null);
  const [recordingType, setRecordingType] = useState<'mobile' | 'web'>('mobile');
  const [isConnected, setIsConnected] = useState(false);
  const [devicePreview, setDevicePreview] = useState<string>('');

  const startRecording = async () => {
    try {
      const newSession: RecordingSession = {
        id: Date.now().toString(),
        type: recordingType,
        platform: recordingType === 'mobile' ? 'ios' : 'chrome',
        status: 'recording',
        duration: 0,
        actions: [],
        metadata: {
          deviceName: recordingType === 'mobile' ? 'iPhone 15 Pro' : 'Chrome Desktop',
          appId: recordingType === 'mobile' ? 'com.testapp.example' : undefined,
          url: recordingType === 'web' ? 'https://example.com' : undefined,
          viewport: recordingType === 'web' ? { width: 1920, height: 1080 } : undefined
        }
      };

      setSession(newSession);
      
      // Start recording via API
      const response = await fetch('/api/recording/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: recordingType,
          platform: newSession.platform,
          metadata: newSession.metadata
        })
      });

      if (response.ok) {
        toast.success(`🎬 ${recordingType === 'mobile' ? 'Mobile' : 'Web'} recording started!`);
      } else {
        throw new Error('Failed to start recording');
      }
    } catch (error) {
      toast.error('Failed to start recording');
      console.error('Recording error:', error);
    }
  };

  const stopRecording = async () => {
    if (!session) return;

    try {
      setSession(prev => prev ? { ...prev, status: 'processing' } : null);

      const response = await fetch('/api/recording/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id })
      });

      if (response.ok) {
        const result = await response.json();
        setSession(prev => prev ? { ...prev, status: 'completed', actions: result.actions } : null);
        toast.success('🎉 Recording completed and saved!');
      } else {
        throw new Error('Failed to stop recording');
      }
    } catch (error) {
      toast.error('Failed to stop recording');
      console.error('Stop recording error:', error);
    }
  };

  const exportRecording = async () => {
    if (!session || session.status !== 'completed') return;

    try {
      // Generate test flow based on recording type
      const testFlow = session.type === 'mobile' 
        ? generateMaestroFlow(session)
        : generateWorkflowUseFlow(session);

      // Download the generated test file
      const blob = new Blob([testFlow], { type: 'text/yaml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.type}-test-${session.id}.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Test flow exported successfully!');
    } catch (error) {
      toast.error('Failed to export recording');
      console.error('Export error:', error);
    }
  };

  const generateMaestroFlow = (session: RecordingSession): string => {
    const { metadata, actions } = session;
    
    let yaml = `# Questro - Generated Maestro Test\n`;
    yaml += `# Recorded: ${new Date().toISOString()}\n`;
    yaml += `appId: ${metadata.appId}\n`;
    yaml += `---\n`;

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'tap':
          yaml += `- tapOn:\n`;
          if (action.coordinates) {
            yaml += `    point: ${action.coordinates.x},${action.coordinates.y}\n`;
          }
          if (action.element) {
            yaml += `    element: "${action.element}"\n`;
          }
          break;
        case 'type':
          yaml += `- inputText: "${action.text}"\n`;
          break;
        case 'swipe':
          yaml += `- swipe:\n`;
          yaml += `    direction: "up"  # Detected from coordinates\n`;
          break;
        case 'assert':
          yaml += `- assertVisible: "${action.element}"\n`;
          break;
        case 'wait':
          yaml += `- waitForAnimationToEnd\n`;
          break;
        case 'screenshot':
          yaml += `- takeScreenshot: "step-${index + 1}"\n`;
          break;
      }
    });

    return yaml;
  };

  const generateWorkflowUseFlow = (session: RecordingSession): string => {
    const { metadata, actions } = session;
    
    let yaml = `# Questro - Generated workflow-use Test\n`;
    yaml += `# Recorded: ${new Date().toISOString()}\n`;
    yaml += `name: "Web Test Recording"\n`;
    yaml += `url: "${metadata.url}"\n`;
    yaml += `viewport:\n`;
    yaml += `  width: ${metadata.viewport?.width || 1920}\n`;
    yaml += `  height: ${metadata.viewport?.height || 1080}\n`;
    yaml += `steps:\n`;

    actions.forEach((action, index) => {
      switch (action.type) {
        case 'tap':
          yaml += `  - click:\n`;
          if (action.element) {
            yaml += `      selector: "${action.element}"\n`;
          } else if (action.coordinates) {
            yaml += `      coordinates: [${action.coordinates.x}, ${action.coordinates.y}]\n`;
          }
          break;
        case 'type':
          yaml += `  - type:\n`;
          yaml += `      text: "${action.text}"\n`;
          if (action.element) {
            yaml += `      selector: "${action.element}"\n`;
          }
          break;
        case 'scroll':
          yaml += `  - scroll:\n`;
          yaml += `      direction: "down"\n`;
          break;
        case 'assert':
          yaml += `  - assert:\n`;
          yaml += `      selector: "${action.element}"\n`;
          yaml += `      visible: true\n`;
          break;
        case 'wait':
          yaml += `  - wait: 2000\n`;
          break;
        case 'screenshot':
          yaml += `  - screenshot: "step-${index + 1}"\n`;
          break;
      }
    });

    return yaml;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            🎬 Questro Studio
          </h1>
          <p className="text-gray-600 text-lg">
            Capture user interactions and generate automated tests with Questro's AI-powered recording
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recording Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Settings className="w-6 h-6" />
                Recording Setup
              </h2>

              {/* Platform Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Platform Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRecordingType('mobile')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      recordingType === 'mobile'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span className="font-medium">Mobile</span>
                  </button>
                  <button
                    onClick={() => setRecordingType('web')}
                    className={`flex items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      recordingType === 'web'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Monitor className="w-5 h-5" />
                    <span className="font-medium">Web</span>
                  </button>
                </div>
              </div>

              {/* Recording Status */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Status</span>
                  <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                    session?.status === 'recording' 
                      ? 'bg-red-100 text-red-700'
                      : session?.status === 'processing'
                      ? 'bg-yellow-100 text-yellow-700'
                      : session?.status === 'completed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      session?.status === 'recording' ? 'bg-red-500 animate-pulse' : 
                      session?.status === 'processing' ? 'bg-yellow-500 animate-pulse' :
                      session?.status === 'completed' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    {session?.status || 'Ready'}
                  </div>
                </div>

                {session && (
                  <div className="text-2xl font-mono text-center py-3 bg-gray-50 rounded-lg">
                    {formatDuration(session.duration)}
                  </div>
                )}
              </div>

              {/* Recording Controls */}
              <div className="space-y-3">
                {!session || session.status === 'idle' ? (
                  <button
                    onClick={startRecording}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-xl font-medium hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    <Play className="w-5 h-5" />
                    Start Recording
                  </button>
                ) : session.status === 'recording' ? (
                  <button
                    onClick={stopRecording}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white py-3 px-4 rounded-xl font-medium hover:shadow-lg transition-all"
                  >
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </button>
                ) : session.status === 'processing' ? (
                  <div className="w-full flex items-center justify-center gap-2 bg-yellow-100 text-yellow-700 py-3 px-4 rounded-xl font-medium">
                    <Zap className="w-5 h-5 animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <button
                    onClick={exportRecording}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-xl font-medium hover:shadow-lg transition-all transform hover:scale-105"
                  >
                    <Download className="w-5 h-5" />
                    Export Test
                  </button>
                )}

                <button className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium hover:border-gray-300 transition-all">
                  <Upload className="w-5 h-5" />
                  Import Existing
                </button>
              </div>

              {/* Quick Stats */}
              {session && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Session Stats</h3>
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-blue-600">{session.actions.length}</div>
                      <div className="text-xs text-gray-600">Actions</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3">
                      <div className="text-2xl font-bold text-purple-600">{recordingType}</div>
                      <div className="text-xs text-gray-600">Platform</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Recording Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="w-6 h-6" />
                  Live Preview
                </h2>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <Camera className="w-5 h-5" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                    <Target className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Device/Browser Preview */}
              <div className="relative">
                {recordingType === 'mobile' ? (
                  <div className="mx-auto w-80 h-[640px] bg-black rounded-[3rem] border-8 border-gray-800 shadow-2xl overflow-hidden">
                    <div className="w-full h-full bg-white rounded-[2rem] flex items-center justify-center">
                      {session?.status === 'recording' ? (
                        <div className="text-center">
                          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
                            <Camera className="w-8 h-8 text-white" />
                          </div>
                          <p className="text-gray-600">Recording mobile interactions...</p>
                          <p className="text-sm text-gray-400 mt-2">{session.metadata.deviceName}</p>
                        </div>
                      ) : (
                        <div className="text-center text-gray-400">
                          <Smartphone className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p>Connect your device to start recording</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-[500px] border-4 border-gray-300 rounded-xl bg-gray-50 flex items-center justify-center">
                    {session?.status === 'recording' ? (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto animate-pulse">
                          <Monitor className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-gray-600">Recording web interactions...</p>
                        <p className="text-sm text-gray-400 mt-2">{session.metadata.url}</p>
                      </div>
                    ) : (
                      <div className="text-center text-gray-400">
                        <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>Open your browser to start recording</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Timeline */}
              {session && session.actions.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recorded Actions</h3>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {session.actions.map((action, index) => (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-sm font-medium">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 capitalize">{action.type}</div>
                          <div className="text-sm text-gray-500">
                            {action.text && `"${action.text}"`}
                            {action.element && `on ${action.element}`}
                            {action.coordinates && `at (${action.coordinates.x}, ${action.coordinates.y})`}
                          </div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(action.timestamp).toLocaleTimeString()}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}