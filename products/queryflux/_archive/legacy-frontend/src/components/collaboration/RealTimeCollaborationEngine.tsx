import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Users, MessageSquare, Eye, Edit3, Clock, Share2, Lock, Unlock, Zap, Brain, Activity, GitBranch, Bell, Send, UserPlus, Settings, Wifi, WifiOff } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface RealTimeCollaborationEngineProps {
  workspaceId: string;
  currentUserId: string;
  visualization: any;
  onVisualizationUpdate: (viz: any) => void;
  enableRAG?: boolean;
  enableVoiceChat?: boolean;
  enableVersionControl?: boolean;
  enableLiveEditing?: boolean;
  enableTeamInsights?: boolean;
}

interface Collaborator {
  id: string;
  name: string;
  avatar?: string;
  cursor?: { x: number, y: number };
  selection?: any;
  status: 'active' | 'idle' | 'away';
  lastSeen: Date;
  permissions: 'view' | 'edit' | 'admin';
  color: string;
  isTyping?: boolean;
  currentThought?: string;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  position?: { x: number, y: number };
  context?: any;
  resolved: boolean;
  replies: Comment[];
  reactions: { userId: string, emoji: string }[];
}

interface Version {
  id: string;
  version: number;
  author: string;
  timestamp: Date;
  changes: any;
  description: string;
  tags: string[];
  collaborators: string[];
}

interface LiveEdit {
  id: string;
  userId: string;
  type: 'add' | 'modify' | 'delete' | 'move';
  target: string;
  data: any;
  timestamp: Date;
  applied: boolean;
}

interface TeamInsight {
  id: string;
  type: 'pattern' | 'anomaly' | 'collaboration' | 'efficiency';
  title: string;
  description: string;
  confidence: number;
  collaborators: string[];
  actionable: boolean;
  recommendations: string[];
}

export function RealTimeCollaborationEngine({
  workspaceId,
  currentUserId,
  visualization,
  onVisualizationUpdate,
  enableRAG = true,
  enableVoiceChat = true,
  enableVersionControl = true,
  enableLiveEditing = true,
  enableTeamInsights = true
}: RealTimeCollaborationEngineProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [liveEdits, setLiveEdits] = useState<LiveEdit[]>([]);
  const [teamInsights, setTeamInsights] = useState<TeamInsight[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [showCommentsPanel, setShowCommentsPanel] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTeamInsights, setShowTeamInsights] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [collaborationStats, setCollaborationStats] = useState<any>({});

  const websocketRef = useRef<any>(null);
  const collaborationCanvasRef = useRef<HTMLDivElement>(null);

  // Initialize WebSocket connection for real-time collaboration
  useEffect(() => {
    initializeCollaboration();
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [workspaceId]);

  // Simulate real-time collaboration events
  const initializeCollaboration = useCallback(() => {
    setIsConnected(true);

    // Simulate initial collaborators
    const mockCollaborators: Collaborator[] = [
      {
        id: 'user-1',
        name: 'Sarah Chen',
        avatar: '/avatars/sarah.jpg',
        status: 'active',
        lastSeen: new Date(),
        permissions: 'edit',
        color: '#3b82f6',
        cursor: { x: 250, y: 180 },
        currentThought: 'Analyzing the trend patterns'
      },
      {
        id: 'user-2',
        name: 'Marcus Johnson',
        avatar: '/avatars/marcus.jpg',
        status: 'active',
        lastSeen: new Date(),
        permissions: 'edit',
        color: '#10b981',
        cursor: { x: 450, y: 320 },
        isTyping: true
      },
      {
        id: 'user-3',
        name: 'Elena Rodriguez',
        avatar: '/avatars/elena.jpg',
        status: 'idle',
        lastSeen: new Date(Date.now() - 5 * 60 * 1000),
        permissions: 'view',
        color: '#f59e0b'
      }
    ];

    setCollaborators(mockCollaborators);
    setActiveUsers(mockCollaborators.filter(c => c.status === 'active').map(c => c.id));

    // Simulate comments
    const mockComments: Comment[] = [
      {
        id: 'comment-1',
        userId: 'user-1',
        userName: 'Sarah Chen',
        content: 'This pattern looks interesting! Have we considered seasonal adjustments?',
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
        position: { x: 300, y: 200 },
        resolved: false,
        replies: [
          {
            id: 'comment-1-reply-1',
            userId: 'user-2',
            userName: 'Marcus Johnson',
            content: 'Good point! I think the seasonal factor is already baked in, but we should double-check.',
            timestamp: new Date(Date.now() - 10 * 60 * 1000),
            resolved: false,
            replies: [],
            reactions: [{ userId: currentUserId, emoji: '👍' }]
          }
        ],
        reactions: [{ userId: 'user-3', emoji: '💡' }]
      }
    ];

    setComments(mockComments);

    // Simulate version history
    const mockVersions: Version[] = [
      {
        id: 'version-1',
        version: 1,
        author: 'Marcus Johnson',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        changes: { type: 'initial', description: 'Created initial visualization' },
        description: 'Initial dashboard setup with basic KPIs',
        tags: ['initial', 'setup'],
        collaborators: ['user-1', 'user-2']
      },
      {
        id: 'version-2',
        version: 2,
        author: 'Sarah Chen',
        timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
        changes: { type: 'add', element: 'trend-analysis' },
        description: 'Added trend analysis with predictive insights',
        tags: ['analysis', 'trends'],
        collaborators: ['user-1', 'user-2', 'user-3']
      },
      {
        id: 'version-3',
        version: 3,
        author: 'Elena Rodriguez',
        timestamp: new Date(Date.now() - 30 * 60 * 1000),
        changes: { type: 'modify', element: 'color-scheme' },
        description: 'Updated color scheme for better accessibility',
        tags: ['ui', 'accessibility'],
        collaborators: ['user-3']
      }
    ];

    setVersions(mockVersions);

    // Generate team insights
    if (enableTeamInsights) {
      generateTeamInsights();
    }

    // Start collaboration simulation
    startCollaborationSimulation();
  }, [workspaceId, enableTeamInsights]);

  // Simulate real-time collaboration events
  const startCollaborationSimulation = () => {
    // Simulate cursor movements
    const interval = setInterval(() => {
      setCollaborators(prev => prev.map(collab => {
        if (collab.status === 'active' && Math.random() > 0.7) {
          return {
            ...collab,
            cursor: {
              x: Math.random() * 600 + 100,
              y: Math.random() * 400 + 50
            }
          };
        }
        return collab;
      }));
    }, 2000);

    // Simulate typing indicators
    const typingInterval = setInterval(() => {
      setCollaborators(prev => prev.map(collab => {
        if (collab.id === 'user-2' && Math.random() > 0.8) {
          return {
            ...collab,
            isTyping: !collab.isTyping
          };
        }
        return collab;
      }));
    }, 5000);

    // Simulate live edits
    const editInterval = setInterval(() => {
      if (enableLiveEditing && Math.random() > 0.9) {
        const newEdit: LiveEdit = {
          id: `edit-${Date.now()}`,
          userId: ['user-1', 'user-2'][Math.floor(Math.random() * 2)],
          type: ['modify', 'add'][Math.floor(Math.random() * 2)] as 'modify' | 'add',
          target: 'chart-element',
          data: { value: Math.random() * 100 },
          timestamp: new Date(),
          applied: false
        };

        setLiveEdits(prev => [...prev.slice(-4), newEdit]);

        // Apply edit after a short delay
        setTimeout(() => {
          setLiveEdits(prev => prev.map(edit =>
            edit.id === newEdit.id ? { ...edit, applied: true } : edit
          ));
        }, 1000);
      }
    }, 8000);

    return () => {
      clearInterval(interval);
      clearInterval(typingInterval);
      clearInterval(editInterval);
    };
  };

  // Generate AI-powered team insights
  const generateTeamInsights = useCallback(async () => {
    const insights: TeamInsight[] = [
      {
        id: 'insight-1',
        type: 'collaboration',
        title: 'Peak Collaboration Time Detected',
        description: 'Team collaboration is 43% more effective between 2-4 PM. Consider scheduling important sessions during this window.',
        confidence: 0.89,
        collaborators: ['user-1', 'user-2', 'user-3'],
        actionable: true,
        recommendations: [
          'Schedule brainstorming sessions for 2-4 PM',
          'Avoid critical decisions during low-activity hours',
          'Create collaboration-friendly environment during peak hours'
        ]
      },
      {
        id: 'insight-2',
        type: 'pattern',
        title: 'Cross-Functional Analysis Patterns',
        description: 'Sarah and Marcus frequently analyze similar patterns. Consider creating shared templates for consistency.',
        confidence: 0.76,
        collaborators: ['user-1', 'user-2'],
        actionable: true,
        recommendations: [
          'Create shared analysis templates',
          'Establish consistent naming conventions',
          'Set up peer review system for analyses'
        ]
      },
      {
        id: 'insight-3',
        type: 'efficiency',
        title: 'Collaboration Efficiency Opportunity',
        description: 'Current workflow has 27% redundant steps. Streamlining could save 2.3 hours per week.',
        confidence: 0.82,
        collaborators: ['user-1', 'user-2', 'user-3'],
        actionable: true,
        recommendations: [
          'Eliminate redundant approval steps',
          'Automate repetitive analysis tasks',
          'Create standardized workflow templates'
        ]
      }
    ];

    setTeamInsights(insights);
    setCollaborationStats({
      totalEdits: 47,
      activeTime: '3h 24m',
      collaborationScore: 0.87,
      insightsGenerated: 12,
      decisionsMade: 8,
      timeSaved: '2.3 hours'
    });
  }, []);

  // Handle new comment submission
  const submitComment = useCallback(() => {
    if (!newComment.trim()) return;

    const comment: Comment = {
      id: `comment-${Date.now()}`,
      userId: currentUserId,
      userName: 'You',
      content: newComment,
      timestamp: new Date(),
      resolved: false,
      replies: [],
      reactions: []
    };

    setComments(prev => [...prev, comment]);
    setNewComment('');

    // Simulate collaboration notification
    if (enableTeamInsights) {
      const notification = `💬 New comment from you: "${newComment.substring(0, 50)}..."`;
      // In production, would send to team members
    }
  }, [newComment, currentUserId, enableTeamInsights]);

  // Handle comment reactions
  const addCommentReaction = useCallback((commentId: string, emoji: string) => {
    setComments(prev => prev.map(comment => {
      if (comment.id === commentId) {
        const existingReaction = comment.reactions.find(r => r.userId === currentUserId);
        if (existingReaction) {
          return {
            ...comment,
            reactions: comment.reactions.map(r =>
              r.userId === currentUserId ? { ...r, emoji } : r
            )
          };
        } else {
          return {
            ...comment,
            reactions: [...comment.reactions, { userId: currentUserId, emoji }]
          };
        }
      }
      return comment;
    }));
  }, [currentUserId]);

  // Handle version creation
  const createVersion = useCallback((description: string) => {
    const newVersion: Version = {
      id: `version-${Date.now()}`,
      version: versions.length + 1,
      author: 'You',
      timestamp: new Date(),
      changes: { type: 'manual', description },
      description,
      tags: ['user-created'],
      collaborators: [currentUserId, ...activeUsers]
    };

    setVersions(prev => [...prev, newVersion]);
    setShowVersionHistory(false);
  }, [versions.length, currentUserId, activeUsers]);

  return (
    <div className="w-full h-full flex flex-col glass-card rounded-2xl" style={{ backgroundColor: theme.colors.foreground }}>
      {/* Header with Collaboration Status */}
      <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <h2 className="font-semibold" style={{ color: theme.colors.text }}>
                {t('collaboration.title')}
              </h2>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="w-4 h-4" style={{ color: '#10b981' }} />
              ) : (
                <WifiOff className="w-4 h-4" style={{ color: '#ef4444' }} />
              )}
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                {isConnected ? 'Connected' : 'Offline'}
              </span>
              <span className="text-xs px-2 py-1 rounded-full" style={{
                backgroundColor: connectionQuality === 'excellent' ? '#10b98120' :
                                  connectionQuality === 'good' ? '#f59e0b20' : '#ef444420',
                color: connectionQuality === 'excellent' ? '#10b981' :
                       connectionQuality === 'good' ? '#f59e0b' : '#ef4444'
              }}>
                {connectionQuality}
              </span>
            </div>
          </div>

          {/* Active Collaborators */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {collaborators.filter(c => c.status === 'active').slice(0, 4).map(collab => (
                <div
                  key={collab.id}
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium text-white"
                  style={{
                    backgroundColor: collab.color,
                    borderColor: theme.colors.foreground
                  }}
                  title={collab.name}
                >
                  {collab.name.split(' ').map(n => n[0]).join('')}
                </div>
              ))}
            </div>
            {collaborators.filter(c => c.status === 'active').length > 4 && (
              <div className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-medium"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.foreground,
                  color: theme.colors.text
                }}
              >
                +{collaborators.filter(c => c.status === 'active').length - 4}
              </div>
            )}
          </div>
        </div>

        {/* Collaboration Actions */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowCommentsPanel(!showCommentsPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
              showCommentsPanel ? 'glass-morphism' : 'hover:bg-white/5'
            }`}
            style={{ color: showCommentsPanel ? theme.colors.accent : theme.colors.text }}
          >
            <MessageSquare className="w-3 h-3" />
            {t('collaboration.comments')}
            {comments.filter(c => !c.resolved).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs" style={{
                backgroundColor: `${theme.colors.accent}20`,
                color: theme.colors.accent
              }}>
                {comments.filter(c => !c.resolved).length}
              </span>
            )}
          </button>

          {enableVersionControl && (
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                showVersionHistory ? 'glass-morphism' : 'hover:bg-white/5'
              }`}
              style={{ color: showVersionHistory ? theme.colors.accent : theme.colors.text }}
            >
              <GitBranch className="w-3 h-3" />
              {t('collaboration.versions')}
              <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                v{versions.length}
              </span>
            </button>
          )}

          {enableTeamInsights && (
            <button
              onClick={() => setShowTeamInsights(!showTeamInsights)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all ${
                showTeamInsights ? 'glass-morphism' : 'hover:bg-white/5'
              }`}
              style={{ color: showTeamInsights ? theme.colors.accent : theme.colors.text }}
            >
              <Brain className="w-3 h-3" />
              {t('collaboration.insights')}
              {teamInsights.filter(i => i.actionable).length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-xs" style={{
                  backgroundColor: '#10b98120',
                  color: '#10b981'
                }}>
                  {teamInsights.filter(i => i.actionable).length}
                </span>
              )}
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <div className="text-xs" style={{ color: theme.colors.textSecondary }}>
              {t('collaboration.liveEdits')}: {liveEdits.filter(e => !e.applied).length}
            </div>
            {liveEdits.filter(e => !e.applied).length > 0 && (
              <div className="flex items-center gap-1">
                <div className="animate-pulse flex gap-1">
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: theme.colors.accent }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Collaboration Area */}
      <div className="flex-1 flex">
        {/* Collaboration Canvas */}
        <div className="flex-1 relative" ref={collaborationCanvasRef}>
          {/* Visualization would go here */}
          <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: theme.colors.background }}>
            <div className="text-center">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-50" style={{ color: theme.colors.textSecondary }} />
              <p className="text-lg font-semibold mb-2" style={{ color: theme.colors.text }}>
                {t('collaboration.collaborativeWorkspace')}
              </p>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {collaborators.filter(c => c.status === 'active').length} active collaborators
              </p>
            </div>
          </div>

          {/* Live Cursors */}
          {collaborators.filter(c => c.cursor && c.status === 'active').map(collab => (
            <div
              key={collab.id}
              className="absolute pointer-events-none"
              style={{
                left: collab.cursor?.x || 0,
                top: collab.cursor?.y || 0,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="relative">
                <div
                  className="w-4 h-4 rounded-full animate-pulse"
                  style={{ backgroundColor: collab.color }}
                />
                <div
                  className="absolute top-5 left-0 px-2 py-1 rounded text-xs whitespace-nowrap"
                  style={{
                    backgroundColor: collab.color,
                    color: '#fff'
                  }}
                >
                  {collab.name}
                </div>
                {collab.isTyping && (
                  <div className="absolute -top-6 left-0 text-xs px-2 py-1 rounded" style={{
                    backgroundColor: theme.colors.accent,
                    color: '#fff'
                  }}>
                    Typing...
                  </div>
                )}
                {collab.currentThought && (
                  <div className="absolute top-8 left-0 text-xs px-2 py-1 rounded max-w-xs" style={{
                    backgroundColor: theme.colors.foreground,
                    color: theme.colors.text
                  }}>
                    💭 {collab.currentThought}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Comment Markers */}
          {comments.filter(c => c.position && !c.resolved).map(comment => (
            <div
              key={comment.id}
              className="absolute w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
              style={{
                left: comment.position?.x || 0,
                top: comment.position?.y || 0,
                backgroundColor: theme.colors.accent
              }}
              onClick={() => setShowCommentsPanel(true)}
              title={`${comment.userName}: ${comment.content.substring(0, 50)}...`}
            >
              <MessageSquare className="w-3 h-3 text-white" />
            </div>
          ))}

          {/* Live Edit Indicators */}
          {liveEdits.filter(edit => !edit.applied).map(edit => {
            const collaborator = collaborators.find(c => c.id === edit.userId);
            return (
              <div
                key={edit.id}
                className="absolute top-4 right-4 px-3 py-2 rounded-lg flex items-center gap-2 animate-pulse"
                style={{
                  backgroundColor: collaborator?.color + '20',
                  border: `1px solid ${collaborator?.color}`
                }}
              >
                <Edit3 className="w-3 h-3" style={{ color: collaborator?.color }} />
                <span className="text-xs" style={{ color: theme.colors.text }}>
                  {collaborator?.name} is editing...
                </span>
              </div>
            );
          })}
        </div>

        {/* Side Panels */}
        <div className="w-80 border-l" style={{ borderColor: theme.colors.border }}>
          {/* Comments Panel */}
          {showCommentsPanel && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
                <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                  {t('collaboration.discussion')}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {comments.map(comment => (
                  <div key={comment.id} className="space-y-2">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                            style={{ backgroundColor: collaborators.find(c => c.id === comment.userId)?.color || theme.colors.accent }}
                          >
                            {comment.userName[0]}
                          </div>
                          <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                            {comment.userName}
                          </span>
                        </div>
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {formatTimestamp(comment.timestamp)}
                        </span>
                      </div>

                      <p className="text-sm mb-2" style={{ color: theme.colors.text }}>
                        {comment.content}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {comment.reactions.map((reaction, index) => (
                            <button
                              key={index}
                              onClick={() => addCommentReaction(comment.id, reaction.emoji)}
                              className="text-xs px-2 py-1 rounded"
                              style={{
                                backgroundColor: reaction.userId === currentUserId ? `${theme.colors.accent}20` : 'transparent',
                                color: theme.colors.text
                              }}
                            >
                              {reaction.emoji}
                            </button>
                          ))}
                          <button
                            onClick={() => addCommentReaction(comment.id, '👍')}
                            className="text-xs"
                            style={{ color: theme.colors.textSecondary }}
                          >
                            +1
                          </button>
                        </div>

                        {!comment.resolved && (
                          <button className="text-xs" style={{ color: theme.colors.accent }}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {comment.replies.map(reply => (
                      <div key={reply.id} className="ml-4 p-2 rounded" style={{ backgroundColor: theme.colors.background }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: theme.colors.text }}>
                            {reply.userName}
                          </span>
                          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                            {formatTimestamp(reply.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: theme.colors.text }}>
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Comment Input */}
              <div className="p-4 border-t" style={{ borderColor: theme.colors.border }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && submitComment()}
                    placeholder={t('collaboration.addComment')}
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: theme.colors.background,
                      color: theme.colors.text
                    }}
                  />
                  <button
                    onClick={submitComment}
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: theme.colors.accent, color: '#fff' }}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Version History Panel */}
          {showVersionHistory && enableVersionControl && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
                <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                  {t('collaboration.versionHistory')}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {versions.map(version => (
                  <div key={version.id} className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: theme.colors.text }}>
                          Version {version.version}
                        </span>
                        <span className="text-xs px-2 py-1 rounded" style={{
                          backgroundColor: `${theme.colors.accent}20`,
                          color: theme.colors.accent
                        }}>
                          {version.author}
                        </span>
                      </div>
                      <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                        {formatTimestamp(version.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs mb-2" style={{ color: theme.colors.text }}>
                      {version.description}
                    </p>

                    <div className="flex items-center gap-2">
                      {version.tags.map((tag, index) => (
                        <span key={index} className="text-xs px-2 py-1 rounded" style={{
                          backgroundColor: `${theme.colors.border}20`,
                          color: theme.colors.textSecondary
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 border-t" style={{ borderColor: theme.colors.border }}>
                <button
                  onClick={() => {
                    const description = prompt('Version description:');
                    if (description) createVersion(description);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm font-medium"
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: '#fff'
                  }}
                >
                  {t('collaboration.createVersion')}
                </button>
              </div>
            </div>
          )}

          {/* Team Insights Panel */}
          {showTeamInsights && enableTeamInsights && (
            <div className="h-full flex flex-col">
              <div className="p-4 border-b" style={{ borderColor: theme.colors.border }}>
                <h3 className="font-semibold" style={{ color: theme.colors.text }}>
                  {t('collaboration.teamInsights')}
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {teamInsights.map(insight => (
                  <div key={insight.id} className="p-3 rounded-lg" style={{ backgroundColor: theme.colors.background }}>
                    <div className="flex items-center gap-2 mb-2">
                      {getInsightIcon(insight.type)}
                      <h4 className="text-sm font-medium" style={{ color: theme.colors.text }}>
                        {insight.title}
                      </h4>
                      {insight.actionable && (
                        <span className="text-xs px-2 py-1 rounded-full" style={{
                          backgroundColor: '#10b98120',
                          color: '#10b981'
                        }}>
                          Actionable
                        </span>
                      )}
                    </div>

                    <p className="text-xs mb-2" style={{ color: theme.colors.textSecondary }}>
                      {insight.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getInsightTypeColor(insight.type) }} />
                        <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                          {Math.round(insight.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="flex -space-x-1">
                        {insight.collaborators.slice(0, 3).map(collabId => {
                          const collab = collaborators.find(c => c.id === collabId);
                          return collab ? (
                            <div
                              key={collabId}
                              className="w-4 h-4 rounded-full border border-white text-xs font-medium text-white flex items-center justify-center"
                              style={{ backgroundColor: collab.color }}
                              title={collab.name}
                            >
                              {collab.name[0]}
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Collaboration Stats */}
              <div className="p-4 border-t" style={{ borderColor: theme.colors.border }}>
                <h4 className="text-sm font-medium mb-3" style={{ color: theme.colors.text }}>
                  {t('collaboration.stats')}
                </h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span style={{ color: theme.colors.textSecondary }}>Total Edits</span>
                    <span style={{ color: theme.colors.text }}>{collaborationStats.totalEdits}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: theme.colors.textSecondary }}>Active Time</span>
                    <span style={{ color: theme.colors.text }}>{collaborationStats.activeTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: theme.colors.textSecondary }}>Collaboration Score</span>
                    <span style={{ color: theme.colors.text }}>{Math.round(collaborationStats.collaborationScore * 100)}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span style={{ color: theme.colors.textSecondary }}>Time Saved</span>
                    <span style={{ color: theme.colors.text }}>{collaborationStats.timeSaved}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Functions
function formatTimestamp(timestamp: Date): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function getInsightIcon(type: string) {
  const icons = {
    pattern: <Activity className="w-4 h-4" style={{ color: '#3b82f6' }} />,
    anomaly: <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />,
    collaboration: <Users className="w-4 h-4" style={{ color: '#10b981' }} />,
    efficiency: <Brain className="w-4 h-4" style={{ color: '#8b5cf6' }} />
  };

  return icons[type as keyof typeof icons] || <Brain className="w-4 h-4" style={{ color: '#6b7280' }} />;
}

function getInsightTypeColor(type: string): string {
  const colors = {
    pattern: '#3b82f6',
    anomaly: '#f59e0b',
    collaboration: '#10b981',
    efficiency: '#8b5cf6'
  };

  return colors[type as keyof typeof colors] || '#6b7280';
}
