import { writable, derived } from 'svelte/store';
import type { Readable, Writable } from 'svelte/store';

export interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: string;
  status: 'pending' | 'in_progress' | 'completed';
  data?: Record<string, any>;
  errors?: Record<string, string>;
  canSkip?: boolean;
}

export interface WizardState {
  currentStep: number;
  steps: WizardStep[];
  completed: boolean;
  completedAt?: Date;
}

export class WizardController {
  state: Writable<WizardState>;
  currentStep: Readable<WizardStep>;
  progress: Readable<number>;

  constructor(steps: Omit<WizardStep, 'status'>[]) {
    this.state = writable<WizardState>({
      currentStep: 0,
      steps: steps.map(s => ({ ...s, status: 'pending' as const })),
      completed: false
    });

    this.currentStep = derived(this.state, $state => $state.steps[$state.currentStep]);

    this.progress = derived(this.state, $state => {
      const completed = $state.steps.filter(s => s.status === 'completed').length;
      return (completed / $state.steps.length) * 100;
    });
  }

  getCurrentStep(): WizardStep | undefined {
    let current: WizardStep | undefined;
    this.state.subscribe(s => {
      current = s.steps[s.currentStep];
    })();
    return current;
  }

  canProceed(): boolean {
    const step = this.getCurrentStep();
    return step ? !step.errors || Object.keys(step.errors).length === 0 : false;
  }

  setStepData(data: Record<string, any>): void {
    this.state.update(s => {
      const updated = [...s.steps];
      updated[s.currentStep].data = { ...updated[s.currentStep].data, ...data };
      return { ...s, steps: updated };
    });
  }

  setStepError(field: string, error: string): void {
    this.state.update(s => {
      const updated = [...s.steps];
      updated[s.currentStep].errors = {
        ...updated[s.currentStep].errors,
        [field]: error
      };
      return { ...s, steps: updated };
    });
  }

  clearStepError(field?: string): void {
    this.state.update(s => {
      const updated = [...s.steps];
      if (field) {
        const { [field]: _, ...rest } = updated[s.currentStep].errors || {};
        updated[s.currentStep].errors = rest;
      } else {
        updated[s.currentStep].errors = {};
      }
      return { ...s, steps: updated };
    });
  }

  completeStep(): void {
    this.state.update(s => {
      const updated = [...s.steps];
      updated[s.currentStep].status = 'completed';
      return { ...s, steps: updated };
    });
  }

  nextStep(): boolean {
    const state = this.getState();

    if (!state) return false;

    const step = state.steps[state.currentStep];
    if (step.errors && Object.keys(step.errors).length > 0) {
      return false;
    }

    if (state.currentStep < state.steps.length - 1) {
      this.state.update(s => ({
        ...s,
        currentStep: s.currentStep + 1
      }));
      return true;
    }

    return false;
  }

  previousStep(): boolean {
    const state = this.getState();

    if (!state || state.currentStep === 0) return false;

    this.state.update(s => ({
      ...s,
      currentStep: s.currentStep - 1
    }));

    return true;
  }

  skipStep(): boolean {
    const step = this.getCurrentStep();
    if (step?.canSkip) {
      this.completeStep();
      return this.nextStep();
    }
    return false;
  }

  async complete(): Promise<WizardState | null> {
    const state = this.getState();

    if (!state) return null;

    const allCompleted = state.steps.every(
      (s: WizardStep) => s.status === 'completed'
    );
    if (allCompleted) {
      const completed: WizardState = {
        ...state,
        completed: true,
        completedAt: new Date()
      };

      this.state.set(completed);
      return completed;
    }

    return null;
  }

  reset(): void {
    this.state.update(s => ({
      ...s,
      currentStep: 0,
      completed: false,
      steps: s.steps.map(step => ({
        ...step,
        status: 'pending',
        data: undefined,
        errors: undefined
      }))
    }));
  }

  getState(): WizardState | null {
    let state: WizardState | null = null;
    this.state.subscribe(s => {
      state = s;
    })();
    return state;
  }
}

export function createWizard(steps: Omit<WizardStep, 'status'>[]): WizardController {
  return new WizardController(steps);
}
