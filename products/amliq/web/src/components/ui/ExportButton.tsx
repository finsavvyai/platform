import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from './Button';
import { useToast } from './Toast';
import { tokenManager } from '../../utils/tokenManager';

interface ExportButtonProps {
  filename: string;
  url: string;
  disabled?: boolean;
}

export function ExportButton({ filename, url, disabled }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = { ...tokenManager.getAuthHeader() };

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      if (import.meta.env.DEV) console.error('Export error:', err);
      toast('Export failed. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || loading}
      variant="secondary"
      size="sm"
      className="gap-2"
    >
      <Download className="w-4 h-4" />
      {loading ? 'Exporting...' : 'Export'}
    </Button>
  );
}
