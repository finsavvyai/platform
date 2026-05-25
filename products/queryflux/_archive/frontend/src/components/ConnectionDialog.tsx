import { useState } from 'react';
import { X } from 'lucide-react';
import { DatabaseType, DATABASE_CONFIGS } from '../types/database';
import { DatabaseTypeSelector } from './DatabaseTypeSelector';
import { ConnectionForm } from './ConnectionForm';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: any) => void;
}

export function ConnectionDialog({ isOpen, onClose, onConnect }: ConnectionDialogProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType | null>(null);

  if (!isOpen) return null;

  const handleBack = () => {
    setSelectedDatabase(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-4xl glass-card rounded-3xl shadow-2xl overflow-hidden perspective-card hover-3d" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground }}>
        <div className="relative">
          <div className="flex items-center justify-between px-8 py-6 border-b shimmer" style={{ borderColor: theme.colors.border }}>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
                {selectedDatabase ? `${t('database.connectTo')} ${DATABASE_CONFIGS[selectedDatabase].name}` : t('database.newDatabaseConnection')}
              </h2>
              <p className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                {selectedDatabase ? 'Enter your connection details' : 'Choose your database type to get started'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full glass-morphism hover-3d transition-all"
            >
              <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
            </button>
          </div>

          <div className="p-8">
            {!selectedDatabase ? (
              <DatabaseTypeSelector onSelect={setSelectedDatabase} />
            ) : (
              <ConnectionForm
                databaseType={selectedDatabase}
                onBack={handleBack}
                onConnect={onConnect}
                onCancel={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
