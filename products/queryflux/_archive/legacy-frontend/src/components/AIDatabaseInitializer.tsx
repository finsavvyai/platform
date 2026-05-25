/**
 * AI Database Initializer Component
 *
 * This component provides a comprehensive UI for the AI-powered database
 * initialization system, allowing users to describe their database needs
 * in natural language or upload dump files for intelligent analysis.
 */

import React, { useState, useCallback } from 'react';
import {
  Upload,
  Wand2,
  Database,
  Settings,
  PlayCircle,
  CheckCircle,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Download,
  ChevronRight,
  Zap,
  Brain,
  Target,
  TrendingUp,
  Shield,
  Globe,
  Loader2,
  X,
  Plus,
  Minus,
  Info,
  HelpCircle
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

// Import AI Database Initialization System
import {
  AIDatabaseInitializationEngine,
  AIDatabaseInitializationConfig
} from '../core/ai-database-initialization/AIDatabaseInitializationEngine';

interface AIDatabaseInitializerProps {
  onDatabaseCreated?: (database: any) => void;
  onCancel?: () => void;
}

export function AIDatabaseInitializer({ onDatabaseCreated, onCancel }: AIDatabaseInitializerProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  // State management
  const [inputType, setInputType] = useState<'natural_language' | 'dump_file' | 'mixed'>('natural_language');
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<any>(null);
  const [creationPlan, setCreationPlan] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState<'input' | 'analysis' | 'recommendations' | 'plan' | 'execution'>('input');

  // Preferences state
  const [preferences, setPreferences] = useState({
    budgetRange: { min: 0, max: 1000, currency: 'USD' },
    preferredCloud: [] as string[],
    complianceRequirements: [] as string[],
    teamSize: 'small',
    technicalLevel: 'intermediate' as 'beginner' | 'intermediate' | 'advanced' | 'expert'
  });

  // Initialize AI Engine
  const [aiEngine] = useState(() => {
    const config: AIDatabaseInitializationConfig = {
      modelProvider: 'openai',
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 4000,
      enableCache: true,
      enableTelemetry: false,
      integrationSettings: {
        cloudProviders: [],
        monitoringTools: [],
        cicdPlatforms: [],
        securityTools: []
      }
    };
    return new AIDatabaseInitializationEngine(config);
  });

  // Handle natural language input analysis
  const handleAnalyze = useCallback(async () => {
    if (!naturalLanguageInput.trim() && !uploadedFile) {
      alert('Please provide either natural language description or upload a dump file');
      return;
    }

    setIsAnalyzing(true);
    setCreationProgress(0);

    try {
      const input = uploadedFile || naturalLanguageInput;
      const result = await aiEngine.initializeDatabase(input, {
        inputType,
        preferences
      });

      setAnalysis(result.analysis);
      setSelectedRecommendation(result.recommendations[0]);
      setCreationPlan(result.creationPlan);
      setActiveTab('analysis');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, [naturalLanguageInput, uploadedFile, inputType, preferences, aiEngine]);

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setInputType('dump_file');
    }
  }, []);

  // Handle database creation
  const handleCreateDatabase = useCallback(async () => {
    if (!creationPlan) return;

    setIsCreating(true);
    setCreationProgress(0);

    try {
      const result = await aiEngine.executeCreationPlan(creationPlan);

      if (result.success) {
        setActiveTab('execution');
        onDatabaseCreated?.({
          ...selectedRecommendation,
          creationResult: result
        });
      } else {
        alert(`Database creation failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      console.error('Database creation failed:', error);
      alert(`Database creation failed: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  }, [creationPlan, selectedRecommendation, aiEngine, onDatabaseCreated]);

  // Render input section
  const renderInputSection = () => (
    <div className="space-y-6">
      {/* Input Type Selection */}
      <div className="flex gap-2 p-1 rounded-lg glass-card">
        <button
          onClick={() => setInputType('natural_language')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            inputType === 'natural_language'
              ? 'text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          style={{
            backgroundColor: inputType === 'natural_language' ? theme.colors.accent : 'transparent'
          }}
        >
          <Brain className="w-4 h-4 inline mr-2" />
          Describe Your Needs
        </button>
        <button
          onClick={() => setInputType('dump_file')}
          className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all ${
            inputType === 'dump_file'
              ? 'text-white'
              : 'text-gray-600 hover:text-gray-900'
          }`}
          style={{
            backgroundColor: inputType === 'dump_file' ? theme.colors.accent : 'transparent'
          }}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload Dump File
        </button>
      </div>

      {/* Natural Language Input */}
      {inputType === 'natural_language' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Wand2 className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
              Describe your database requirements
            </h3>
          </div>

          <textarea
            value={naturalLanguageInput}
            onChange={(e) => setNaturalLanguageInput(e.target.value)}
            placeholder="E.g., 'I need a PostgreSQL database for an e-commerce platform that can handle 10,000 concurrent users with 99.9% uptime. I expect to store products, orders, and customer data with complex relationships. Budget is around $500/month.'"
            className="w-full h-32 px-4 py-3 rounded-lg glass-card border outline-none resize-none text-sm"
            style={{ borderColor: theme.colors.border, color: theme.colors.text }}
          />

          <div className="flex items-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
            <span>Be specific about:</span>
            <span>• Expected scale</span>
            <span>• Performance needs</span>
            <span>• Data types</span>
            <span>• Budget constraints</span>
            <span>• Compliance requirements</span>
          </div>
        </div>
      )}

      {/* File Upload */}
      {inputType === 'dump_file' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5" style={{ color: theme.colors.accent }} />
            <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
              Upload your database dump file
            </h3>
          </div>

          <div className="border-2 border-dashed rounded-lg p-8 text-center glass-card"
               style={{ borderColor: theme.colors.border }}>
            {uploadedFile ? (
              <div className="space-y-3">
                <FileText className="w-12 h-12 mx-auto" style={{ color: theme.colors.accent }} />
                <div>
                  <p className="font-medium" style={{ color: theme.colors.text }}>
                    {uploadedFile.name}
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setUploadedFile(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover-3d"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-12 h-12 mx-auto" style={{ color: theme.colors.textSecondary }} />
                <div>
                  <p className="font-medium" style={{ color: theme.colors.text }}>
                    Drop your dump file here or click to browse
                  </p>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    Supports SQL, JSON, CSV, BSON files up to 100MB
                  </p>
                </div>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".sql,.json,.csv,.bson,.dump"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-6 py-3 rounded-lg font-medium text-white transition-all hover-3d cursor-pointer"
                  style={{ backgroundColor: theme.colors.accent }}
                >
                  Choose File
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preferences */}
      <div className="p-4 rounded-lg glass-card space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5" style={{ color: theme.colors.accent }} />
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.text }}>
            Preferences
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Budget Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text }}>
              Monthly Budget Range
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={preferences.budgetRange.min}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  budgetRange: { ...prev.budgetRange, min: parseInt(e.target.value) || 0 }
                }))}
                className="flex-1 px-3 py-2 rounded-lg border outline-none text-sm"
                style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                placeholder="Min"
              />
              <span style={{ color: theme.colors.textSecondary }}>-</span>
              <input
                type="number"
                value={preferences.budgetRange.max}
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  budgetRange: { ...prev.budgetRange, max: parseInt(e.target.value) || 0 }
                }))}
                className="flex-1 px-3 py-2 rounded-lg border outline-none text-sm"
                style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                placeholder="Max"
              />
            </div>
          </div>

          {/* Technical Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: theme.colors.text }}>
              Technical Experience
            </label>
            <select
              value={preferences.technicalLevel}
              onChange={(e) => setPreferences(prev => ({
                ...prev,
                technicalLevel: e.target.value as any
              }))}
              className="w-full px-3 py-2 rounded-lg border outline-none text-sm"
              style={{ borderColor: theme.colors.border, color: theme.colors.text, backgroundColor: theme.colors.background }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
        </div>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing || (!naturalLanguageInput.trim() && !uploadedFile)}
        className="w-full py-4 text-white rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover-3d"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`,
          fontSize: '16px'
        }}
      >
        {isAnalyzing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Analyzing Requirements...
          </>
        ) : (
          <>
            <Zap className="w-5 h-5" />
            Analyze and Generate Database Setup
          </>
        )}
      </button>
    </div>
  );

  // Render analysis results
  const renderAnalysisSection = () => {
    if (!analysis) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6" style={{ color: theme.colors.accent }} />
          <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
            Analysis Results
          </h2>
        </div>

        {/* Requirements Summary */}
        <div className="p-4 rounded-lg glass-card space-y-3">
          <h3 className="font-semibold" style={{ color: theme.colors.text }}>
            Extracted Requirements
          </h3>
          <div className="space-y-2">
            {analysis.extractedRequirements.map((req: any, index: number) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg"
                   style={{ backgroundColor: theme.colors.sidebar }}>
                <div className="w-2 h-2 rounded-full mt-2"
                     style={{ backgroundColor:
                       req.priority === 'critical' ? '#ef4444' :
                       req.priority === 'high' ? '#f59e0b' :
                       req.priority === 'medium' ? '#3b82f6' : '#10b981'
                     }} />
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    {req.description}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      Type: {req.type}
                    </span>
                    <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      Priority: {req.priority}
                    </span>
                    <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                      Load: {req.estimatedLoad}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Continue to Recommendations */}
        <button
          onClick={() => setActiveTab('recommendations')}
          className="w-full py-3 text-white rounded-lg font-medium transition-all hover-3d flex items-center justify-center gap-2"
          style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
        >
          View Recommendations
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Render recommendations
  const renderRecommendationsSection = () => {
    if (!analysis) return null;

    const recommendations = analysis.recommendedDatabases || [selectedRecommendation];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Target className="w-6 h-6" style={{ color: theme.colors.accent }} />
          <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
            Database Recommendations
          </h2>
        </div>

        <div className="space-y-4">
          {recommendations.map((rec: any, index: number) => (
            <div
              key={index}
              className={`p-4 rounded-lg glass-card cursor-pointer transition-all hover-3d ${
                selectedRecommendation?.databaseType === rec.databaseType ? 'ring-2' : ''
              }`}
              style={{
                borderColor: selectedRecommendation?.databaseType === rec.databaseType
                  ? theme.colors.accent
                  : theme.colors.border
              }}
              onClick={() => setSelectedRecommendation(rec)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Database className="w-6 h-6" style={{ color: theme.colors.accent }} />
                  <div>
                    <h3 className="font-semibold text-lg" style={{ color: theme.colors.text }}>
                      {rec.databaseType.charAt(0).toUpperCase() + rec.databaseType.slice(1)}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-1 rounded-full text-white"
                            style={{ backgroundColor: theme.colors.accent }}>
                        {Math.round(rec.confidence * 100)}% Match
                      </span>
                      <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        Migration: {rec.migrationComplexity}
                      </span>
                    </div>
                  </div>
                </div>
                <DollarSign className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
              </div>

              <p className="text-sm mb-4" style={{ color: theme.colors.text }}>
                {rec.reasoning}
              </p>

              {/* Performance Profile */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.sidebar }}>
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4" style={{ color: theme.colors.accent }} />
                    <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                      Performance
                    </span>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                    <div>Read: {rec.performanceProfile?.throughput?.readsPerSecond}/sec</div>
                    <div>Write: {rec.performanceProfile?.throughput?.writesPerSecond}/sec</div>
                    <div>Latency: {rec.performanceProfile?.latency?.readLatency}ms</div>
                  </div>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.sidebar }}>
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="w-4 h-4" style={{ color: theme.colors.accent }} />
                    <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                      Cost Estimate
                    </span>
                  </div>
                  <div className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
                    <div>Monthly: ${rec.estimatedCost?.monthly}/month</div>
                    <div>Annual: ${rec.estimatedCost?.annual}/year</div>
                  </div>
                </div>
              </div>

              {/* Pros and Cons */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Pros
                  </h4>
                  <ul className="space-y-1">
                    {rec.pros?.slice(0, 3).map((pro: string, i: number) => (
                      <li key={i} className="text-xs flex items-start gap-1">
                        <CheckCircle className="w-3 h-3 mt-0.5" style={{ color: '#10b981' }} />
                        <span style={{ color: theme.colors.textSecondary }}>{pro}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-2" style={{ color: theme.colors.text }}>
                    Considerations
                  </h4>
                  <ul className="space-y-1">
                    {rec.cons?.slice(0, 3).map((con: string, i: number) => (
                      <li key={i} className="text-xs flex items-start gap-1">
                        <AlertCircle className="w-3 h-3 mt-0.5" style={{ color: '#f59e0b' }} />
                        <span style={{ color: theme.colors.textSecondary }}>{con}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Continue to Plan */}
        {selectedRecommendation && (
          <button
            onClick={() => setActiveTab('plan')}
            className="w-full py-3 text-white rounded-lg font-medium transition-all hover-3d flex items-center justify-center gap-2"
            style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
          >
            Generate Creation Plan
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  // Render creation plan
  const renderPlanSection = () => {
    if (!creationPlan) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <FileText className="w-6 h-6" style={{ color: theme.colors.accent }} />
          <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
            Creation Plan
          </h2>
        </div>

        {/* Plan Summary */}
        <div className="p-4 rounded-lg glass-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: theme.colors.text }}>
              Implementation Summary
            </h3>
            <div className="flex items-center gap-4 text-sm" style={{ color: theme.colors.textSecondary }}>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{creationPlan.estimatedDuration} min</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                <span>${creationPlan.estimatedCost?.monthly}/mo</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {creationPlan.steps?.map((step: any, index: number) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg"
                   style={{ backgroundColor: theme.colors.sidebar }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium text-white"
                     style={{ backgroundColor: theme.colors.accent }}>
                  {step.order}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
                    {step.name}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    {step.description}
                  </p>
                </div>
                <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  {step.estimatedDuration} min
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Prerequisites */}
        <div className="p-4 rounded-lg glass-card">
          <h3 className="font-semibold mb-3" style={{ color: theme.colors.text }}>
            Prerequisites
          </h3>
          <ul className="space-y-2">
            {creationPlan.prerequisites?.map((prereq: any, index: number) => (
              <li key={index} className="flex items-start gap-2">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  prereq.required ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className="text-sm" style={{ color: theme.colors.text }}>
                    {prereq.description}
                  </p>
                  <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                    Verification: {prereq.verificationMethod}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Execute Button */}
        <button
          onClick={handleCreateDatabase}
          disabled={isCreating}
          className="w-full py-4 text-white rounded-lg font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-3 hover-3d"
          style={{
            background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`,
            fontSize: '16px'
          }}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating Database... ({creationProgress}%)
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5" />
              Execute Creation Plan
            </>
          )}
        </button>
      </div>
    );
  };

  // Render execution results
  const renderExecutionSection = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-6 h-6 text-green-500" />
        <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
          Database Created Successfully!
        </h2>
      </div>

      <div className="p-6 rounded-lg glass-card text-center">
        <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
        <h3 className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
          Your {selectedRecommendation?.databaseType} database is ready
        </h3>
        <p className="text-sm mb-6" style={{ color: theme.colors.textSecondary }}>
          Database has been configured and is ready to use
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.sidebar }}>
            <Database className="w-8 h-8 mx-auto mb-2" style={{ color: theme.colors.accent }} />
            <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
              Database Type
            </p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
              {selectedRecommendation?.databaseType}
            </p>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.sidebar }}>
            <Shield className="w-8 h-8 mx-auto mb-2" style={{ color: theme.colors.accent }} />
            <p className="text-sm font-medium" style={{ color: theme.colors.text }}>
              Security
            </p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
              Encrypted & Compliant
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onDatabaseCreated?.(selectedRecommendation)}
            className="flex-1 py-3 text-white rounded-lg font-medium transition-all hover-3d"
            style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
          >
            Start Using Database
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-3 rounded-lg border font-medium transition-all hover-3d"
            style={{ borderColor: theme.colors.border, color: theme.colors.text }}
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 rounded-lg glass-morphism" style={{ backgroundColor: theme.colors.background }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center"
               style={{ backgroundColor: theme.colors.accent }}>
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
              AI Database Initialization
            </h1>
            <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
              Describe your needs or upload a dump file to create the perfect database setup
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 rounded-lg glass-morphism hover-3d transition-all"
            title="Close"
          >
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        )}
      </div>

      {/* Progress Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg glass-card">
        {[
          { id: 'input', label: 'Input', icon: Brain },
          { id: 'analysis', label: 'Analysis', icon: TrendingUp },
          { id: 'recommendations', label: 'Recommendations', icon: Target },
          { id: 'plan', label: 'Plan', icon: FileText },
          { id: 'execution', label: 'Results', icon: CheckCircle }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            disabled={!analysis && tab.id !== 'input'}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all text-sm ${
              activeTab === tab.id
                ? 'text-white'
                : 'text-gray-600 hover:text-gray-900 disabled:opacity-30'
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? theme.colors.accent : 'transparent'
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {activeTab === 'input' && renderInputSection()}
        {activeTab === 'analysis' && renderAnalysisSection()}
        {activeTab === 'recommendations' && renderRecommendationsSection()}
        {activeTab === 'plan' && renderPlanSection()}
        {activeTab === 'execution' && renderExecutionSection()}
      </div>
    </div>
  );
}
