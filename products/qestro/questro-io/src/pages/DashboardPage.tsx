import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Smartphone,
  Globe,
  Zap,
  Database,
  BarChart3,
  Users,
  Calendar,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
  Clock,
  Rocket,
  Target,
  Activity,
  Brain,
  Shield,
  Gauge
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';

interface DashboardStats {
  totalTests: number;
  successfulTests: number;
  failedTests: number;
  testCoverage: number;
  activeDevices: number;
  aiGeneratedTests: number;
  scheduledTests: number;
  performanceScore: number;
}

interface RecentActivity {
  id: string;
  type: 'test_run' | 'recording' | 'ai_generation' | 'scheduled_test';
  title: string;
  status: 'success' | 'failed' | 'running' | 'scheduled';
  timestamp: Date;
  platform?: 'web' | 'mobile' | 'api';
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalTests: 0,
    successfulTests: 0,
    failedTests: 0,
    testCoverage: 0,
    activeDevices: 0,
    aiGeneratedTests: 0,
    scheduledTests: 0,
    performanceScore: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setTimeout(() => {
        setStats({
          totalTests: 1247,
          successfulTests: 1089,
          failedTests: 158,
          testCoverage: 87,
          activeDevices: 12,
          aiGeneratedTests: 342,
          scheduledTests: 45,
          performanceScore: 94,
        });
        
        setRecentActivity([
          {
            id: '1',
            type: 'test_run',
            title: 'E2E Payment Flow Test Suite',
            status: 'success',
            timestamp: new Date(Date.now() - 5 * 60 * 1000),
            platform: 'web',
          },
          {
            id: '2',
            type: 'recording',
            title: 'iOS Login Recording Session',
            status: 'running',
            timestamp: new Date(Date.now() - 12 * 60 * 1000),
            platform: 'mobile',
          },
          {
            id: '3',
            type: 'ai_generation',
            title: 'Generated 15 API Test Cases',
            status: 'success',
            timestamp: new Date(Date.now() - 25 * 60 * 1000),
            platform: 'api',
          },
          {
            id: '4',
            type: 'scheduled_test',
            title: 'Nightly Regression Suite',
            status: 'scheduled',
            timestamp: new Date(Date.now() - 45 * 60 * 1000),
            platform: 'web',
          },
        ]);
        
        setIsLoading(false);
      }, 1000);
    };

    fetchDashboardData();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <Activity className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'scheduled':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'web':
        return <Globe className="h-4 w-4 text-indigo-500" />;
      case 'mobile':
        return <Smartphone className="h-4 w-4 text-green-500" />;
      case 'api':
        return <Database className="h-4 w-4 text-purple-500" />;
      default:
        return <Target className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const successRate = stats.totalTests > 0 ? Math.round((stats.successfulTests / stats.totalTests) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here's what's happening with your test automation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Tests</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.totalTests.toLocaleString()}</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-green-600">+12%</span>
                <span className="text-gray-500"> from last week</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
                    <dd className="text-lg font-medium text-gray-900">{successRate}%</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-green-600">+2.1%</span>
                <span className="text-gray-500"> from last week</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Test Coverage</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.testCoverage}%</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-green-600">+5.4%</span>
                <span className="text-gray-500"> from last week</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Brain className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">AI Tests Generated</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats.aiGeneratedTests}</dd>
                  </dl>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
              <div className="text-sm">
                <span className="font-medium text-green-600">+28%</span>
                <span className="text-gray-500"> from last week</span>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Start testing with Questro's comprehensive automation platform
                </p>
              </div>
              <div className="px-6 py-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Link
                    to="/recording-studio"
                    className="group relative bg-gradient-to-r from-indigo-500 to-blue-600 p-6 rounded-xl text-white hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Play className="h-8 w-8" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-semibold">Record Tests</h4>
                        <p className="text-sm text-indigo-100">Web & Mobile Recording</p>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/ai-test-generation"
                    className="group relative bg-gradient-to-r from-purple-500 to-pink-600 p-6 rounded-xl text-white hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Brain className="h-8 w-8" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-semibold">AI Generation</h4>
                        <p className="text-sm text-purple-100">Smart Test Creation</p>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/api-management"
                    className="group relative bg-gradient-to-r from-green-500 to-teal-600 p-6 rounded-xl text-white hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Database className="h-8 w-8" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-semibold">API Testing</h4>
                        <p className="text-sm text-green-100">REST & GraphQL</p>
                      </div>
                    </div>
                  </Link>

                  <Link
                    to="/performance-testing"
                    className="group relative bg-gradient-to-r from-orange-500 to-red-600 p-6 rounded-xl text-white hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                  >
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <Gauge className="h-8 w-8" />
                      </div>
                      <div className="ml-4">
                        <h4 className="text-lg font-semibold">Performance</h4>
                        <p className="text-sm text-orange-100">Load & Stress Testing</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Usage This Month</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                {user?.subscription && (
                  <>
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">AI Test Generation</span>
                        <span className="font-medium">
                          {user.subscription.aiCallsRemaining} remaining
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-purple-600 h-2 rounded-full"
                          style={{
                            width: `${Math.max(0, (user.subscription.aiCallsRemaining / 100) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Web Recordings</span>
                        <span className="font-medium">
                          {user.subscription.webRecordingsRemaining} remaining
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{
                            width: `${Math.max(0, (user.subscription.webRecordingsRemaining / 10) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Mobile Recordings</span>
                        <span className="font-medium">
                          {user.subscription.mobileRecordingsRemaining} remaining
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${Math.max(0, (user.subscription.mobileRecordingsRemaining / 5) * 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </>
                )}
                
                <div className="pt-4 border-t">
                  <Link
                    to="/pricing"
                    className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Upgrade Plan
                  </Link>
                </div>
              </div>
            </div>

            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Stats</h3>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Devices</span>
                  <span className="text-sm font-medium text-gray-900">{stats.activeDevices}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Scheduled Tests</span>
                  <span className="text-sm font-medium text-gray-900">{stats.scheduledTests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Performance Score</span>
                  <span className="text-sm font-medium text-green-600">{stats.performanceScore}/100</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="flow-root">
            <ul role="list" className="-my-5 divide-y divide-gray-200">
              {recentActivity.map((activity) => (
                <li key={activity.id} className="py-4 px-6">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      {getPlatformIcon(activity.platform)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusIcon(activity.status)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-gray-50 px-6 py-3">
            <Link
              to="/activity"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              View all activity
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}