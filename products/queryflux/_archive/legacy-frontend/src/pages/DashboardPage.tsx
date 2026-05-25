import React from 'react';
import { BarChart3, Database, Activity, Users } from 'lucide-react';
// import { useConnections } from '../hooks/useConnections';
// import { useQueries } from '../hooks/useQueries';

export function DashboardPage() {
    // Mock data for initial stability test
    const connections = []; // useConnections().data
    const queries = []; // useQueries().data

    const stats = [
        {
            name: 'Total Connections',
            value: connections?.length || 0,
            icon: Database,
            color: 'text-blue-400',
            bgColor: 'bg-blue-400/10',
        },
        {
            name: 'Saved Queries',
            value: queries?.length || 0,
            icon: BarChart3,
            color: 'text-purple-400',
            bgColor: 'bg-purple-400/10',
        },
        {
            name: 'Active Sessions',
            value: 0,
            icon: Activity,
            color: 'text-green-400',
            bgColor: 'bg-green-400/10',
        },
        {
            name: 'Team Members',
            value: 1,
            icon: Users,
            color: 'text-pink-400',
            bgColor: 'bg-pink-400/10',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div>
                <h1 className="text-3xl font-bold mb-2">Welcome to QueryFlux</h1>
                <p className="text-gray-400">
                    Your enterprise-grade database management platform
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div
                            key={stat.name}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-gray-700 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                                    <Icon className={stat.color} size={24} />
                                </div>
                            </div>
                            <div className="text-3xl font-bold mb-1">{stat.value}</div>
                            <div className="text-sm text-gray-400">{stat.name}</div>
                        </div>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button className="p-4 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-left">
                        <div className="font-semibold mb-1">New Connection</div>
                        <div className="text-sm text-purple-200">Connect to a database</div>
                    </button>
                    <button className="p-4 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors text-left">
                        <div className="font-semibold mb-1">New Query</div>
                        <div className="text-sm text-blue-200">Write and execute SQL</div>
                    </button>
                    <button className="p-4 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-left">
                        <div className="font-semibold mb-1">View Schema</div>
                        <div className="text-sm text-green-200">Browse database structure</div>
                    </button>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                <div className="text-gray-400 text-center py-8">
                    No recent activity to display
                </div>
            </div>
        </div>
    );
}
