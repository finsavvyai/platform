import { useState, useEffect, useCallback } from 'react';
import { Plus, Microscope, Target, Calendar, FileText, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../components/atoms';
import { useProject } from '../contexts/ProjectContext';
import { EmptyState } from '../components/EmptyState';
import NewExplorationModal, { type ExplorationData } from '../components/modals/NewExplorationModal';
import { api } from '../lib/api';

const fallbackExplorations: ExplorationData[] = [
  {
    id: 'EXP-001',
    name: 'Checkout Reliability Sweep',
    milestone: 'Release Candidate',
    startTime: '2026-03-01',
    mission: 'Validate payment edge cases and retry behaviour across checkout flows.',
    status: 'Active',
  },
  {
    id: 'EXP-002',
    name: 'SSO Boundary Review',
    milestone: 'Enterprise Access',
    startTime: '2026-02-25',
    mission: 'Probe federation, session expiry, and fallback login behaviour.',
    status: 'Completed',
  },
];

const Explorations = () => {
  const { currentProject } = useProject();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [explorations, setExplorations] = useState<ExplorationData[]>([]);

  // Fetch explorations from API
  const fetchExplorations = useCallback(async () => {
    try {
      const response = await api.getExplorations();
      if (response.success && response.data) {
        setExplorations(response.data);
      }
    } catch (error) {
      console.warn('Explorations API unavailable, using fallback sessions', error);
      setExplorations(fallbackExplorations);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExplorations();
  }, [fetchExplorations]);

  const handleNewExploration = async (exploration: ExplorationData) => {
    try {
      const response = await api.createExploration({
        name: exploration.name,
        milestone: exploration.milestone,
        mission: exploration.mission,
        startTime: exploration.startTime
      });
      if (response.success && response.data) {
        setExplorations(prev => [response.data, ...prev]);
      }
    } catch (error) {
      console.warn('Exploration create API unavailable, keeping local session only', error);
      // Still add locally as fallback
      setExplorations(prev => [exploration, ...prev]);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-gray-400">Loading explorations...</p>
        </div>
      </div>
    );
  }

  if (currentProject?.id === '1') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Microscope}
          title="No Explorations Yet"
          description="Start exploratory testing sessions to discover edge cases and improve test coverage."
          actionLabel="Start Exploration"
          onAction={() => setShowModal(true)}
        />
        <NewExplorationModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleNewExploration}
        />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="py-6">
      <motion.div
        className="max-w-7xl mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Explorations</h1>
            <p className="text-text-muted">Exploratory testing sessions and findings.</p>
          </div>
          <Button
            variant="neon"
            glow
            leftIcon={<Plus size={16} />}
            onClick={() => setShowModal(true)}
          >
            New Exploration
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {explorations.map((exploration) => (
            <motion.div
              key={exploration.id}
              variants={itemVariants}
              className="group bg-bg-secondary/50 backdrop-blur-md rounded-xl border border-border p-6 hover:border-primary/50 transition-all duration-300 relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">{exploration.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${exploration.status === 'Active'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                  }`}>
                  {exploration.status}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Target size={14} className="text-primary" />
                  <span>{exploration.milestone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar size={14} className="text-primary" />
                  <span>{exploration.startTime}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-gray-400 mt-4 pt-4 border-t border-white/5">
                  <FileText size={14} className="text-primary mt-0.5" />
                  <span className="line-clamp-2">{exploration.mission}</span>
                </div>
              </div>

              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>
          ))}

          <motion.button
            variants={itemVariants}
            onClick={() => setShowModal(true)}
            className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-white/10 text-gray-500 hover:border-primary/50 hover:text-primary hover:bg-white/5 transition-all duration-300 min-h-[200px]"
          >
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Plus size={24} />
            </div>
            <span className="font-medium">Create New Session</span>
          </motion.button>
        </div>
      </motion.div>

      <NewExplorationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleNewExploration}
      />
    </div>
  );
};

export default Explorations;
