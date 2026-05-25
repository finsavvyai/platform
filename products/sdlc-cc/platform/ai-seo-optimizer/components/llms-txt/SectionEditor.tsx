import { Trash2, Plus } from 'lucide-react';
import type { LlmsTxtSection } from '../../lib/types';

interface SectionEditorProps {
  section: LlmsTxtSection;
  index: number;
  onChange: (index: number, section: LlmsTxtSection) => void;
  onRemove: (index: number) => void;
}

const SectionEditor = ({ section, index, onChange, onRemove }: SectionEditorProps) => {
  const updateHeading = (heading: string) => {
    onChange(index, { ...section, heading });
  };

  const updateLink = (linkIdx: number, field: string, value: string) => {
    const links = [...section.links];
    links[linkIdx] = { ...links[linkIdx], [field]: value };
    onChange(index, { ...section, links });
  };

  const addLink = () => {
    onChange(index, {
      ...section,
      links: [...section.links, { title: '', url: '', description: '' }],
    });
  };

  const removeLink = (linkIdx: number) => {
    onChange(index, {
      ...section,
      links: section.links.filter((_, i) => i !== linkIdx),
    });
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={section.heading}
          onChange={(e) => updateHeading(e.target.value)}
          placeholder="Section heading"
          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-primary/30 focus:outline-none"
        />
        <button
          onClick={() => onRemove(index)}
          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          aria-label="Remove section"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {section.links.map((link, linkIdx) => (
          <div key={linkIdx} className="flex gap-2 items-start">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <input
                type="text"
                value={link.title}
                onChange={(e) => updateLink(linkIdx, 'title', e.target.value)}
                placeholder="Title"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
              <input
                type="text"
                value={link.url}
                onChange={(e) => updateLink(linkIdx, 'url', e.target.value)}
                placeholder="URL"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-code focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
              <input
                type="text"
                value={link.description}
                onChange={(e) => updateLink(linkIdx, 'description', e.target.value)}
                placeholder="Description"
                className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
              />
            </div>
            <button
              onClick={() => removeLink(linkIdx)}
              className="p-2 rounded-lg text-slate-300 hover:text-red-500 transition-colors mt-0.5"
              aria-label="Remove link"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addLink}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-600 mt-3 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add link
      </button>
    </div>
  );
};

export default SectionEditor;
