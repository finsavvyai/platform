import { useState, useMemo } from 'react';
import Head from 'next/head';
import { motion } from 'framer-motion';
import { FileText, Plus } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import SectionEditor from '../../components/llms-txt/SectionEditor';
import PreviewPanel from '../../components/llms-txt/PreviewPanel';
import { generateLlmsTxt, defaultConfig } from '../../lib/llms-txt';
import type { LlmsTxtConfig, LlmsTxtSection } from '../../lib/types';

export default function LlmsTxtPage() {
  const [config, setConfig] = useState<LlmsTxtConfig>(defaultConfig);
  const preview = useMemo(() => generateLlmsTxt(config), [config]);

  const updateSection = (idx: number, section: LlmsTxtSection) => {
    const sections = [...config.sections];
    sections[idx] = section;
    setConfig({ ...config, sections });
  };

  const removeSection = (idx: number) => {
    setConfig({ ...config, sections: config.sections.filter((_, i) => i !== idx) });
  };

  const addSection = () => {
    setConfig({
      ...config,
      sections: [...config.sections, { heading: 'New Section', links: [] }],
    });
  };

  return (
    <>
      <Head>
        <title>llms.txt Generator | RankAI</title>
        <meta name="description" content="Generate and manage your llms.txt file. Help AI language models discover your most important content." />
      </Head>

      <div className="min-h-screen">
        <Header />
        <main className="pt-32 pb-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <PageHeader />
            <div className="grid lg:grid-cols-2 gap-8 mt-10">
              <EditorPane
                config={config}
                onTitleChange={(title) => setConfig({ ...config, title })}
                onDescChange={(description) => setConfig({ ...config, description })}
                onUpdateSection={updateSection}
                onRemoveSection={removeSection}
                onAddSection={addSection}
              />
              <div className="lg:sticky lg:top-28 lg:self-start">
                <PreviewPanel content={preview} />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </>
  );
}

function PageHeader() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 rounded-full glass-panel px-4 py-2 mb-6">
        <FileText className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-slate-700">
          Free llms.txt generator
        </span>
      </div>
      <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-950 mb-4">
        Create your <span className="gradient-text">llms.txt</span>
      </h1>
      <p className="text-lg text-slate-600 max-w-2xl mx-auto">
        The llms.txt standard helps AI models find your most important
        content. Build yours visually, then download and deploy.
      </p>
    </motion.div>
  );
}

interface EditorPaneProps {
  config: LlmsTxtConfig;
  onTitleChange: (v: string) => void;
  onDescChange: (v: string) => void;
  onUpdateSection: (i: number, s: LlmsTxtSection) => void;
  onRemoveSection: (i: number) => void;
  onAddSection: () => void;
}

function EditorPane({
  config, onTitleChange, onDescChange,
  onUpdateSection, onRemoveSection, onAddSection,
}: EditorPaneProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-100 bg-white p-5 space-y-4">
        <div>
          <label htmlFor="site-title" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
            Site Title
          </label>
          <input
            id="site-title"
            type="text"
            value={config.title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 font-semibold focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="site-desc" className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1 block">
            Description
          </label>
          <textarea
            id="site-desc"
            value={config.description}
            onChange={(e) => onDescChange(e.target.value)}
            rows={2}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 resize-none focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
        </div>
      </div>

      {config.sections.map((section, i) => (
        <SectionEditor
          key={i}
          section={section}
          index={i}
          onChange={onUpdateSection}
          onRemove={onRemoveSection}
        />
      ))}

      <button
        onClick={onAddSection}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:border-primary/40 hover:text-primary transition-colors"
      >
        <Plus className="h-4 w-4" /> Add Section
      </button>
    </div>
  );
}
