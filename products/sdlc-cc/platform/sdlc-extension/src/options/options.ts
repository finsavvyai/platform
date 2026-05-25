import { loadSettings, saveSettings, Policy } from '../storage';

async function init(): Promise<void> {
  const apiKeyEl = document.getElementById('apiKey') as HTMLInputElement;
  const endpointEl = document.getElementById('endpoint') as HTMLInputElement;
  const policyEl = document.getElementById('policy') as HTMLSelectElement;
  const saveBtn = document.getElementById('save') as HTMLButtonElement;
  const savedMsg = document.getElementById('saved');

  const s = await loadSettings();
  apiKeyEl.value = s.apiKey ?? '';
  endpointEl.value = s.endpoint;
  policyEl.value = s.policy;

  saveBtn.addEventListener('click', async () => {
    await saveSettings({
      apiKey: apiKeyEl.value.trim() || undefined,
      endpoint: endpointEl.value.trim() || 'https://api.sdlc.cc',
      policy: policyEl.value as Policy,
    });
    if (savedMsg) {
      savedMsg.textContent = 'Saved.';
      setTimeout(() => { if (savedMsg) savedMsg.textContent = ''; }, 1800);
    }
  });
}

void init();
