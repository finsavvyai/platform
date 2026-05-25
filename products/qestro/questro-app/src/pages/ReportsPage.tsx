import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Download,
  Mail,
  MessageSquare,
  Share2,
  Filter,
  Calendar,
  BarChart3,
  Shield,
  Zap,
  Brain,
  ChevronDown,
  Eye,
  Send,
  Settings,
  Loader2,
  CheckCircle,
  AlertTriangle,
  FileDown,
  Globe,
  Lock,
  Copy,
  ExternalLink
} from 'lucide-react';

interface Report {
  id: string;
  testId: string;
  type: 'security' | 'performance' | 'testing' | 'penetration';
  title: string;
  createdAt: string;
  status: 'generating' | 'ready' | 'shared' | 'expired';
  format: 'pdf' | 'html' | 'markdown';
  size?: string;
  downloadUrl?: string;
  shareUrl?: string;
  testSummary: {
    totalIssues?: number;
    criticalIssues?: number;
    score?: number;
    duration?: number;
    success?: boolean;
  };
}

interface EmailTemplate {
  id: string;
  name: string;
  type: 'executive' | 'technical' | 'summary';
  description: string;
  audience: string;
}

interface SlackChannel {
  id: string;
  name: string;
  private: boolean;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [slackChannels, setSlackChannels] = useState<SlackChannel[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Email form state
  const [emailForm, setEmailForm] = useState({
    recipients: '',
    subject: '',
    message: '',
    template: 'technical',
    aiGenerated: true,
    attachPDF: true,
    includeExecutiveSummary: true
  });

  // Slack form state
  const [slackForm, setSlackForm] = useState({
    channel: '',
    message: '',
    aiGenerated: true,
    urgency: 'medium',
    includeDetails: true,
    mentionChannel: false
  });

  // Share form state
  const [shareForm, setShareForm] = useState({
    shareType: 'protected',
    expiresIn: 24,
    allowDownload: true,
    password: '',
    customMessage: ''
  });

  const [operationLoading, setOperationLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
    fetchEmailTemplates();
    fetchSlackChannels();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [reports, filterType, filterStatus, sortBy]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/reports', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmailTemplates = async () => {
    try {
      const response = await fetch('/api/reports/email-templates', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Failed to fetch email templates:', error);
    }
  };

  const fetchSlackChannels = async () => {
    try {
      const response = await fetch('/api/integrations/slack/channels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSlackChannels(data.channels || []);
      }
    } catch (error) {
      console.error('Failed to fetch Slack channels:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...reports];

    if (filterType !== 'all') {
      filtered = filtered.filter(report => report.type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(report => report.status === filterStatus);
    }

    // Sort reports
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'score':
          return (b.testSummary.score || 0) - (a.testSummary.score || 0);
        default:
          return 0;
      }
    });

    setFilteredReports(filtered);
  };

  const generateReport = async (testId: string, type: string, format: 'pdf' | 'html' | 'markdown' = 'pdf') => {
    try {
      setOperationLoading(`generate-${testId}`);
      
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          testId,
          reportType: type,
          format,
          includeCharts: true,
          includeRecommendations: true
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Refresh reports list
        await fetchReports();
        
        // Show success message
        alert(`${format.toUpperCase()} report generated successfully!`);
      } else {
        throw new Error('Failed to generate report');
      }
    } catch (error) {
      console.error('Report generation failed:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setOperationLoading(null);
    }
  };

  const downloadReport = async (report: Report) => {
    if (!report.downloadUrl) return;
    
    try {
      setOperationLoading(`download-${report.id}`);
      
      const response = await fetch(report.downloadUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.title}.${report.format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download report. Please try again.');
    } finally {
      setOperationLoading(null);
    }
  };

  const openEmailModal = (report: Report) => {
    setSelectedReport(report);
    setEmailForm(prev => ({
      ...prev,
      subject: `${report.type.charAt(0).toUpperCase() + report.type.slice(1)} Test Report - ${report.title}`
    }));
    setShowEmailModal(true);
  };

  const openSlackModal = (report: Report) => {
    setSelectedReport(report);
    setShowSlackModal(true);
  };

  const openShareModal = (report: Report) => {
    setSelectedReport(report);
    setShowShareModal(true);
  };

  const sendEmailReport = async () => {
    if (!selectedReport) return;
    
    try {
      setOperationLoading('email');
      
      const response = await fetch('/api/reports/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reportId: selectedReport.id,
          recipients: emailForm.recipients.split(',').map(email => email.trim()),
          subject: emailForm.subject,
          message: emailForm.message,
          template: emailForm.template,
          aiGenerated: emailForm.aiGenerated,
          attachments: emailForm.attachPDF ? [selectedReport.downloadUrl] : []
        })
      });

      if (response.ok) {
        alert('Email sent successfully!');
        setShowEmailModal(false);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setOperationLoading(null);
    }
  };

  const sendSlackNotification = async () => {
    if (!selectedReport) return;
    
    try {
      setOperationLoading('slack');
      
      const response = await fetch('/api/notifications/slack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          channel: slackForm.channel,
          message: slackForm.message,
          testId: selectedReport.testId,
          reportUrl: selectedReport.shareUrl,
          aiGenerated: slackForm.aiGenerated,
          urgency: slackForm.urgency,
          includeDetails: slackForm.includeDetails
        })
      });

      if (response.ok) {
        alert('Slack notification sent successfully!');
        setShowSlackModal(false);
      } else {
        throw new Error('Failed to send Slack notification');
      }
    } catch (error) {
      console.error('Slack notification failed:', error);
      alert('Failed to send Slack notification. Please try again.');
    } finally {
      setOperationLoading(null);
    }
  };

  const createShareLink = async () => {
    if (!selectedReport) return;
    
    try {
      setOperationLoading('share');
      
      const response = await fetch('/api/sharing/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          testId: selectedReport.testId,
          shareType: shareForm.shareType,
          expiresIn: shareForm.expiresIn,
          allowDownload: shareForm.allowDownload,
          password: shareForm.password,
          customMessage: shareForm.customMessage
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Update the report with share URL
        setReports(prev => prev.map(r => 
          r.id === selectedReport.id ? { ...r, shareUrl: data.shareUrl } : r
        ));
        alert('Share link created successfully!');
        setShowShareModal(false);
      } else {
        throw new Error('Failed to create share link');
      }
    } catch (error) {
      console.error('Share link creation failed:', error);
      alert('Failed to create share link. Please try again.');
    } finally {
      setOperationLoading(null);
    }
  };

  const generateAIEmail = async () => {
    if (!selectedReport) return;
    
    try {
      setOperationLoading('ai-email');
      
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reportType: selectedReport.type,
          testResults: selectedReport.testSummary,
          audience: emailForm.template,
          tone: 'formal',
          customMessage: emailForm.message
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEmailForm(prev => ({
          ...prev,
          subject: data.subject || prev.subject,
          message: data.body || prev.message
        }));
      }
    } catch (error) {
      console.error('AI email generation failed:', error);
    } finally {
      setOperationLoading(null);
    }
  };

  const generateAISlackMessage = async () => {
    if (!selectedReport) return;
    
    try {
      setOperationLoading('ai-slack');
      
      const response = await fetch('/api/ai/generate-slack-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          testType: selectedReport.type,
          testResults: selectedReport.testSummary,
          urgency: slackForm.urgency,
          includeDetails: slackForm.includeDetails
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSlackForm(prev => ({
          ...prev,
          message: data.message || prev.message
        }));
      }
    } catch (error) {
      console.error('AI Slack message generation failed:', error);
    } finally {
      setOperationLoading(null);
    }
  };

  const getReportIcon = (type: string) => {
    switch (type) {
      case 'security':
      case 'penetration':
        return Shield;
      case 'performance':
        return Zap;
      case 'testing':
        return Brain;
      default:
        return FileText;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'generating':
        return Loader2;
      case 'ready':
        return CheckCircle;
      case 'shared':
        return Share2;
      case 'expired':
        return AlertTriangle;
      default:
        return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generating':
        return 'text-blue-600';
      case 'ready':
        return 'text-green-600';
      case 'shared':
        return 'text-purple-600';
      case 'expired':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading reports...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Reports</h1>
          <p className="text-gray-600">
            Generate, share, and manage comprehensive test reports with AI-powered insights
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              {/* Type Filter */}
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="security">Security</option>
                  <option value="penetration">Penetration</option>
                  <option value="performance">Performance</option>
                  <option value="testing">Testing</option>
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Status Filter */}
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="generating">Generating</option>
                  <option value="ready">Ready</option>
                  <option value="shared">Shared</option>
                  <option value="expired">Expired</option>
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Sort By */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="date">Sort by Date</option>
                  <option value="type">Sort by Type</option>
                  <option value="status">Sort by Status</option>
                  <option value="score">Sort by Score</option>
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => fetchReports()}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Reports Grid */}
        <div className="grid gap-6">
          {filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No reports found</h3>
              <p className="text-gray-600">
                Run some tests to generate reports, or adjust your filters.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => {
              const ReportIcon = getReportIcon(report.type);
              const StatusIcon = getStatusIcon(report.status);
              
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${
                        report.type === 'security' || report.type === 'penetration' ? 'from-red-500 to-orange-500' :
                        report.type === 'performance' ? 'from-green-500 to-emerald-500' :
                        'from-blue-500 to-cyan-500'
                      }`}>
                        <ReportIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {report.title}
                        </h3>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="capitalize">{report.type} Report</span>
                          <span>•</span>
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className={`inline-flex items-center ${getStatusColor(report.status)}`}>
                            <StatusIcon className={`w-4 h-4 mr-1 ${report.status === 'generating' ? 'animate-spin' : ''}`} />
                            {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Test Summary */}
                    {report.testSummary && (
                      <div className="text-right">
                        {report.testSummary.score !== undefined && (
                          <div className="text-2xl font-bold text-gray-900 mb-1">
                            {report.testSummary.score}/100
                          </div>
                        )}
                        {report.testSummary.criticalIssues !== undefined && (
                          <div className="text-sm text-red-600">
                            {report.testSummary.criticalIssues} critical issues
                          </div>
                        )}
                        {report.testSummary.totalIssues !== undefined && (
                          <div className="text-sm text-gray-600">
                            {report.testSummary.totalIssues} total issues
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <span className="capitalize">{report.format}</span>
                      {report.size && (
                        <>
                          <span>•</span>
                          <span>{report.size}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {/* View Report */}
                      {report.status === 'ready' && (
                        <button
                          onClick={() => window.open(`/reports/view/${report.id}`, '_blank')}
                          className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </button>
                      )}

                      {/* Download */}
                      {report.downloadUrl && (
                        <button
                          onClick={() => downloadReport(report)}
                          disabled={operationLoading === `download-${report.id}`}
                          className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
                        >
                          {operationLoading === `download-${report.id}` ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-1" />
                          )}
                          Download
                        </button>
                      )}

                      {/* Email */}
                      <button
                        onClick={() => openEmailModal(report)}
                        disabled={report.status !== 'ready'}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-green-600 hover:text-green-800 transition-colors disabled:opacity-50"
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Email
                      </button>

                      {/* Slack */}
                      <button
                        onClick={() => openSlackModal(report)}
                        disabled={report.status !== 'ready'}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50"
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        Slack
                      </button>

                      {/* Share */}
                      <button
                        onClick={() => openShareModal(report)}
                        disabled={report.status !== 'ready'}
                        className="inline-flex items-center px-3 py-1 text-sm font-medium text-orange-600 hover:text-orange-800 transition-colors disabled:opacity-50"
                      >
                        <Share2 className="w-4 h-4 mr-1" />
                        Share
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Email Report</h2>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recipients (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={emailForm.recipients}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, recipients: e.target.value }))}
                    placeholder="user@example.com, team@company.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template
                  </label>
                  <select
                    value={emailForm.template}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, template: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="executive">Executive Summary</option>
                    <option value="technical">Technical Details</option>
                    <option value="summary">Brief Summary</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Subject
                    </label>
                    <button
                      onClick={generateAIEmail}
                      disabled={operationLoading === 'ai-email'}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {operationLoading === 'ai-email' ? 'Generating...' : '✨ AI Generate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={emailForm.message}
                    onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                    rows={6}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional message to include in the email..."
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailForm.attachPDF}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, attachPDF: e.target.checked }))}
                      className="mr-2"
                    />
                    Attach PDF report
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={emailForm.aiGenerated}
                      onChange={(e) => setEmailForm(prev => ({ ...prev, aiGenerated: e.target.checked }))}
                      className="mr-2"
                    />
                    AI-generated content
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendEmailReport}
                  disabled={operationLoading === 'email' || !emailForm.recipients}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center"
                >
                  {operationLoading === 'email' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slack Modal */}
      {showSlackModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Send to Slack</h2>
                <button
                  onClick={() => setShowSlackModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Channel
                  </label>
                  <select
                    value={slackForm.channel}
                    onChange={(e) => setSlackForm(prev => ({ ...prev, channel: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a channel</option>
                    {slackChannels.map(channel => (
                      <option key={channel.id} value={channel.name}>
                        #{channel.name} {channel.private ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Urgency
                  </label>
                  <select
                    value={slackForm.urgency}
                    onChange={(e) => setSlackForm(prev => ({ ...prev, urgency: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">🟢 Low</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="high">🟠 High</option>
                    <option value="critical">🔴 Critical</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Message
                    </label>
                    <button
                      onClick={generateAISlackMessage}
                      disabled={operationLoading === 'ai-slack'}
                      className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                    >
                      {operationLoading === 'ai-slack' ? 'Generating...' : '✨ AI Generate'}
                    </button>
                  </div>
                  <textarea
                    value={slackForm.message}
                    onChange={(e) => setSlackForm(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Message to send to Slack..."
                  />
                </div>

                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={slackForm.includeDetails}
                      onChange={(e) => setSlackForm(prev => ({ ...prev, includeDetails: e.target.checked }))}
                      className="mr-2"
                    />
                    Include test details
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={slackForm.mentionChannel}
                      onChange={(e) => setSlackForm(prev => ({ ...prev, mentionChannel: e.target.checked }))}
                      className="mr-2"
                    />
                    Mention @channel
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowSlackModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={sendSlackNotification}
                  disabled={operationLoading === 'slack' || !slackForm.channel}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 inline-flex items-center"
                >
                  {operationLoading === 'slack' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Send to Slack
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Share Report</h2>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Share Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="public"
                        checked={shareForm.shareType === 'public'}
                        onChange={(e) => setShareForm(prev => ({ ...prev, shareType: e.target.value }))}
                        className="mr-2"
                      />
                      <Globe className="w-4 h-4 mr-1" />
                      Public - Anyone with the link can view
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="protected"
                        checked={shareForm.shareType === 'protected'}
                        onChange={(e) => setShareForm(prev => ({ ...prev, shareType: e.target.value }))}
                        className="mr-2"
                      />
                      <Lock className="w-4 h-4 mr-1" />
                      Protected - Requires password
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="shareType"
                        value="private"
                        checked={shareForm.shareType === 'private'}
                        onChange={(e) => setShareForm(prev => ({ ...prev, shareType: e.target.value }))}
                        className="mr-2"
                      />
                      <Lock className="w-4 h-4 mr-1" />
                      Private - Only authenticated users
                    </label>
                  </div>
                </div>

                {shareForm.shareType === 'protected' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={shareForm.password}
                      onChange={(e) => setShareForm(prev => ({ ...prev, password: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password for access"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expires In (hours)
                  </label>
                  <select
                    value={shareForm.expiresIn}
                    onChange={(e) => setShareForm(prev => ({ ...prev, expiresIn: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1 hour</option>
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>1 week</option>
                    <option value={720}>1 month</option>
                    <option value={0}>Never expires</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Message
                  </label>
                  <textarea
                    value={shareForm.customMessage}
                    onChange={(e) => setShareForm(prev => ({ ...prev, customMessage: e.target.value }))}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional message to display with the shared report..."
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={shareForm.allowDownload}
                      onChange={(e) => setShareForm(prev => ({ ...prev, allowDownload: e.target.checked }))}
                      className="mr-2"
                    />
                    Allow report download
                  </label>
                </div>

                {selectedReport.shareUrl && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Share URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={selectedReport.shareUrl}
                        readOnly
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 bg-white"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedReport.shareUrl!)}
                        className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => window.open(selectedReport.shareUrl, '_blank')}
                        className="px-3 py-2 text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createShareLink}
                  disabled={operationLoading === 'share' || (shareForm.shareType === 'protected' && !shareForm.password)}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 inline-flex items-center"
                >
                  {operationLoading === 'share' ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  Create Share Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}