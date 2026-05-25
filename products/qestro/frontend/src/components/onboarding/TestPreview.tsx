import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Check } from 'lucide-react';
import { Card } from '../atoms/Card/Card';

interface TestPreviewProps {
  code: string;
  title?: string;
  lineNumber?: boolean;
}

const TestPreview = ({
  code,
  title = 'Generated Test Code',
  lineNumber = true
}: TestPreviewProps) => {
  const [displayedCode, setDisplayedCode] = useState('');
  const [copied, setCopied] = useState(false);

  // Animate code appearance line by line
  useEffect(() => {
    const lines = code.split('\n');
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex <= lines.length) {
        setDisplayedCode(lines.slice(0, currentIndex).join('\n'));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeLines = displayedCode.split('\n');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="p-6 border-blue-700/50 bg-slate-950 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-blue-400">{title}</h3>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>

        {/* Code Block */}
        <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-96 font-mono text-sm">
          <div className="space-y-0">
            {codeLines.map((line, idx) => {
              // Simple syntax highlighting
              const isComment = line.trim().startsWith('//');
              const isString = line.includes("'") || line.includes('"');
              const isKeyword = /\b(const|let|var|function|async|await|test|describe)\b/.test(
                line
              );

              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="flex gap-4"
                >
                  {lineNumber && (
                    <span className="text-slate-600 select-none min-w-8 text-right">
                      {idx + 1}
                    </span>
                  )}
                  <code
                    className={`flex-1 ${
                      isComment
                        ? 'text-slate-500'
                        : isKeyword
                        ? 'text-blue-400'
                        : isString
                        ? 'text-green-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {line || '\u00A0'}
                  </code>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-slate-800">
          <p className="text-slate-400 text-xs">
            This is your auto-generated test. Edit it as needed in the editor.
          </p>
        </div>
      </Card>
    </motion.div>
  );
};

export default TestPreview;
