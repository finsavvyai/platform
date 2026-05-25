/**
 * FinSavvy AI UI Components
 * Revolutionary AI-powered FinTech UI component library
 */

// UI Components
export {
  Button,
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  GradientCard,
  StatsCard,
  SkeletonCard,
} from './components/ui/Card';

export type {
  ButtonProps,
  CardProps,
  CardHeaderProps,
  CardTitleProps,
  CardDescriptionProps,
  CardContentProps,
  CardFooterProps,
} from './components/ui/Card';

// Chart Components
export { default as FinancialChart } from './components/charts/FinancialChart';
export { default as AnalyticsChart } from './components/charts/AnalyticsChart';
export { default as Dashboard } from './components/charts/Dashboard';

export type {
  ChartDataPoint,
  FinancialChartProps,
  AIInsight as FinancialAIInsight,
  ChartTooltipProps,
} from './components/charts/FinancialChart';

export type {
  AnalyticsDataPoint,
  AnalyticsSeries,
  AnalyticsChartProps,
  AIInsight as AnalyticsAIInsight,
  Annotation,
} from './components/charts/AnalyticsChart';

export type {
  DashboardMetric,
  DashboardSection,
  DashboardProps,
  AIInsight as DashboardAIInsight,
} from './components/charts/Dashboard';

// Hooks
export {
  useAuth,
  usePermissions,
  useOrganization,
  useSession,
  AuthProvider,
} from './hooks/useAuth';

export {
  useAIQuery,
  useAIMutation,
  useRealtimeAIQuery,
  useAIValidation,
} from './hooks/useAIQuery';

export type {
  AuthContextType,
  AuthProviderProps,
  QueryOptions,
  QueryState,
  AIInsights as QueryAIInsights,
  MutationOptions,
  MutationState,
} from './hooks/useAuth';

export type {
  QueryOptions as AIQueryOptions,
  QueryState as AIQueryState,
  AIInsights as AIQueryInsights,
  MutationOptions as AIMutationOptions,
  MutationState as AIMutationState,
} from './hooks/useAIQuery';

// Utilities
export {
  cn,
  formatCurrency,
  formatDate,
  formatRelativeTime,
  formatFileSize,
  formatPercentage,
  generateId,
  debounce,
  throttle,
  deepClone,
  isEmpty,
  capitalize,
  truncate,
  getInitials,
  isValidEmail,
  isValidPhone,
  stringToColor,
  copyToClipboard,
  getScrollPosition,
  scrollToElement,
  isInViewport,
  getBreakpoint,
  isMobile,
  isTablet,
  isDesktop,
} from './lib/utils';

// Chart Utilities
export {
  CHART_COLORS,
  TIME_RANGES,
  aggregateDataByTimeRange,
  transformToChartData,
  transformToAnalyticsSeries,
  calculateStatistics,
  detectOutliers,
  calculateTrend,
  calculateCorrelation,
  simpleLinearRegression,
  generateForecast,
  validateChartData,
  validateAnalyticsData,
  formatChartLabel,
  getChartColor,
  generateGradient,
  getResponsiveDimensions,
  getBreakpointConfig,
  getChartAnimation,
} from './lib/chart-utils';

export type {
  ChartColorPalette,
  TimeRangeConfig,
  ResponsiveDimensions,
  BreakpointConfig,
  AnimationConfig,
} from './lib/chart-utils';

// Styles (for consumers who want to import CSS)
import './styles/globals.css';

// Version
export const VERSION = '1.0.0';