import { useState, useEffect } from 'react';
import { Search, Filter, Plus, MoreHorizontal, ExternalLink, Link as LinkIcon, Download, ChevronRight, X, FileText, Sparkles, Loader2 } from 'lucide-react';
import NewTestCaseModal from '../components/modals/NewTestCaseModal';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms';
import { Modal } from '../components/ui/Modal';
import { TableActionMenu } from '../components/ui/TableActionMenu';
import { DataTable } from '../components/molecules/DataTable/DataTable';
import { cn } from '../lib/utils';
import { useProject } from '../contexts/ProjectContext';
import { EmptyState } from '../components/EmptyState';
import { AITestGenerator } from '../components/ai';
import { api } from '../lib/api';

interface TestCase {
  id: string;
  displayId?: string | null;
  title: string;
  status: string;
  priority: string;
  type: string;
  jiraIssue?: string;
  description?: string;
  acceptanceCriteria?: string[];
  [key: string]: unknown;
}

interface ApiTestCase {
  id: string;
  displayId?: string | null;
  display_id?: string | null;
  name?: string;
  title?: string;
  status?: string;
  priority?: string;
  type?: string;
  jiraIssue?: string | null;
  description?: string;
  expectedResults?: string[];
  testData?: {
    status?: string;
    priority?: string;
    jiraIssue?: string | null;
  };
}

const fallbackTestCases: TestCase[] = [
  {
    id: 'TC-101',
    title: 'Verify checkout keeps cart state after refresh',
    status: 'Active',
    priority: 'High',
    type: 'Functional',
    jiraIssue: 'QA-101',
    description: 'Ensure the cart contents persist during checkout refreshes.',
    acceptanceCriteria: ['Cart line items remain visible after reload', 'Totals stay consistent'],
  },
  {
    id: 'TC-102',
    title: 'Verify password reset email flow',
    status: 'Active',
    priority: 'Medium',
    type: 'Functional',
    description: 'Ensure reset emails are issued and the flow completes successfully.',
    acceptanceCriteria: ['Reset email is sent', 'User can update password from the email link'],
  },
];

const TestCases = () => {
  useProject(); // ensure project context is available
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [showNewCaseModal, setShowNewCaseModal] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [jiraIssueKey, setJiraIssueKey] = useState('');
  const [importingCase, setImportingCase] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Menu State
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch test cases from real API
  useEffect(() => {
    const fetchTestCases = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.getTestCases() as { success?: boolean; data?: ApiTestCase[] };
        if (response?.success && response.data) {
          // Transform API response to match component format
          const cases = response.data.map((tc) => ({
            id: tc.id,
            displayId: tc.displayId ?? tc.display_id ?? null,
            title: tc.name ?? tc.title ?? `Test Case ${tc.id}`,
            status: (tc.status ?? tc.testData?.status) || 'Active',
            priority: (tc.priority ?? tc.testData?.priority) || 'Medium',
            type: tc.type || 'Functional',
            jiraIssue: tc.jiraIssue ?? tc.testData?.jiraIssue ?? undefined,
            description: tc.description ?? undefined,
            acceptanceCriteria: tc.expectedResults || []
          }));
          setTestCases(cases);
        }
      } catch (err) {
        console.warn('Test cases API unavailable, using fallback cases', err);
        setTestCases(fallbackTestCases);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    fetchTestCases();
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div
        className="min-h-screen p-8 flex items-center justify-center transition-colors duration-300"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--brand-primary)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Loading test cases...</p>
        </div>
      </div>
    );
  }

  // Show empty state when no test cases exist
  if (testCases.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="No Test Cases Yet"
          description="Create your first test case or import from Jira to get started with test management."
          actionLabel="Create Test Case"
          onAction={() => setShowNewCaseModal(true)}
        />
        <NewTestCaseModal
          isOpen={showNewCaseModal}
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </div>
    );
  }

  const handleMenuClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuPosition({
      top: rect.bottom + 5,
      left: rect.left - 120 // Shift left to align with button roughly
    });
    setActiveMenuId(activeMenuId === id ? null : id);
  };

  const handleEdit = (id: string) => {
    console.log('Edit', id);
    // TODO: Implement edit logic
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this test case?')) {
      try {
        await api.deleteTestCase(id);
        setTestCases(testCases.filter(tc => tc.id !== id));
      } catch (err) {
        console.error('Failed to delete test case:', err);
        alert('Failed to delete test case');
      }
    }
  };

  const handleImportFromJira = (testCase: TestCase) => {
    setImportingCase(testCase.id);
    setJiraIssueKey('');
    setShowJiraModal(true);
  };

  const performJiraImport = async () => {
    if (!importingCase || !jiraIssueKey) return;

    try {
      // Call real Jira API
      const jiraData = await api.getJiraIssue(jiraIssueKey) as Record<string, any>;

      // Update test case with Jira data
      await api.updateTestCase(importingCase, {
        jiraIssue: jiraIssueKey,
        description: jiraData.description || `Imported from ${jiraIssueKey}`
      });

      setTestCases(testCases.map(tc =>
        tc.id === importingCase
          ? {
            ...tc,
            jiraIssue: jiraIssueKey,
            description: jiraData.description || tc.description
          }
          : tc
      ));
    } catch (err) {
      console.error('Failed to import from Jira:', err);
      // Fallback: just link the issue without importing data
      setTestCases(testCases.map(tc =>
        tc.id === importingCase
          ? { ...tc, jiraIssue: jiraIssueKey }
          : tc
      ));
    }

    setShowJiraModal(false);
    setImportingCase(null);
    setJiraIssueKey('');
  };

  /* eslint-disable @typescript-eslint/no-explicit-any */
  function handleCreateSuccess(newCase: any) {
    // Add new case from API response to local state
    setTestCases([
      {
        id: newCase.id,
        displayId: newCase.displayId ?? newCase.display_id ?? null,
        title: newCase.title || newCase.name,
        status: newCase.status || newCase.testData?.status || 'Active',
        priority: newCase.priority || newCase.testData?.priority || 'Medium',
        type: newCase.type || 'Functional',
        jiraIssue: newCase.jiraIssue || newCase.testData?.jiraIssue,
        description: newCase.description
      },
      ...testCases
    ]);
    setShowNewCaseModal(false);
  }

  return (
    <div
      className="min-h-screen p-8 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          {error && (
            <div className="absolute top-0 left-0 w-full bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 text-sm text-center">
              {error}
            </div>
          )}
          <div className="relative w-full sm:w-80">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search test cases (ID, TC-NNNN, or title)..."
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all backdrop-blur-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button variant="glass" size="sm" leftIcon={<Filter size={16} />}>
              Filter
            </Button>
            <Button
              variant="glass"
              size="sm"
              leftIcon={<Sparkles size={16} />}
              onClick={() => setShowAIGenerator(true)}
              className="border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/10"
            >
              Generate with AI
            </Button>
            <Button
              variant="neon"
              glow
              size="sm"
              leftIcon={<Plus size={16} />}
              onClick={() => setShowNewCaseModal(true)}
            >
              New Test Case
            </Button>
          </div>
        </div>

        <div className="bg-black/20 backdrop-blur-md rounded-xl border border-white/10 overflow-x-auto">
          <DataTable
            data={testCases.filter((tc) => {
              const q = searchTerm.trim().toLowerCase();
              if (!q) return true;
              const hay = [
                tc.id,
                tc.displayId ?? '',
                tc.title,
                tc.status,
                tc.priority,
                tc.type,
                tc.jiraIssue ?? '',
              ].join(' ').toLowerCase();
              return hay.includes(q);
            })}
            columns={[
              {
                key: 'id',
                header: 'ID',
                // Show the human-readable display_id; keep the raw UUID
                // accessible via the title attribute for copy-to-clipboard
                // and support workflows.
                render: (tc) => (
                  <span
                    className="text-sm text-text-secondary font-mono"
                    title={typeof tc.id === 'string' ? tc.id : undefined}
                  >
                    {(tc.displayId as string | null | undefined) ?? (tc.id as string)}
                  </span>
                )
              },
              {
                key: 'title',
                header: 'Title',
                render: (tc) => <span className="text-sm font-medium text-text-primary">{tc.title}</span>
              },
              {
                key: 'jiraIssue',
                header: 'Jira',
                render: (tc) => tc.jiraIssue ? (
                  <a
                    href={`https://jira.company.com/browse/${tc.jiraIssue}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-blue-500 text-sm font-medium hover:underline hover:text-blue-400"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {tc.jiraIssue}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <button
                    className="inline-flex items-center gap-1.5 text-text-secondary text-sm hover:text-blue-500 transition-colors px-2 py-1 rounded hover:bg-white/5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImportFromJira(tc);
                    }}
                  >
                    <LinkIcon size={14} />
                    Link
                  </button>
                )
              },
              {
                key: 'status',
                header: 'Status',
                render: (tc) => (
                  <Badge
                    variant={tc.status === 'Active' ? 'success' : 'secondary'}
                    size="sm"
                  >
                    {tc.status}
                  </Badge>
                )
              },
              {
                key: 'priority',
                header: 'Priority',
                render: (tc) => (
                  <div className="flex items-center gap-1.5">
                    <span className={cn(
                      "w-2 h-2 rounded-full",
                      (tc.priority === 'High' || tc.priority === 'Critical') ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                        tc.priority === 'Medium' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                          'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                    )} />
                    <span className="text-sm text-text-primary">{tc.priority}</span>
                  </div>
                )
              },
              {
                key: 'type',
                header: 'Type',
                render: (tc) => <span className="text-sm text-text-secondary">{tc.type}</span>
              },
              {
                key: 'actions',
                header: '',
                render: (tc) => (
                  <button
                    className={cn(
                      "text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-white/10 transition-colors",
                      activeMenuId === tc.id ? 'bg-white/10 text-text-primary' : ''
                    )}
                    onClick={(e) => handleMenuClick(e, tc.id)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                )
              }
            ]}
            onRowClick={(tc) => setSelectedCase(tc as TestCase)}
            className="border-none bg-transparent"
          />
        </div>

        {/* Jira Import Modal */}
        <Modal
          isOpen={showJiraModal}
          onClose={() => setShowJiraModal(false)}
          title="Import from Jira"
          size="md"
        >
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-text-primary">Jira Issue Key</label>
              <input
                type="text"
                className="w-full px-4 py-2.5 border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
                placeholder="e.g., PROJ-123"
                value={jiraIssueKey}
                onChange={(e) => setJiraIssueKey(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-text-secondary">
                Enter the Jira issue key to import description and acceptance criteria
              </p>
            </div>

            <div
              className="p-4 rounded-lg space-y-2 border border-border"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <div className="flex items-center gap-2 text-blue-500 mb-2">
                <Download size={16} />
                <span className="text-sm font-semibold">This will import:</span>
              </div>
              <ul className="ml-6 space-y-1 list-disc text-sm text-text-secondary">
                <li>Issue description</li>
                <li>Acceptance criteria</li>
                <li>Link to Jira issue</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="ghost" onClick={() => setShowJiraModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={performJiraImport}
                disabled={!jiraIssueKey.trim()}
              >
                Import
              </Button>
            </div>
          </div>
        </Modal>

        {/* Test Case Detail Panel */}
        {selectedCase && (
          <div
            className="fixed right-0 top-0 w-[500px] max-w-[90vw] h-screen border-l border-border z-50 flex flex-col shadow-2xl animate-slideIn"
            style={{ backgroundColor: 'var(--bg-tertiary)' }}
          >
            <div
              className="flex justify-between items-center p-6 border-b border-border"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <h2 className="text-lg font-semibold text-text-primary pr-4">{selectedCase.title}</h2>
              <button
                className="text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-white/5 transition"
                onClick={() => setSelectedCase(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-[70px]">ID:</span>
                  <span
                    className="text-sm font-medium text-text-primary px-2 py-0.5 rounded font-mono"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >{selectedCase.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-[70px]">Status:</span>
                  <Badge
                    variant={selectedCase.status === 'Active' ? 'success' : 'secondary'}
                    size="sm"
                  >
                    {selectedCase.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-text-secondary w-[70px]">Priority:</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${selectedCase.priority === 'High' || selectedCase.priority === 'Critical' ? 'bg-red-500' :
                      selectedCase.priority === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
                      }`} />
                    <span className="text-sm font-medium text-text-primary">{selectedCase.priority}</span>
                  </div>
                </div>
                {selectedCase.jiraIssue && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-text-secondary w-[70px]">Jira:</span>
                    <a
                      href={`https://jira.company.com/browse/${selectedCase.jiraIssue}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-500 text-sm font-medium hover:underline"
                    >
                      {selectedCase.jiraIssue}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                )}
              </div>

              {selectedCase.description && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Description</h3>
                  <p
                    className="text-sm text-text-secondary leading-relaxed p-4 rounded-lg border border-border"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    {selectedCase.description}
                  </p>
                </div>
              )}

              {selectedCase.acceptanceCriteria && selectedCase.acceptanceCriteria.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Acceptance Criteria</h3>
                  <ul className="space-y-3">
                    {selectedCase.acceptanceCriteria.map((criterion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-text-secondary">
                        <ChevronRight size={16} className="text-blue-500 shrink-0 mt-0.5" />
                        <span>{criterion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!selectedCase.jiraIssue && (
                <div className="pt-4 border-t border-border">
                  <Button
                    variant="primary"
                    onClick={() => handleImportFromJira(selectedCase)}
                    className="w-full"
                  >
                    <LinkIcon size={16} style={{ marginRight: '0.5rem' }} />
                    Link to Jira Issue
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* New Test Case Modal */}
        <NewTestCaseModal
          isOpen={showNewCaseModal}
          onClose={() => setShowNewCaseModal(false)}
          onSuccess={handleCreateSuccess}
        />

        {/* Action Menu */}
        <TableActionMenu
          isOpen={!!activeMenuId}
          onClose={() => setActiveMenuId(null)}
          position={menuPosition}
          onEdit={() => activeMenuId && handleEdit(activeMenuId)}
          onDelete={() => activeMenuId && handleDelete(activeMenuId)}
        />

        {/* AI Test Generator Modal */}
        <AITestGenerator
          isOpen={showAIGenerator}
          onClose={() => setShowAIGenerator(false)}
          onTestGenerated={(result) => {
            // Add the generated test to the list
            const newCase: TestCase = {
              id: `TC-${testCases.length + 1}`,
              title: `AI Generated: ${result.testCode.split("'")[1] || 'New Test'}`,
              status: 'Draft',
              priority: 'Medium',
              type: 'AI',
              description: `Generated with ${Math.round(result.confidence * 100)}% confidence`,
            };
            setTestCases([newCase, ...testCases]);
            setShowAIGenerator(false);
          }}
        />
      </div>
    </div>
  );
};

export default TestCases;
