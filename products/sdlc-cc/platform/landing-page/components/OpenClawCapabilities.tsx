import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const DEFAULT_CHANNELS = ['slack', 'telegram', 'discord', 'whatsapp', 'matrix', 'signal', 'imessage', 'msteams', 'googlechat', 'mattermost'];
const DEFAULT_NODES = ['voicewake', 'audio', 'camera', 'images', 'media-understanding', 'location-command', 'talk'];
const DEFAULT_EXTENSIONS = ['memory-core', 'memory-lancedb', 'device-pair', 'discord', 'line', 'matrix', 'msteams', 'google-gemini-cli-auth'];
const DEFAULT_SKILLS = ['coding-agent', 'github', 'gemini', 'canvas', 'voice-call', 'notion', 'discord', 'clawhub'];

const pillClass = 'inline-flex items-center rounded-md border border-primary/15 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700';

type OpenClawCaps = {
  channels: string[];
  nodes: string[];
  extensions: string[];
  skills: string[];
};

const OpenClawCapabilities = () => {
  const [caps, setCaps] = useState<OpenClawCaps>({
    channels: DEFAULT_CHANNELS,
    nodes: DEFAULT_NODES,
    extensions: DEFAULT_EXTENSIONS,
    skills: DEFAULT_SKILLS,
  });

  useEffect(() => {
    const controller = new AbortController();
    const url = process.env.NEXT_PUBLIC_GATEWAY_URL || 'https://api.sdlc.cc';
    fetch(`${url}/api/v1/openclaw/capabilities`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ available?: boolean; channels?: string[]; nodes?: string[]; extensions?: string[]; skills?: string[] }>)
      .then((data) => {
        if (data?.available && (data.channels?.length || data.nodes?.length || data.extensions?.length || data.skills?.length)) {
          setCaps({
            channels: data.channels || DEFAULT_CHANNELS,
            nodes: data.nodes || DEFAULT_NODES,
            extensions: data.extensions || DEFAULT_EXTENSIONS,
            skills: data.skills || DEFAULT_SKILLS,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <section id="openclaw" className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-slate-950 mb-4">Embedded OpenClaw capabilities</h2>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">Multi-channel and node-ready AI operations integrated directly from your OpenClaw workspace.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {[['Channels', caps.channels], ['Node Capabilities', caps.nodes], ['Extensions', caps.extensions], ['Skills', caps.skills]].map(([title, items]) => (
            <div key={String(title)} className="glass-panel rounded-3xl p-6 card-hover cursor-pointer">
              <h3 className="text-slate-900 font-semibold mb-3">{title}</h3>
              <div className="flex flex-wrap gap-2">
                {(items as string[]).map((item) => (
                  <span key={item} className={pillClass}>{item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OpenClawCapabilities;
