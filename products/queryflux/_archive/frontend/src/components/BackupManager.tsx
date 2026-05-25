import React, { useState } from 'react';
import { Database, Download, Upload, Clock, CheckCircle, XCircle, AlertTriangle, Trash2, Play, Calendar } from 'lucide-react';

interface Backup {
  id: string;
  name: string;
  database: string;
  size: string;
  createdAt: Date;
  type: 'full' | 'incremental' | 'differential';
  status: 'completed' | 'failed' | 'in_progress';
  duration?: number;
  tables?: string[];
}

interface BackupManagerProps {
  backups: Backup[];
  databases: string[];
  onCreateBackup?: (config: BackupConfig) => Promise<void>;
  onRestoreBackup?: (backupId: string, options: RestoreOptions) => Promise<void>;
  onDeleteBackup?: (backupId: string) => Promise<void>;
  onScheduleBackup?: (schedule: BackupSchedule) => Promise<void>;
}

interface BackupConfig {
  database: string;
  name: string;
  type: 'full' | 'incremental' | 'differential';
  tables?: string[];
  compress?: boolean;
  includeData?: boolean;
  includeSchema?: boolean;
}

interface RestoreOptions {
  overwrite?: boolean;
  targetDatabase?: string;
  tables?: string[];
}

interface BackupSchedule {
  name: string;
  database: string;
  type: 'full' | 'incremental';
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time: string;
  retention: number;
}

export function BackupManager({
  backups,
  databases,
  onCreateBackup,
  onRestoreBackup,
  onDeleteBackup,
  onScheduleBackup,
}: BackupManagerProps) {
  const [activeTab, setActiveTab] = useState<'backups' | 'create' | 'schedule'>('backups');
  const [backupConfig, setBackupConfig] = useState<BackupConfig>({
    database: '',
    name: '',
    type: 'full',
    compress: true,
    includeData: true,
    includeSchema: true,
  });
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    overwrite: false,
  });
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<BackupSchedule>({
    name: '',
    database: '',
    type: 'full',
    frequency: 'daily',
    time: '00:00',
    retention: 7,
  });

  const handleCreateBackup = async () => {
    if (!onCreateBackup || !backupConfig.database) return;

    try {
      await onCreateBackup(backupConfig);
      setBackupConfig({
        database: '',
        name: '',
        type: 'full',
        compress: true,
        includeData: true,
        includeSchema: true,
      });
      setActiveTab('backups');
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!onRestoreBackup) return;

    const confirmed = window.confirm(
      'Are you sure you want to restore this backup? This may overwrite existing data.'
    );

    if (confirmed) {
      try {
        await onRestoreBackup(backupId, restoreOptions);
      } catch (error) {
        console.error('Failed to restore backup:', error);
      }
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!onDeleteBackup) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this backup? This action cannot be undone.'
    );

    if (confirmed) {
      try {
        await onDeleteBackup(backupId);
      } catch (error) {
        console.error('Failed to delete backup:', error);
      }
    }
  };

  const handleScheduleBackup = async () => {
    if (!onScheduleBackup || !schedule.database) return;

    try {
      await onScheduleBackup(schedule);
      setSchedule({
        name: '',
        database: '',
        type: 'full',
        frequency: 'daily',
        time: '00:00',
        retention: 7,
      });
      setActiveTab('backups');
    } catch (error) {
      console.error('Failed to schedule backup:', error);
    }
  };

  const getStatusIcon = (status: Backup['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  const getTypeColor = (type: Backup['type']) => {
    switch (type) {
      case 'full':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'incremental':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      case 'differential':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Backup Manager</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create, schedule, and restore database backups
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'backups'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Backups ({backups.length})
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Create Backup
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'schedule'
              ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
          }`}
        >
          Schedule
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'backups' && (
          <div className="space-y-4">
            {backups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <Database className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No backups found</p>
                <p className="text-sm mt-1">Create your first backup to get started</p>
              </div>
            ) : (
              backups.map((backup) => (
                <div
                  key={backup.id}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(backup.status)}
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {backup.name}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getTypeColor(backup.type)}`}>
                          {backup.type.toUpperCase()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div>
                          <strong>Database:</strong> {backup.database}
                        </div>
                        <div>
                          <strong>Size:</strong> {backup.size}
                        </div>
                        <div>
                          <strong>Created:</strong> {backup.createdAt.toLocaleString()}
                        </div>
                        {backup.duration && (
                          <div>
                            <strong>Duration:</strong> {backup.duration}s
                          </div>
                        )}
                        {backup.tables && (
                          <div className="col-span-2">
                            <strong>Tables:</strong> {backup.tables.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {backup.status === 'completed' && onRestoreBackup && (
                        <button
                          onClick={() => handleRestoreBackup(backup.id)}
                          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                          title="Restore backup"
                        >
                          <Upload className="w-4 h-4" />
                          Restore
                        </button>
                      )}
                      {onDeleteBackup && (
                        <button
                          onClick={() => handleDeleteBackup(backup.id)}
                          className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete backup"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Backup
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Database *
                </label>
                <select
                  value={backupConfig.database}
                  onChange={(e) => setBackupConfig({ ...backupConfig, database: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select database</option>
                  {databases.map((db) => (
                    <option key={db} value={db}>
                      {db}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backup Name
                </label>
                <input
                  type="text"
                  value={backupConfig.name}
                  onChange={(e) => setBackupConfig({ ...backupConfig, name: e.target.value })}
                  placeholder="backup_2024_01_15"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Backup Type
                </label>
                <select
                  value={backupConfig.type}
                  onChange={(e) =>
                    setBackupConfig({ ...backupConfig, type: e.target.value as BackupConfig['type'] })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="full">Full Backup (Complete database)</option>
                  <option value="incremental">Incremental (Changes since last backup)</option>
                  <option value="differential">Differential (Changes since last full backup)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={backupConfig.includeSchema}
                    onChange={(e) =>
                      setBackupConfig({ ...backupConfig, includeSchema: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Include Schema
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={backupConfig.includeData}
                    onChange={(e) =>
                      setBackupConfig({ ...backupConfig, includeData: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Include Data
                </label>

                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={backupConfig.compress}
                    onChange={(e) => setBackupConfig({ ...backupConfig, compress: e.target.checked })}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  Compress Backup
                </label>
              </div>

              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-semibold mb-1">Backup Best Practices:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Full backups are recommended weekly</li>
                      <li>Incremental backups can be done daily for faster backups</li>
                      <li>Always test restore procedures regularly</li>
                      <li>Store backups in multiple locations</li>
                    </ul>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateBackup}
                disabled={!backupConfig.database}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="w-4 h-4" />
                Create Backup Now
              </button>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="max-w-2xl">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Schedule Automated Backups
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Schedule Name *
                </label>
                <input
                  type="text"
                  value={schedule.name}
                  onChange={(e) => setSchedule({ ...schedule, name: e.target.value })}
                  placeholder="Daily production backup"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Database *
                </label>
                <select
                  value={schedule.database}
                  onChange={(e) => setSchedule({ ...schedule, database: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select database</option>
                  {databases.map((db) => (
                    <option key={db} value={db}>
                      {db}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Backup Type
                  </label>
                  <select
                    value={schedule.type}
                    onChange={(e) =>
                      setSchedule({ ...schedule, type: e.target.value as BackupSchedule['type'] })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="full">Full Backup</option>
                    <option value="incremental">Incremental</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Frequency
                  </label>
                  <select
                    value={schedule.frequency}
                    onChange={(e) =>
                      setSchedule({ ...schedule, frequency: e.target.value as BackupSchedule['frequency'] })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time
                  </label>
                  <input
                    type="time"
                    value={schedule.time}
                    onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Retention (days)
                  </label>
                  <input
                    type="number"
                    value={schedule.retention}
                    onChange={(e) => setSchedule({ ...schedule, retention: parseInt(e.target.value) })}
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                onClick={handleScheduleBackup}
                disabled={!schedule.database || !schedule.name}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Create Schedule
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
