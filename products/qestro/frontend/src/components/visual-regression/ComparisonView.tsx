import { useState } from 'react';
import { ZoomIn, ZoomOut, Eye, Check, AlertTriangle, Maximize2 } from 'lucide-react';
import { Button, Badge } from '../atoms';
import { motion } from 'framer-motion';

interface ComparisonViewProps {
  baseline: string;
  current: string;
  diff: string;
  status: 'pass' | 'fail' | 'new';
  mismatchPercentage: number;
  testName: string;
  onApprove?: () => void;
  onReject?: () => void;
  onSetBaseline?: () => void;
}

export function ComparisonView({
  baseline,
  current,
  diff,
  status,
  mismatchPercentage,
  testName,
  onApprove,
  onReject,
  onSetBaseline,
}: ComparisonViewProps) {
  const [zoom, setZoom] = useState(100);
  const [fullscreen, setFullscreen] = useState<'baseline' | 'current' | 'diff' | null>(null);

  const handleZoom = (delta: number) => {
    setZoom(Math.min(200, Math.max(50, zoom + delta)));
  };

  const getStatusIcon = () => {
    if (status === 'pass') return <Check className="h-5 w-5 text-green-400" />;
    if (status === 'fail') return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
    return <Eye className="h-5 w-5 text-blue-400" />;
  };

  const getStatusColor = () => {
    if (status === 'pass') return 'bg-green-900/20 border-green-700 text-green-300';
    if (status === 'fail') return 'bg-yellow-900/20 border-yellow-700 text-yellow-300';
    return 'bg-blue-900/20 border-blue-700 text-blue-300';
  };

  const ImagePanel = ({ image, label }: { image: string; label: string }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-300">{label}</label>
        {image && (
          <button
            onClick={() => setFullscreen(label as 'baseline' | 'current' | 'diff')}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <Maximize2 className="h-4 w-4 text-slate-400 hover:text-slate-200" />
          </button>
        )}
      </div>
      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex items-center justify-center min-h-64">
        {image ? (
          <img
            src={image}
            alt={label}
            className="w-full h-auto"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
              maxWidth: '100%',
            }}
          />
        ) : (
          <div className="text-slate-500 text-center py-8">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No image available</p>
          </div>
        )}
      </div>
    </motion.div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-slate-900 rounded-lg max-w-4xl w-full max-h-96 overflow-auto">
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-white">{fullscreen}</h3>
            <button
              onClick={() => setFullscreen(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            <img
              src={
                fullscreen === 'baseline'
                  ? baseline
                  : fullscreen === 'current'
                  ? current
                  : diff
              }
              alt={fullscreen}
              className="w-full h-auto"
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            {getStatusIcon()}
            {testName}
          </h2>
          <Badge variant={status === 'pass' ? 'success' : 'warning'}>{status.toUpperCase()}</Badge>
        </div>
        {mismatchPercentage > 0 && (
          <div className={`px-3 py-1 rounded-lg border ${getStatusColor()}`}>
            <span className="font-medium">{mismatchPercentage}% mismatch</span>
          </div>
        )}
      </div>

      {/* Zoom Controls */}
      <div className="flex gap-2 justify-end">
        <Button
          onClick={() => handleZoom(-10)}
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-1"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="px-3 py-2 text-sm font-medium text-slate-300 bg-slate-800 rounded-lg">
          {zoom}%
        </span>
        <Button
          onClick={() => handleZoom(10)}
          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg flex items-center gap-1"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Screenshots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {baseline && <ImagePanel image={baseline} label="Baseline" />}
        {current && <ImagePanel image={current} label="Current" />}
        {diff && <ImagePanel image={diff} label="Diff" />}
        {status === 'new' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full flex items-center justify-center p-8 bg-slate-800/50 border border-dashed border-slate-600 rounded-lg">
            <div className="text-center">
              <Eye className="h-8 w-8 mx-auto mb-2 text-slate-400" />
              <p className="text-slate-400">New screenshot without baseline</p>
            </div>
          </motion.div>
        )}
      </div>

      {/* Action Buttons */}
      {status === 'fail' && onApprove && onReject && (
        <div className="flex gap-3">
          <Button
            onClick={onApprove}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Approve Change
          </Button>
          <Button
            onClick={onReject}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium py-2 rounded-lg"
          >
            Reject
          </Button>
        </div>
      )}

      {status === 'new' && onSetBaseline && (
        <Button
          onClick={onSetBaseline}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" />
          Set as Baseline
        </Button>
      )}
    </motion.div>
  );
}
