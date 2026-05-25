import {
  Database,
  Server,
  Leaf,
  Box,
  HardDrive,
  Layers,
  Activity,
  Clock,
  Bug,
  Zap,
  Cloud,
  Network,
} from "lucide-react";
import {
  DatabaseType,
  DATABASE_CONFIGS,
  DATABASE_CATEGORIES,
  DatabaseCategory,
} from "../types/database";
import { useTheme } from "../renderer/contexts/ThemeContext";

interface DatabaseTypeSelectorProps {
  onSelect: (type: DatabaseType) => void;
}

const ICON_MAP: Record<string, any> = {
  database: Database,
  server: Server,
  leaf: Leaf,
  box: Box,
  "hard-drive": HardDrive,
  layers: Layers,
  activity: Activity,
  clock: Clock,
  bug: Bug,
  zap: Zap,
  cloud: Cloud,
  network: Network,
};

export function DatabaseTypeSelector({ onSelect }: DatabaseTypeSelectorProps) {
  const { theme } = useTheme();
  const databaseTypes = Object.values(DATABASE_CONFIGS);

  const groupedByCategory: Record<DatabaseCategory, typeof databaseTypes> = {
    rdbms: [],
    nosql: [],
    cloud: [],
    aws: [],
    timeseries: [],
    cache: [],
    graph: [],
  };

  databaseTypes.forEach((db) => {
    groupedByCategory[db.category].push(db);
  });

  const renderDatabaseCard = (
    config: (typeof DATABASE_CONFIGS)[DatabaseType],
  ) => {
    const Icon = ICON_MAP[config.icon];

    return (
      <button
        key={config.type}
        onClick={() => onSelect(config.type)}
        className="group relative flex flex-col items-center p-4 glass-morphism rounded-2xl border hover-3d shimmer perspective-card"
        style={{ borderColor: theme.colors.border }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 glow-effect floating-animation"
          style={{
            backgroundColor: config.color + "20",
            boxShadow: `0 0 20px ${config.color}40`,
          }}
        >
          <Icon className="w-7 h-7" style={{ color: config.color }} />
        </div>
        <h3
          className="font-semibold text-center text-sm"
          style={{ color: theme.colors.text }}
        >
          {config.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
            Port {config.defaultPort || "N/A"}
          </p>
          {config.supportsDocker && (
            <span
              className="px-2 py-0.5 text-xs rounded-full border"
              style={{
                backgroundColor: theme.colors.accent + "20",
                color: theme.colors.accent,
                borderColor: theme.colors.accent + "30",
              }}
            >
              Docker
            </span>
          )}
        </div>
      </button>
    );
  };

  const categoryOrder: DatabaseCategory[] = [
    "rdbms",
    "cloud",
    "nosql",
    "aws",
    "timeseries",
    "cache",
    "graph",
  ];

  return (
    <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2">
      {categoryOrder.map((category) => {
        const databases = groupedByCategory[category];
        if (databases.length === 0) return null;

        const categoryInfo = DATABASE_CATEGORIES[category];
        const CategoryIcon = ICON_MAP[categoryInfo.icon];

        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-3 px-2">
              <CategoryIcon
                className="w-4 h-4"
                style={{ color: categoryInfo.color }}
              />
              <h3
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: categoryInfo.color }}
              >
                {categoryInfo.name}
              </h3>
              <span
                className="text-xs"
                style={{ color: theme.colors.textSecondary }}
              >
                ({databases.length})
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {databases.map(renderDatabaseCard)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
