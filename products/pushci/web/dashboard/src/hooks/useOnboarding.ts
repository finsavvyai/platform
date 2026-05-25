import { useState, useEffect } from 'react';
import { api } from './useApi';

const STORAGE_KEY = 'pushci_onboarding_complete';

export function useOnboarding() {
  const [step, setStep] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([api.getProjects(), api.getRuns()])
      .then(([projects, runs]) => {
        if (cancelled) return;
        if (projects.length === 0 && runs.length === 0) {
          setShowOnboarding(true);
        }
      })
      .catch(() => {
        /* silently skip onboarding on error */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function dismissOnboarding() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShowOnboarding(false);
  }

  return {
    showOnboarding: !loading && showOnboarding,
    dismissOnboarding,
    step,
    setStep,
  };
}
