import React, { useState } from "react";
import { X } from "lucide-react";
import { DatabaseType, DATABASE_CONFIGS } from "../../types/database";
import { DatabaseTypeSelector } from "../../components/DatabaseTypeSelector";
import { ElectronConnectionForm } from "./ElectronConnectionForm";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useElectronDatabase, DatabaseConfig } from "../hooks";
import "./ElectronConnectionDialog.css";

interface ElectronConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (connection: any) => void;
  editConnection?: DatabaseConfig | null;
}

export const ElectronConnectionDialog: React.FC<
  ElectronConnectionDialogProps
> = ({ isOpen, onClose, onConnect, editConnection }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const { isElectron } = useElectronDatabase();

  const [selectedDatabase, setSelectedDatabase] = useState<DatabaseType | null>(
    null,
  );

  // Initialize with edit connection type if provided
  React.useEffect(() => {
    if (editConnection && editConnection.type) {
      setSelectedDatabase(editConnection.type as DatabaseType);
    } else if (isOpen && !selectedDatabase) {
      setSelectedDatabase("postgresql"); // Default selection
    }
  }, [editConnection, isOpen]);

  if (!isOpen) return null;

  const handleBack = () => {
    setSelectedDatabase(null);
  };

  const handleConnect = (connection: any) => {
    onConnect(connection);
    setSelectedDatabase(null); // Reset for next time
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl"
      style={{ backgroundColor: `${theme.colors.background}cc` }}
    >
      <div
        className="relative w-full max-w-4xl glass-card rounded-3xl shadow-2xl overflow-hidden perspective-card hover-3d"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.foreground,
        }}
      >
        <div className="relative">
          <div
            className="flex items-center justify-between px-8 py-6 border-b shimmer"
            style={{ borderColor: theme.colors.border }}
          >
            <div>
              <h2
                className="text-2xl font-bold"
                style={{ color: theme.colors.text }}
              >
                {selectedDatabase
                  ? `${t("database.connectTo")} ${DATABASE_CONFIGS[selectedDatabase].name}`
                  : editConnection
                    ? "Edit Database Connection"
                    : t("database.newDatabaseConnection")}
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: theme.colors.textSecondary }}
              >
                {selectedDatabase
                  ? "Configure your database connection"
                  : "Choose your database type to get started"}
              </p>
              {!isElectron && (
                <div className="mt-2 p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                  <p className="text-xs text-yellow-300">
                    Database connections are only available in the Electron
                    desktop app
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full glass-morphism hover-3d transition-all"
            >
              <X
                className="w-5 h-5"
                style={{ color: theme.colors.textSecondary }}
              />
            </button>
          </div>

          <div className="p-8">
            {!selectedDatabase ? (
              <DatabaseTypeSelector
                onSelect={setSelectedDatabase}
                selectedType={editConnection?.type as DatabaseType}
              />
            ) : (
              <ElectronConnectionForm
                databaseType={selectedDatabase}
                onBack={handleBack}
                onConnect={handleConnect}
                onCancel={onClose}
                editConnection={editConnection}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
