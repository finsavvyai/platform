
import React from 'react';
import { User, Shield, Zap, Brain, Target, Activity } from 'lucide-react';

const agents = [
    {
        id: 'architect',
        name: 'The Architect',
        role: 'QA Lead & Planner',
        icon: <Brain className="w-8 h-8 text-purple-400" />,
        description: 'Analyzes tickets, plans test strategies, and manages the test suite.',
        status: 'thinking',
        color: 'bg-purple-500/10 border-purple-500/20',
        stats: { plans: 142, optimization: '98%' }
    },
    {
        id: 'novice',
        name: 'The Novice',
        role: 'Usability Tester',
        icon: <User className="w-8 h-8 text-blue-400" />,
        description: 'Slow interaction, high confusion threshold. Finds UX bottlenecks.',
        status: 'idle',
        color: 'bg-blue-500/10 border-blue-500/20',
        stats: { confusion: 'High', speed: 'Slow' }
    },
    {
        id: 'power_user',
        name: 'The Power User',
        role: 'Performance Tester',
        icon: <Zap className="w-8 h-8 text-yellow-400" />,
        description: 'Blazing fast actions. Ignores warnings. Stresses the system.',
        status: 'testing',
        color: 'bg-yellow-500/10 border-yellow-500/20',
        stats: { apm: 300, tolerance: 'High' }
    },
    {
        id: 'hacker',
        name: 'The Hacker',
        role: 'Security Researcher',
        icon: <Shield className="w-8 h-8 text-red-400" />,
        description: 'Probes for SQLi, XSS, and auth bypasses. Untrusted inputs.',
        status: 'idle',
        color: 'bg-red-500/10 border-red-500/20',
        stats: { vulnerabilities: 12, risk: 'Critical' }
    },
    {
        id: 'scout',
        name: 'The Scout',
        role: 'Test Harvester',
        icon: <Target className="w-8 h-8 text-green-400" />,
        description: 'Crawls URLs to reverse-engineer user flows and generate tests.',
        status: 'idle',
        color: 'bg-green-500/10 border-green-500/20',
        stats: { pages: 1540, paths: 320 }
    }
];

const AgentDepartmentHub: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Agent Department</h1>
                <p className="text-gray-400">Manage your autonomous AI workforce. Assign agents to missions or review their performance.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        className={`relative p-6 rounded-xl border ${agent.color} hover:bg-opacity-20 transition-all cursor-pointer group`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-lg bg-gray-900/50">
                                {agent.icon}
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize flex items-center gap-1.5
                ${agent.status === 'testing' ? 'bg-green-500/20 text-green-400' :
                                    agent.status === 'thinking' ? 'bg-purple-500/20 text-purple-400 animate-pulse' :
                                        'bg-gray-700/50 text-gray-400'}`}>
                                <Activity className="w-3 h-3" />
                                {agent.status}
                            </div>
                        </div>

                        <h3 className="text-xl font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                            {agent.name}
                        </h3>
                        <p className="text-sm text-blue-300 mb-3">{agent.role}</p>
                        <p className="text-sm text-gray-400 mb-6">{agent.description}</p>

                        <div className="border-t border-gray-700/50 pt-4 mt-auto">
                            <div className="flex justify-between items-center text-xs text-gray-500">
                                {Object.entries(agent.stats).map(([key, value]) => (
                                    <div key={key} className="flex flex-col">
                                        <span className="uppercase tracking-wider opacity-60 mb-0.5">{key}</span>
                                        <span className="text-gray-300 font-medium">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AgentDepartmentHub;
