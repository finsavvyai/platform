import { useState, useEffect } from 'react';
import { X, Search, Package, Download, Check, Star, DollarSign, Crown, Filter, Brain, Database, Shield, Cloud, BarChart3, Code, Zap, FileText, Settings, TrendingUp, Lock, GitBranch, Palette, Globe, Activity, Cpu, MessageSquare, FileCode, Boxes, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';

interface AdvancedPluginMarketplaceProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Plugin {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string;
  version: string;
  author: string;
  icon: any;
  category: PluginCategory;
  subcategory: string;
  isFree: boolean;
  price: number;
  features: string[];
  useCases: string[];
  requirements: string[];
  installCount: number;
  rating: number;
  reviews: number;
  lastUpdated: string;
  compatibility: string[];
  tags: string[];
}

type PluginCategory = 'ai-query' | 'analytics-ml' | 'development' | 'visualization' | 'security' | 'cloud' | 'productivity' | 'industry';

interface InstalledPlugin {
  pluginId: string;
  enabled: boolean;
  installedAt: string;
}

export function AdvancedPluginMarketplace({ isOpen, onClose }: AdvancedPluginMarketplaceProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<Map<string, InstalledPlugin>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | 'all'>('all');
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);

  const categories = [
    { id: 'all' as const, label: 'All Plugins', icon: Package, color: theme.colors.accent },
    { id: 'ai-query' as PluginCategory, label: 'AI & Query', icon: Brain, color: '#8b5cf6' },
    { id: 'analytics-ml' as PluginCategory, label: 'Analytics & ML', icon: TrendingUp, color: '#3b82f6' },
    { id: 'development' as PluginCategory, label: 'Development', icon: Code, color: '#10b981' },
    { id: 'visualization' as PluginCategory, label: 'Visualization', icon: BarChart3, color: '#f59e0b' },
    { id: 'security' as PluginCategory, label: 'Security', icon: Shield, color: '#ef4444' },
    { id: 'cloud' as PluginCategory, label: 'Cloud & Deploy', icon: Cloud, color: '#06b6d4' },
    { id: 'productivity' as PluginCategory, label: 'Productivity', icon: Zap, color: '#ec4899' },
    { id: 'industry' as PluginCategory, label: 'Industry', icon: Boxes, color: '#6366f1' },
  ];

  const mockPlugins: Plugin[] = [
    {
      id: '1',
      name: 'Natural Language Query',
      slug: 'nl-query',
      description: 'Convert natural language to SQL using advanced AI',
      longDescription: 'Transform spoken or written natural language into optimized SQL queries. Perfect for non-technical users who need to interact with databases without knowing SQL syntax.',
      version: '2.1.0',
      author: 'QueryFlux AI Team',
      icon: MessageSquare,
      category: 'ai-query',
      subcategory: 'Natural Language Processing',
      isFree: true,
      price: 0,
      features: [
        'Convert natural language to SQL',
        'Support for complex queries',
        'Multi-database compatibility',
        'Context-aware suggestions',
        'Query explanation in plain English'
      ],
      useCases: [
        'Business analysts generating reports',
        'Non-technical users querying data',
        'Quick data exploration'
      ],
      requirements: ['Database connection', 'Internet access for AI'],
      installCount: 15420,
      rating: 4.8,
      reviews: 342,
      lastUpdated: '2025-09-15',
      compatibility: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle'],
      tags: ['AI', 'NLP', 'Query Generation', 'Popular']
    },
    {
      id: '2',
      name: 'Query Optimizer Pro',
      slug: 'query-optimizer',
      description: 'AI-powered SQL query optimization and performance tuning',
      longDescription: 'Automatically analyze and optimize your SQL queries for maximum performance. Uses machine learning to identify bottlenecks and suggest improvements.',
      version: '1.8.5',
      author: 'Performance Labs',
      icon: Zap,
      category: 'ai-query',
      subcategory: 'Query Optimization',
      isFree: false,
      price: 49.99,
      features: [
        'Automatic query rewriting',
        'Index recommendations',
        'Execution plan analysis',
        'Performance benchmarking',
        'Real-time optimization alerts'
      ],
      useCases: [
        'Slow query troubleshooting',
        'Database performance tuning',
        'Production optimization'
      ],
      requirements: ['Premium subscription', 'Database admin access'],
      installCount: 8230,
      rating: 4.9,
      reviews: 187,
      lastUpdated: '2025-09-20',
      compatibility: ['PostgreSQL', 'MySQL', 'SQL Server'],
      tags: ['Premium', 'Performance', 'Optimization', 'Trending']
    },
    {
      id: '3',
      name: 'Vector Search Engine',
      slug: 'vector-search',
      description: 'Add semantic search and vector embeddings to your database',
      longDescription: 'Enable advanced AI features like semantic search, similarity matching, and RAG implementations directly in your database environment.',
      version: '3.0.2',
      author: 'VectorDB Inc',
      icon: Brain,
      category: 'ai-query',
      subcategory: 'Vector Database',
      isFree: false,
      price: 79.99,
      features: [
        'Vector embeddings generation',
        'Semantic similarity search',
        'RAG implementation support',
        'Multi-modal search capabilities',
        'Integration with popular LLMs'
      ],
      useCases: [
        'AI-powered search applications',
        'Recommendation engines',
        'Content discovery systems'
      ],
      requirements: ['Premium subscription', 'pgvector or equivalent'],
      installCount: 5680,
      rating: 4.7,
      reviews: 94,
      lastUpdated: '2025-09-18',
      compatibility: ['PostgreSQL with pgvector', 'Supabase'],
      tags: ['Premium', 'AI', 'Vector', 'New']
    },
    {
      id: '4',
      name: 'In-Database ML',
      slug: 'ml-engine',
      description: 'Train and deploy ML models directly in your database',
      longDescription: 'Eliminate data movement by training machine learning models directly within your database. Supports multiple ML frameworks and provides seamless integration.',
      version: '2.5.1',
      author: 'ML Systems',
      icon: Cpu,
      category: 'analytics-ml',
      subcategory: 'Machine Learning',
      isFree: false,
      price: 99.99,
      features: [
        'Train ML models in-database',
        'Support for TensorFlow and PyTorch',
        'Automated feature engineering',
        'Model versioning and deployment',
        'Real-time prediction APIs'
      ],
      useCases: [
        'Predictive analytics',
        'Fraud detection',
        'Customer segmentation'
      ],
      requirements: ['Premium subscription', 'Python runtime'],
      installCount: 3420,
      rating: 4.6,
      reviews: 67,
      lastUpdated: '2025-09-10',
      compatibility: ['PostgreSQL', 'Supabase'],
      tags: ['Premium', 'ML', 'Advanced']
    },
    {
      id: '5',
      name: 'Anomaly Detector',
      slug: 'anomaly-detection',
      description: 'Real-time detection of unusual database patterns',
      longDescription: 'Monitor your database in real-time and automatically detect anomalies in performance, query patterns, and data integrity using advanced AI algorithms.',
      version: '1.9.3',
      author: 'Security Analytics',
      icon: Activity,
      category: 'analytics-ml',
      subcategory: 'Anomaly Detection',
      isFree: false,
      price: 59.99,
      features: [
        'Real-time monitoring',
        'AI-powered anomaly detection',
        'Customizable alert thresholds',
        'Historical pattern analysis',
        'Automated incident reports'
      ],
      useCases: [
        'Security monitoring',
        'Performance tracking',
        'Data quality assurance'
      ],
      requirements: ['Premium subscription', 'Monitoring access'],
      installCount: 6890,
      rating: 4.8,
      reviews: 156,
      lastUpdated: '2025-09-22',
      compatibility: ['All databases'],
      tags: ['Premium', 'Security', 'Monitoring', 'Popular']
    },
    {
      id: '6',
      name: 'Predictive Analytics',
      slug: 'predictive-analytics',
      description: 'Forecast trends and predict future database needs',
      longDescription: 'Analyze historical trends to predict capacity requirements, performance bottlenecks, and maintenance needs before they become critical issues.',
      version: '2.2.0',
      author: 'Analytics Pro',
      icon: TrendingUp,
      category: 'analytics-ml',
      subcategory: 'Forecasting',
      isFree: false,
      price: 69.99,
      features: [
        'Capacity planning forecasts',
        'Performance prediction',
        'Growth trend analysis',
        'Resource optimization recommendations',
        'Custom prediction models'
      ],
      useCases: [
        'Infrastructure planning',
        'Budget forecasting',
        'Scaling decisions'
      ],
      requirements: ['Premium subscription', 'Historical data access'],
      installCount: 4320,
      rating: 4.7,
      reviews: 89,
      lastUpdated: '2025-09-17',
      compatibility: ['All databases'],
      tags: ['Premium', 'Analytics', 'Planning']
    },
    {
      id: '7',
      name: 'Multi-DB Connector',
      slug: 'multi-db-connector',
      description: 'Connect to multiple database systems seamlessly',
      longDescription: 'Universal database connector supporting MySQL, PostgreSQL, Oracle, MongoDB, Snowflake, BigQuery, and more. Unified interface for all your databases.',
      version: '3.1.0',
      author: 'Integration Team',
      icon: Database,
      category: 'development',
      subcategory: 'Connectivity',
      isFree: true,
      price: 0,
      features: [
        'Support for 20+ database systems',
        'Unified query interface',
        'Cross-database queries',
        'Connection pooling',
        'SSL/TLS encryption'
      ],
      useCases: [
        'Multi-database management',
        'Data migration',
        'Cross-platform development'
      ],
      requirements: ['Database credentials'],
      installCount: 12450,
      rating: 4.9,
      reviews: 278,
      lastUpdated: '2025-09-19',
      compatibility: ['All platforms'],
      tags: ['Free', 'Popular', 'Essential']
    },
    {
      id: '8',
      name: 'Git Integration',
      slug: 'git-integration',
      description: 'Version control for database schemas and migrations',
      longDescription: 'Track database schema changes with Git, manage migrations, and maintain complete version history of your database structures.',
      version: '2.0.8',
      author: 'DevOps Tools',
      icon: GitBranch,
      category: 'development',
      subcategory: 'Version Control',
      isFree: true,
      price: 0,
      features: [
        'Git integration for schemas',
        'Migration management',
        'Diff visualization',
        'Rollback capabilities',
        'Team collaboration'
      ],
      useCases: [
        'Schema version control',
        'Team collaboration',
        'Migration tracking'
      ],
      requirements: ['Git repository'],
      installCount: 9870,
      rating: 4.8,
      reviews: 203,
      lastUpdated: '2025-09-21',
      compatibility: ['All databases'],
      tags: ['Free', 'DevOps', 'Popular']
    },
    {
      id: '9',
      name: 'API Gateway Auto',
      slug: 'api-gateway',
      description: 'Automatically generate REST and GraphQL APIs',
      longDescription: 'Instantly generate production-ready REST and GraphQL APIs from your database schemas. Includes authentication, rate limiting, and documentation.',
      version: '1.7.4',
      author: 'API Systems',
      icon: Globe,
      category: 'development',
      subcategory: 'API Generation',
      isFree: false,
      price: 39.99,
      features: [
        'Auto-generate REST APIs',
        'GraphQL support',
        'Built-in authentication',
        'Rate limiting',
        'OpenAPI documentation'
      ],
      useCases: [
        'Rapid API development',
        'Mobile app backends',
        'Microservices architecture'
      ],
      requirements: ['Premium subscription'],
      installCount: 7560,
      rating: 4.7,
      reviews: 142,
      lastUpdated: '2025-09-16',
      compatibility: ['PostgreSQL', 'MySQL', 'MongoDB'],
      tags: ['Premium', 'API', 'Development']
    },
    {
      id: '10',
      name: 'Dashboard Builder Pro',
      slug: 'dashboard-builder',
      description: 'Create interactive dashboards and visualizations',
      longDescription: 'Build beautiful, interactive dashboards with real-time data visualization. Drag-and-drop interface with 50+ chart types and customization options.',
      version: '2.8.0',
      author: 'Viz Labs',
      icon: BarChart3,
      category: 'visualization',
      subcategory: 'Dashboards',
      isFree: false,
      price: 49.99,
      features: [
        '50+ chart types',
        'Drag-and-drop builder',
        'Real-time data updates',
        'Custom themes',
        'Export to PDF/PNG'
      ],
      useCases: [
        'Business intelligence',
        'Executive dashboards',
        'Real-time monitoring'
      ],
      requirements: ['Premium subscription'],
      installCount: 11230,
      rating: 4.9,
      reviews: 267,
      lastUpdated: '2025-09-23',
      compatibility: ['All databases'],
      tags: ['Premium', 'Visualization', 'Popular', 'Trending']
    },
    {
      id: '11',
      name: 'Schema Visualizer',
      slug: 'schema-visualizer',
      description: 'Generate ER diagrams and database architecture visualizations',
      longDescription: 'Automatically generate entity-relationship diagrams, dependency graphs, and complete database architecture visualizations for documentation and planning.',
      version: '1.6.2',
      author: 'Diagram Tools',
      icon: Palette,
      category: 'visualization',
      subcategory: 'Schema Diagrams',
      isFree: true,
      price: 0,
      features: [
        'Auto-generate ER diagrams',
        'Dependency visualization',
        'Interactive exploration',
        'Export to multiple formats',
        'Customizable layouts'
      ],
      useCases: [
        'Database documentation',
        'Architecture planning',
        'Team onboarding'
      ],
      requirements: ['Database access'],
      installCount: 13450,
      rating: 4.8,
      reviews: 301,
      lastUpdated: '2025-09-14',
      compatibility: ['All databases'],
      tags: ['Free', 'Visualization', 'Popular']
    },
    {
      id: '12',
      name: 'Report Generator AI',
      slug: 'report-generator',
      description: 'AI-powered automated report generation',
      longDescription: 'Generate comprehensive reports with AI-powered insights and recommendations. Schedule automated reports and distribute to stakeholders.',
      version: '2.3.5',
      author: 'Report Systems',
      icon: FileText,
      category: 'visualization',
      subcategory: 'Reporting',
      isFree: false,
      price: 54.99,
      features: [
        'AI-powered insights',
        'Scheduled report generation',
        'Email distribution',
        'Multiple export formats',
        'Custom templates'
      ],
      useCases: [
        'Automated reporting',
        'Executive summaries',
        'Compliance reports'
      ],
      requirements: ['Premium subscription'],
      installCount: 6780,
      rating: 4.7,
      reviews: 134,
      lastUpdated: '2025-09-12',
      compatibility: ['All databases'],
      tags: ['Premium', 'AI', 'Reports']
    },
    {
      id: '13',
      name: 'Data Governance Suite',
      slug: 'data-governance',
      description: 'Complete data governance and compliance management',
      longDescription: 'Track data lineage, ensure privacy compliance (GDPR, HIPAA), and automate data classification. Essential for regulated industries.',
      version: '3.2.1',
      author: 'Compliance Corp',
      icon: Lock,
      category: 'security',
      subcategory: 'Governance',
      isFree: false,
      price: 149.99,
      features: [
        'Data lineage tracking',
        'GDPR/HIPAA compliance',
        'Automated data classification',
        'Access audit logs',
        'Compliance reporting'
      ],
      useCases: [
        'Regulatory compliance',
        'Data privacy management',
        'Audit preparation'
      ],
      requirements: ['Premium subscription', 'Admin access'],
      installCount: 2890,
      rating: 4.9,
      reviews: 56,
      lastUpdated: '2025-09-20',
      compatibility: ['PostgreSQL', 'SQL Server', 'Oracle'],
      tags: ['Premium', 'Compliance', 'Enterprise']
    },
    {
      id: '14',
      name: 'Encryption Manager',
      slug: 'encryption-manager',
      description: 'Field-level encryption and key management',
      longDescription: 'Implement field-level encryption, tokenization, and secure key management integrated with your workflows. Military-grade security.',
      version: '2.1.3',
      author: 'CryptoSec',
      icon: Shield,
      category: 'security',
      subcategory: 'Encryption',
      isFree: false,
      price: 89.99,
      features: [
        'Field-level encryption',
        'Key rotation management',
        'Tokenization support',
        'HSM integration',
        'Audit logging'
      ],
      useCases: [
        'Sensitive data protection',
        'PCI compliance',
        'Healthcare data security'
      ],
      requirements: ['Premium subscription', 'Security admin access'],
      installCount: 4230,
      rating: 4.8,
      reviews: 87,
      lastUpdated: '2025-09-18',
      compatibility: ['PostgreSQL', 'MySQL', 'SQL Server'],
      tags: ['Premium', 'Security', 'Enterprise']
    },
    {
      id: '15',
      name: 'Audit Trail Pro',
      slug: 'audit-trail',
      description: 'Comprehensive logging and monitoring',
      longDescription: 'Track all database operations, AI model executions, and user activities. Complete audit trail with tamper-proof logging.',
      version: '1.9.0',
      author: 'Audit Systems',
      icon: FileCode,
      category: 'security',
      subcategory: 'Auditing',
      isFree: false,
      price: 44.99,
      features: [
        'Complete operation logging',
        'Tamper-proof storage',
        'Advanced search and filtering',
        'Real-time alerts',
        'Compliance reports'
      ],
      useCases: [
        'Security auditing',
        'Compliance tracking',
        'Incident investigation'
      ],
      requirements: ['Premium subscription'],
      installCount: 8970,
      rating: 4.8,
      reviews: 189,
      lastUpdated: '2025-09-22',
      compatibility: ['All databases'],
      tags: ['Premium', 'Security', 'Compliance']
    },
    {
      id: '16',
      name: 'Multi-Cloud Deploy',
      slug: 'multi-cloud-deploy',
      description: 'Deploy across AWS, Azure, GCP, and on-premises',
      longDescription: 'Seamlessly deploy and synchronize databases across multiple cloud providers and on-premises environments with automated failover.',
      version: '2.4.2',
      author: 'Cloud Ops',
      icon: Cloud,
      category: 'cloud',
      subcategory: 'Deployment',
      isFree: false,
      price: 129.99,
      features: [
        'Multi-cloud deployment',
        'Automated synchronization',
        'Failover management',
        'Cost optimization',
        'Performance monitoring'
      ],
      useCases: [
        'Disaster recovery',
        'Multi-region deployment',
        'Cloud migration'
      ],
      requirements: ['Premium subscription', 'Cloud credentials'],
      installCount: 3560,
      rating: 4.7,
      reviews: 72,
      lastUpdated: '2025-09-19',
      compatibility: ['AWS', 'Azure', 'GCP', 'On-premises'],
      tags: ['Premium', 'Cloud', 'Enterprise']
    },
    {
      id: '17',
      name: 'Smart Backup AI',
      slug: 'smart-backup',
      description: 'AI-powered backup optimization and recovery',
      longDescription: 'Intelligent backup solutions that optimize storage, predict failure points, and automate recovery procedures using machine learning.',
      version: '1.8.7',
      author: 'Backup Pro',
      icon: Database,
      category: 'cloud',
      subcategory: 'Backup & Recovery',
      isFree: false,
      price: 69.99,
      features: [
        'AI-optimized backups',
        'Incremental backup strategies',
        'Automated recovery testing',
        'Point-in-time recovery',
        'Cross-region replication'
      ],
      useCases: [
        'Disaster recovery',
        'Data protection',
        'Compliance requirements'
      ],
      requirements: ['Premium subscription', 'Storage space'],
      installCount: 7890,
      rating: 4.9,
      reviews: 167,
      lastUpdated: '2025-09-21',
      compatibility: ['All databases'],
      tags: ['Premium', 'Backup', 'Popular']
    },
    {
      id: '18',
      name: 'Performance Monitor 360',
      slug: 'performance-monitor',
      description: 'Real-time performance tracking with AI predictions',
      longDescription: 'Monitor database performance in real-time with AI-powered predictions to prevent bottlenecks before they impact operations.',
      version: '3.0.5',
      author: 'Monitor Labs',
      icon: Activity,
      category: 'cloud',
      subcategory: 'Monitoring',
      isFree: false,
      price: 59.99,
      features: [
        'Real-time monitoring',
        'AI-powered predictions',
        'Customizable dashboards',
        'Automated alerts',
        'Performance recommendations'
      ],
      useCases: [
        'Production monitoring',
        'Capacity planning',
        'Performance optimization'
      ],
      requirements: ['Premium subscription'],
      installCount: 10230,
      rating: 4.8,
      reviews: 234,
      lastUpdated: '2025-09-23',
      compatibility: ['All databases'],
      tags: ['Premium', 'Monitoring', 'Popular']
    },
    {
      id: '19',
      name: 'Code Generator Pro',
      slug: 'code-generator',
      description: 'Generate schemas and code from natural language',
      longDescription: 'Describe your requirements in natural language and automatically generate database schemas, stored procedures, and application code.',
      version: '2.6.1',
      author: 'CodeGen AI',
      icon: Code,
      category: 'productivity',
      subcategory: 'Code Generation',
      isFree: false,
      price: 64.99,
      features: [
        'Natural language to code',
        'Schema generation',
        'Stored procedure creation',
        'Multi-language support',
        'Best practices enforcement'
      ],
      useCases: [
        'Rapid prototyping',
        'Schema design',
        'API development'
      ],
      requirements: ['Premium subscription', 'AI access'],
      installCount: 5670,
      rating: 4.6,
      reviews: 112,
      lastUpdated: '2025-09-17',
      compatibility: ['PostgreSQL', 'MySQL', 'MongoDB'],
      tags: ['Premium', 'AI', 'Development']
    },
    {
      id: '20',
      name: 'Test Data Generator',
      slug: 'test-data-generator',
      description: 'Generate realistic test data with AI',
      longDescription: 'Create realistic test datasets using AI that maintains referential integrity and follows your schema patterns.',
      version: '1.5.9',
      author: 'Test Tools',
      icon: Zap,
      category: 'productivity',
      subcategory: 'Testing',
      isFree: true,
      price: 0,
      features: [
        'AI-generated test data',
        'Referential integrity',
        'Custom data patterns',
        'Performance testing data',
        'Anonymization support'
      ],
      useCases: [
        'Development testing',
        'Performance testing',
        'Demo environments'
      ],
      requirements: ['Database access'],
      installCount: 14560,
      rating: 4.9,
      reviews: 321,
      lastUpdated: '2025-09-20',
      compatibility: ['All databases'],
      tags: ['Free', 'Testing', 'Popular']
    },
    {
      id: '21',
      name: 'Financial Data Suite',
      slug: 'financial-suite',
      description: 'Specialized tools for financial institutions',
      longDescription: 'Complete solution for financial institutions including real-time transaction processing, risk analysis, and regulatory compliance.',
      version: '4.1.0',
      author: 'FinTech Solutions',
      icon: DollarSign,
      category: 'industry',
      subcategory: 'Financial',
      isFree: false,
      price: 299.99,
      features: [
        'Real-time transaction processing',
        'Risk analysis tools',
        'Regulatory compliance',
        'Fraud detection',
        'Financial reporting'
      ],
      useCases: [
        'Banking systems',
        'Payment processing',
        'Risk management'
      ],
      requirements: ['Premium subscription', 'Financial compliance'],
      installCount: 1230,
      rating: 4.9,
      reviews: 28,
      lastUpdated: '2025-09-15',
      compatibility: ['PostgreSQL', 'SQL Server', 'Oracle'],
      tags: ['Premium', 'Financial', 'Enterprise']
    },
    {
      id: '22',
      name: 'Healthcare Data Manager',
      slug: 'healthcare-manager',
      description: 'HIPAA-compliant healthcare data management',
      longDescription: 'Specialized plugin for healthcare organizations with HIPAA compliance, patient data management, and clinical trial support.',
      version: '3.3.2',
      author: 'HealthTech Inc',
      icon: Shield,
      category: 'industry',
      subcategory: 'Healthcare',
      isFree: false,
      price: 249.99,
      features: [
        'HIPAA compliance',
        'Patient data encryption',
        'Clinical trial management',
        'Medical records integration',
        'Audit trail'
      ],
      useCases: [
        'Hospital systems',
        'Clinical research',
        'Patient data management'
      ],
      requirements: ['Premium subscription', 'HIPAA compliance'],
      installCount: 890,
      rating: 4.8,
      reviews: 19,
      lastUpdated: '2025-09-18',
      compatibility: ['PostgreSQL', 'SQL Server'],
      tags: ['Premium', 'Healthcare', 'Enterprise']
    },
    {
      id: '23',
      name: 'IoT Data Handler',
      slug: 'iot-handler',
      description: 'Optimized for IoT and time-series data',
      longDescription: 'Handle massive volumes of time-series data from IoT devices with edge computing capabilities and real-time analytics.',
      version: '2.7.3',
      author: 'IoT Systems',
      icon: Activity,
      category: 'industry',
      subcategory: 'IoT',
      isFree: false,
      price: 89.99,
      features: [
        'Time-series optimization',
        'Edge computing support',
        'Real-time analytics',
        'Device management',
        'Data aggregation'
      ],
      useCases: [
        'Smart devices',
        'Industrial IoT',
        'Sensor networks'
      ],
      requirements: ['Premium subscription'],
      installCount: 4560,
      rating: 4.7,
      reviews: 98,
      lastUpdated: '2025-09-19',
      compatibility: ['PostgreSQL', 'TimescaleDB', 'InfluxDB'],
      tags: ['Premium', 'IoT', 'Time-series']
    },
    {
      id: '24',
      name: 'AI Data Masking Pro',
      slug: 'data-masking-ai',
      description: 'AI-powered intelligent data masking and privacy protection',
      longDescription: 'Protect sensitive data with AI-powered masking strategies. Automatically analyze your database schema, detect sensitive fields, and suggest appropriate masking techniques. Configure masking rules at table and field levels with preview capabilities.',
      version: '2.4.0',
      author: 'DataSec AI',
      icon: EyeOff,
      category: 'security',
      subcategory: 'Data Privacy',
      isFree: false,
      price: 99.99,
      features: [
        'AI-powered sensitivity detection',
        'Smart masking strategy suggestions',
        'Table and field-level configuration',
        'Multiple masking types (hash, encrypt, tokenize, redact, shuffle)',
        'Real-time masking preview',
        'Referential integrity preservation',
        'Reversible masking options',
        'Compliance templates (GDPR, HIPAA, PCI-DSS)',
        'Batch masking operations',
        'Audit trail for all masking activities'
      ],
      useCases: [
        'Development and testing environments',
        'Third-party data sharing',
        'Regulatory compliance',
        'Data privacy protection',
        'Demo and training databases'
      ],
      requirements: ['Premium subscription', 'Database write access'],
      installCount: 6780,
      rating: 4.9,
      reviews: 143,
      lastUpdated: '2025-09-24',
      compatibility: ['PostgreSQL', 'MySQL', 'SQL Server', 'Oracle'],
      tags: ['Premium', 'Security', 'AI', 'Privacy', 'Trending']
    }
  ];

  useEffect(() => {
    if (isOpen) {
      checkPremiumStatus();
      loadPlugins();
      loadInstalledPlugins();
    }
  }, [isOpen]);

  const checkPremiumStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    setHasPremium(!!data);
  };

  const loadPlugins = () => {
    setPlugins(mockPlugins);
  };

  const loadInstalledPlugins = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('user_plugins')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading plugins:', error);
      return;
    }

    const installed = new Map<string, InstalledPlugin>();
    data?.forEach(plugin => {
      installed.set(plugin.plugin_id, {
        pluginId: plugin.plugin_id,
        enabled: plugin.is_enabled,
        installedAt: plugin.installed_at
      });
    });

    setInstalledPlugins(installed);
  };

  const handleInstall = async (plugin: Plugin) => {
    if (!plugin.isFree && !hasPremium) {
      window.open('https://queryflux.lemonsqueezy.com/checkout', '_blank');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please log in to install plugins');
      return;
    }

    const { error } = await supabase
      .from('user_plugins')
      .insert({
        user_id: user.id,
        plugin_id: plugin.id,
        plugin_name: plugin.name,
        is_enabled: true,
        configuration: {},
        installed_at: new Date().toISOString(),
        last_used_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error installing plugin:', error);
      alert('Failed to install plugin');
      return;
    }

    await loadInstalledPlugins();
    alert(`${plugin.name} installed successfully!`);
  };

  const handleUninstall = async (pluginId: string) => {
    if (!confirm('Are you sure you want to uninstall this plugin?')) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_plugins')
      .delete()
      .eq('user_id', user.id)
      .eq('plugin_id', pluginId);

    if (error) {
      console.error('Error uninstalling plugin:', error);
      alert('Failed to uninstall plugin');
      return;
    }

    await loadInstalledPlugins();
    alert('Plugin uninstalled successfully!');
  };

  const handleToggle = async (pluginId: string) => {
    const plugin = installedPlugins.get(pluginId);
    if (!plugin) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('user_plugins')
      .update({ is_enabled: !plugin.enabled })
      .eq('user_id', user.id)
      .eq('plugin_id', pluginId);

    if (error) {
      console.error('Error toggling plugin:', error);
      return;
    }

    await loadInstalledPlugins();
  };

  const filteredPlugins = plugins.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || plugin.category === selectedCategory;
    const matchesFree = !showFreeOnly || plugin.isFree;

    return matchesSearch && matchesCategory && matchesFree;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-7xl h-[90vh] glass-card rounded-3xl shadow-2xl flex" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="w-64 border-r p-6 space-y-6 overflow-y-auto" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{ color: theme.colors.text }}>{t('plugins.categories')}</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10">
              <X className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                    isSelected ? 'glass-morphism' : 'hover:bg-white/5'
                  }`}
                  style={{
                    borderLeft: isSelected ? `3px solid ${cat.color}` : '3px solid transparent'
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color: isSelected ? cat.color : theme.colors.textSecondary }} />
                  <span className="text-sm font-medium" style={{ color: isSelected ? theme.colors.text : theme.colors.textSecondary }}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showFreeOnly}
                onChange={(e) => setShowFreeOnly(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span style={{ color: theme.colors.text }}>Free only</span>
            </label>
          </div>

          <div className="p-4 rounded-lg" style={{ backgroundColor: theme.colors.accent + '10' }}>
            <p className="text-xs font-semibold mb-2" style={{ color: theme.colors.accent }}>
              {hasPremium ? 'Premium Active' : 'Upgrade to Premium'}
            </p>
            <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
              {hasPremium ? 'Access to all premium plugins' : 'Unlock all premium plugins and features'}
            </p>
            {!hasPremium && (
              <button
                onClick={() => window.open('https://queryflux.lemonsqueezy.com/checkout', '_blank')}
                className="mt-2 w-full px-3 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
              >
                Upgrade Now
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          <div className="p-6 border-b" style={{ borderColor: theme.colors.border }}>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: theme.colors.textSecondary }} />
                <input
                  type="text"
                  placeholder="Search plugins..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg glass-card text-sm"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    borderColor: theme.colors.border
                  }}
                />
              </div>
              <div className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {filteredPlugins.length} plugins
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredPlugins.map((plugin) => {
                const Icon = plugin.icon;
                const installed = installedPlugins.get(plugin.id);
                const isInstalled = !!installed;

                return (
                  <div
                    key={plugin.id}
                    onClick={() => setSelectedPlugin(plugin)}
                    className="p-4 rounded-lg glass-card hover:shadow-lg transition-all cursor-pointer"
                    style={{ borderColor: theme.colors.border }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
                        <Icon className="w-5 h-5" style={{ color: theme.colors.accent }} />
                      </div>
                      {!plugin.isFree && <Crown className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                    </div>

                    <h3 className="font-semibold mb-1" style={{ color: theme.colors.text }}>
                      {plugin.name}
                    </h3>
                    <p className="text-xs mb-3 line-clamp-2" style={{ color: theme.colors.textSecondary }}>
                      {plugin.description}
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-current" style={{ color: '#f59e0b' }} />
                        <span className="text-xs font-semibold" style={{ color: theme.colors.text }}>
                          {plugin.rating}
                        </span>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          ({plugin.reviews})
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        • {plugin.installCount.toLocaleString()} installs
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {plugin.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{
                            backgroundColor: theme.colors.accent + '20',
                            color: theme.colors.accent
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {isInstalled ? (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle(plugin.id);
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{
                            backgroundColor: installed.enabled ? theme.colors.accent + '20' : theme.colors.background,
                            color: installed.enabled ? theme.colors.accent : theme.colors.textSecondary
                          }}
                        >
                          {installed.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUninstall(plugin.id);
                          }}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: theme.colors.background, color: theme.colors.textSecondary }}
                        >
                          {t('plugins.uninstall')}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstall(plugin);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                      >
                        <Download className="w-3 h-3" />
                        {t('plugins.install')} {!plugin.isFree && `($${plugin.price})`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {selectedPlugin && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}dd` }} onClick={() => setSelectedPlugin(null)}>
            <div
              className="relative w-full max-w-3xl max-h-[80vh] glass-card rounded-2xl shadow-2xl p-6 overflow-y-auto"
              style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedPlugin(null)}
                className="absolute top-4 right-4 p-2 rounded-full glass-morphism hover-3d"
              >
                <X className="w-4 h-4" style={{ color: theme.colors.textSecondary }} />
              </button>

              <div className="flex items-start gap-4 mb-6">
                {(() => {
                  const Icon = selectedPlugin.icon;
                  return (
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.colors.accent + '20' }}>
                      <Icon className="w-8 h-8" style={{ color: theme.colors.accent }} />
                    </div>
                  );
                })()}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                      {selectedPlugin.name}
                    </h2>
                    {!selectedPlugin.isFree && <Crown className="w-5 h-5" style={{ color: '#f59e0b' }} />}
                  </div>
                  <p className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                    by {selectedPlugin.author} • v{selectedPlugin.version}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-current" style={{ color: '#f59e0b' }} />
                      <span className="font-semibold" style={{ color: theme.colors.text }}>{selectedPlugin.rating}</span>
                      <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        ({selectedPlugin.reviews} reviews)
                      </span>
                    </div>
                    <span className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      {selectedPlugin.installCount.toLocaleString()} installs
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Description</h3>
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    {selectedPlugin.longDescription}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Key Features</h3>
                  <ul className="space-y-1">
                    {selectedPlugin.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                        <Check className="w-4 h-4" style={{ color: '#10b981' }} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Use Cases</h3>
                  <ul className="space-y-1">
                    {selectedPlugin.useCases.map((useCase, idx) => (
                      <li key={idx} className="text-sm" style={{ color: theme.colors.textSecondary }}>
                        • {useCase}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Requirements</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlugin.requirements.map((req, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg text-sm"
                        style={{ backgroundColor: theme.colors.background, color: theme.colors.textSecondary }}
                      >
                        {req}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: theme.colors.text }}>Compatibility</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPlugin.compatibility.map((comp, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 rounded-lg text-sm"
                        style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                      >
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t" style={{ borderColor: theme.colors.border }}>
                  {installedPlugins.has(selectedPlugin.id) ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggle(selectedPlugin.id)}
                        className="flex-1 px-4 py-3 rounded-lg font-semibold"
                        style={{
                          backgroundColor: installedPlugins.get(selectedPlugin.id)?.enabled ? theme.colors.accent : theme.colors.background,
                          color: installedPlugins.get(selectedPlugin.id)?.enabled ? 'white' : theme.colors.textSecondary
                        }}
                      >
                        {installedPlugins.get(selectedPlugin.id)?.enabled ? t('plugins.disable') : t('plugins.enable')}
                      </button>
                      <button
                        onClick={() => handleUninstall(selectedPlugin.id)}
                        className="px-4 py-3 rounded-lg font-semibold"
                        style={{ backgroundColor: theme.colors.background, color: theme.colors.textSecondary }}
                      >
                        {t('plugins.uninstall')}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleInstall(selectedPlugin)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})` }}
                    >
                      <Download className="w-5 h-5" />
                      {t('plugins.install')} {!selectedPlugin.isFree && `for $${selectedPlugin.price}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
