import { useState } from 'react';
import { Container, CheckCircle, XCircle, Info, ExternalLink, Copy, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { DatabaseType, DATABASE_CONFIGS } from '../types/database';

interface DockerHelperProps {
  databaseType: DatabaseType;
  onUseDockerConfig: (host: string, port: string) => void;
}

export function DockerHelper({ databaseType, onUseDockerConfig }: DockerHelperProps) {
  const { theme } = useTheme();
  const config = DATABASE_CONFIGS[databaseType];
  const [dockerStatus, setDockerStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const getDockerCommand = () => {
    const commands: Record<string, string> = {
      postgresql: `docker run --name postgres-dev -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:latest`,
      mysql: `docker run --name mysql-dev -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mysql:latest`,
      mongodb: `docker run --name mongo-dev -p 27017:27017 -d mongo:latest`,
      redis: `docker run --name redis-dev -p 6379:6379 -d redis:latest`,
      mariadb: `docker run --name mariadb-dev -e MYSQL_ROOT_PASSWORD=root -p 3306:3306 -d mariadb:latest`,
      cassandra: `docker run --name cassandra-dev -p 9042:9042 -d cassandra:latest`,
      couchdb: `docker run --name couchdb-dev -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password -p 5984:5984 -d couchdb:latest`,
      neo4j: `docker run --name neo4j-dev -p 7474:7474 -p 7687:7687 -d neo4j:latest`,
      influxdb: `docker run --name influxdb-dev -p 8086:8086 -d influxdb:latest`,
      timescaledb: `docker run --name timescaledb-dev -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d timescale/timescaledb:latest`,
    };
    return commands[databaseType] || '';
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(getDockerCommand());
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const useDockerDefaults = () => {
    onUseDockerConfig('localhost', config.defaultPort.toString());
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl p-4 border" style={{ borderColor: theme.colors.border }}>
        <div className="flex items-start gap-3">
          <Container className="w-5 h-5 mt-0.5" style={{ color: theme.colors.accent }} />
          <div className="flex-1">
            <h4 className="font-semibold mb-2" style={{ color: theme.colors.text }}>
              Docker Quick Start
            </h4>
            <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
              Run {config.name} locally using Docker. Perfect for development and testing.
            </p>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium" style={{ color: theme.colors.textSecondary }}>
                    Docker Command:
                  </span>
                  <button
                    onClick={copyCommand}
                    className="text-xs px-2 py-1 rounded flex items-center gap-1 transition-all"
                    style={{
                      color: theme.colors.accent,
                      backgroundColor: theme.colors.accent + '20'
                    }}
                  >
                    {copiedCommand ? (
                      <>
                        <Check className="w-3 h-3" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <code
                  className="block text-xs p-3 rounded-lg font-mono break-all"
                  style={{
                    backgroundColor: theme.colors.background,
                    color: theme.colors.text,
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  {getDockerCommand()}
                </code>
              </div>

              <button
                onClick={useDockerDefaults}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: `linear-gradient(135deg, ${theme.colors.accent}, ${theme.colors.accentHover})`,
                  color: 'white'
                }}
              >
                Use Docker Defaults (localhost:{config.defaultPort})
              </button>

              <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium transition-all border"
                style={{
                  borderColor: theme.colors.border,
                  color: theme.colors.textSecondary
                }}
              >
                <Info className="w-4 h-4 inline mr-2" />
                {showGuide ? 'Hide' : 'Show'} Setup Guide
              </button>
            </div>
          </div>
        </div>
      </div>

      {showGuide && (
        <div className="glass-card rounded-2xl p-4 border space-y-4" style={{ borderColor: theme.colors.border }}>
          <h4 className="font-semibold" style={{ color: theme.colors.text }}>
            Docker Desktop Installation Guide
          </h4>

          <div className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.accent }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: theme.colors.accent + '20' }}>1</span>
                Windows
              </h5>
              <ul className="text-sm space-y-1 ml-8" style={{ color: theme.colors.textSecondary }}>
                <li>• Download Docker Desktop from <a href="https://www.docker.com/products/docker-desktop" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: theme.colors.accent }}>docker.com</a></li>
                <li>• Run the installer and follow the setup wizard</li>
                <li>• Restart your computer when prompted</li>
                <li>• Launch Docker Desktop from the Start menu</li>
                <li>• Wait for Docker to start (whale icon in system tray)</li>
                <li>• Open PowerShell or Command Prompt and verify: <code className="px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.background }}>docker --version</code></li>
              </ul>
            </div>

            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.accent }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: theme.colors.accent + '20' }}>2</span>
                macOS
              </h5>
              <ul className="text-sm space-y-1 ml-8" style={{ color: theme.colors.textSecondary }}>
                <li>• Download Docker Desktop for Mac from <a href="https://www.docker.com/products/docker-desktop" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: theme.colors.accent }}>docker.com</a></li>
                <li>• Open the .dmg file and drag Docker to Applications</li>
                <li>• Launch Docker from Applications folder</li>
                <li>• Grant necessary permissions when prompted</li>
                <li>• Wait for Docker to start (whale icon in menu bar)</li>
                <li>• Open Terminal and verify: <code className="px-2 py-0.5 rounded" style={{ backgroundColor: theme.colors.background }}>docker --version</code></li>
              </ul>
            </div>

            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: theme.colors.accent }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: theme.colors.accent + '20' }}>3</span>
                Running Your Database
              </h5>
              <ul className="text-sm space-y-1 ml-8" style={{ color: theme.colors.textSecondary }}>
                <li>• Copy the Docker command above</li>
                <li>• Paste it into your terminal/command prompt</li>
                <li>• Press Enter to run the container</li>
                <li>• Wait for the download and startup to complete</li>
                <li>• Click "Use Docker Defaults" button above to auto-fill connection details</li>
              </ul>
            </div>

            <div className="pt-2 border-t" style={{ borderColor: theme.colors.border }}>
              <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
                <Info className="w-3 h-3 inline mr-1" />
                Need help? Check the <a href="https://docs.docker.com/get-docker/" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: theme.colors.accent }}>official Docker documentation</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
