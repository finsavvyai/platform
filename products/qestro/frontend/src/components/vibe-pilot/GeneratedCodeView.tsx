import { useState } from 'react';
import { Copy, Download, Play, FileText, Code } from 'lucide-react';
import { Button, Badge } from '../atoms';
import { motion } from 'framer-motion';

interface GeneratedCodeViewProps {
  code: string;
  testType: 'E2E' | 'API' | 'Visual';
  framework: string;
  confidence: number;
  onRun?: () => void;
  onSave?: () => void;
}

export function GeneratedCodeView({
  code,
  testType,
  framework,
  confidence,
  onRun,
  onSave,
}: GeneratedCodeViewProps) {
  const [copied, setCopied] = useState(false);
  const [lineNumbers, setLineNumbers] = useState(true);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const filename = `test-${testType.toLowerCase()}.${framework.toLowerCase().includes('typescript') ? 'ts' : 'js'}`;
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(code));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const codeLines = code.split('\n');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
            <Code className="h-5 w-5 text-green-400" />
            Generated Test Code
          </h3>
          <div className="flex gap-2 items-center">
            <Badge variant="primary">{testType}</Badge>
            <Badge variant="secondary">{framework}</Badge>
            <span className="text-xs text-slate-400">Confidence: {confidence}%</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer hover:text-white">
          <input
            type="checkbox"
            checked={lineNumbers}
            onChange={(e) => setLineNumbers(e.target.checked)}
            className="w-4 h-4 rounded"
          />
          Line Numbers
        </label>
      </div>

      {/* Code Block */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <tbody>
              {codeLines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
                  {lineNumbers && (
                    <td className="bg-slate-900 text-slate-500 select-none w-12 text-right px-4 py-1 border-r border-slate-700">
                      {idx + 1}
                    </td>
                  )}
                  <td className="px-4 py-1 text-slate-200 font-mono whitespace-pre">{line || '\u00A0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleCopyCode}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-all ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          <Copy className="h-4 w-4" />
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
        <Button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-slate-700 text-slate-200 hover:bg-slate-600"
        >
          <Download className="h-4 w-4" />
          Download
        </Button>
        {onSave && (
          <Button
            onClick={onSave}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700"
          >
            <FileText className="h-4 w-4" />
            Save Test
          </Button>
        )}
        {onRun && (
          <Button
            onClick={onRun}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700"
          >
            <Play className="h-4 w-4" />
            Run Now
          </Button>
        )}
      </div>
    </motion.div>
  );
}
