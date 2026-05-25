import { useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check, Download } from 'lucide-react';

interface PreviewPanelProps {
  content: string;
}

const PreviewPanel = ({ content }: PreviewPanelProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'llms.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
        <span className="text-sm font-medium text-slate-300">llms.txt preview</span>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={handleCopy}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-score-high" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </motion.button>
          <motion.button
            onClick={handleDownload}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </motion.button>
        </div>
      </div>
      <pre className="p-5 text-sm text-slate-200 font-code overflow-x-auto leading-relaxed whitespace-pre-wrap">
        {content}
      </pre>
    </div>
  );
};

export default PreviewPanel;
