import { loadCounter } from '../storage';
import { loadSettings, saveSettings } from '../storage';

async function init(): Promise<void> {
  const [counter, settings] = await Promise.all([loadCounter(), loadSettings()]);

  const blocksEl = document.getElementById('blocks');
  if (blocksEl) blocksEl.textContent = String(counter.blocks);

  const toggle = document.getElementById('enabled') as HTMLInputElement | null;
  const label = document.getElementById('enabled-label');
  if (!toggle || !label) return;

  toggle.checked = settings.enabled;
  label.textContent = settings.enabled ? 'on' : 'off';

  toggle.addEventListener('change', async () => {
    const next = await saveSettings({ enabled: toggle.checked });
    label.textContent = next.enabled ? 'on' : 'off';
  });
}

void init();
