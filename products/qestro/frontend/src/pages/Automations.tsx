import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Settings, ExternalLink, BookOpen, Video, Code } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { EmptyState } from '../components/EmptyState';

const Automations = () => {
  const { currentProject } = useProject();
  const navigate = useNavigate();

  if (currentProject?.id === '1') {
    return (
      <div className="p-6">
        <EmptyState
          icon={Settings}
          title="No Automations Configured"
          description="Connect your test automation frameworks to start tracking automated test runs."
        />
      </div>
    );
  }
  const frameworks = [
    { name: 'Cucumber', icon: '🥒', color: '#23D96C' },
    { name: 'Cypress', icon: 'cy', color: '#17202C' },
    { name: 'Jest', icon: '🃏', color: '#C21325' },
    { name: 'JUnit', icon: '5', color: '#DC524A' },
    { name: 'Mocha', icon: '☕', color: '#8D6848' },
    { name: 'NUnit', icon: 'n', color: '#5FA04E' },
    { name: 'PHPUnit', icon: '🐘', color: '#777BB3' },
    { name: 'Playwright', icon: '🎭', color: '#2EAD33' },
    { name: 'Pytest', icon: '📊', color: '#0A9EDC' },
    { name: 'Selenium', icon: '📗', color: '#43B02A' },
    { name: 'xUnit.net', icon: '🔧', color: '#512BD4' },
    { name: 'Watir', icon: '💧', color: '#00A3E0' },
    { name: 'TestComplete', icon: '💎', color: '#0085CA' },
    { name: 'Webdriver', icon: '🤖', color: '#EF4041' },
    { name: 'PyUnit', icon: '🐍', color: '#3776AB' },
    { name: 'Jasmine', icon: '🌸', color: '#8A4182' },
    { name: 'Ranorex', icon: '❌', color: '#E2001A' },
    { name: 'Other', icon: '⚙️', color: '#6B7280' },
  ];

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
    <div className="min-h-screen bg-bg-primary p-8">
      <motion.div
        className="max-w-7xl mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Test Automation Integrations</h1>
            <p className="text-text-muted">Connect your favorite testing frameworks to Qestro for seamless reporting.</p>
          </div>
          <button
            onClick={() => navigate('/settings?tab=integrations')}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 transition-colors"
          >
            <Settings size={18} />
            <span>Configure API</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {frameworks.map((framework) => (
            <motion.button
              key={framework.name}
              variants={itemVariants}
              className="group relative flex flex-col items-center gap-4 p-6 bg-glass backdrop-blur-md rounded-xl border border-border hover:border-primary/50 hover:bg-bg-secondary transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-lg transition-transform group-hover:scale-110 duration-300"
                style={{ backgroundColor: `${framework.color}20`, boxShadow: `0 0 20px ${framework.color}15` }}
              >
                <span className="drop-shadow-md">{framework.icon}</span>
              </div>
              <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                {framework.name}
              </span>
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink size={14} className="text-gray-400" />
              </div>
            </motion.button>
          ))}
        </div>

        <motion.div
          variants={itemVariants}
          className="bg-gradient-to-br from-blue-900/10 to-purple-900/10 backdrop-blur-md rounded-xl border border-white/10 p-8 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
            <Code size={200} />
          </div>

          <h3 className="text-xl font-bold text-white mb-4">Getting Started</h3>
          <p className="text-gray-400 mb-8 max-w-2xl">
            Select a framework above to view specific integration instructions, installation guides, and configuration examples for your project.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a href="https://docs.qestro.io/automations" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-black/20 hover:bg-primary/20 border border-white/10 hover:border-primary/30 rounded-lg transition-all group">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 group-hover:text-blue-300">
                <BookOpen size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Documentation</div>
                <div className="text-xs text-gray-400">View integration guides</div>
              </div>
            </a>

            <a href="https://github.com/qestro/examples" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-black/20 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-lg transition-all group">
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400 group-hover:text-purple-300">
                <Code size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Example Projects</div>
                <div className="text-xs text-gray-400">Browse GitHub repos</div>
              </div>
            </a>

            <a href="https://youtube.com/@qestro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-black/20 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all group">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400 group-hover:text-emerald-300">
                <Video size={20} />
              </div>
              <div>
                <div className="font-semibold text-white">Video Tutorials</div>
                <div className="text-xs text-gray-400">Watch setup guides</div>
              </div>
            </a>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Automations;
