/**
 * Action Optimizer
 * Converts raw recorded actions into optimized, clean test steps
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import {
  RecordedAction,
  RecordedStep,
  ActionType,
  Selector,
} from './types.js';

export class ActionOptimizer {
  /**
   * Optimize raw actions into clean test steps
   */
  optimizeActions(actions: RecordedAction[]): RecordedStep[] {
    if (actions.length === 0) return [];

    logger.info('Optimizing actions', { count: actions.length });

    let steps: RecordedStep[] = [];
    let i = 0;

    while (i < actions.length) {
      const action = actions[i];

      // Group consecutive type actions into single fill step
      if (action.type === 'type') {
        const fillStep = this.createFillStep(actions, i);
        steps.push(fillStep.step);
        i = fillStep.nextIndex;
        continue;
      }

      // Merge consecutive clicks on same selector
      if (action.type === 'click') {
        const clickStep = this.createClickStep(action);
        steps.push(clickStep);
        i++;
        continue;
      }

      // Handle navigation
      if (action.type === 'navigate') {
        steps.push(this.createNavigateStep(action));
        i++;
        continue;
      }

      // Handle scrolls
      if (action.type === 'scroll') {
        steps.push(this.createScrollStep(action));
        i++;
        continue;
      }

      // Handle hover
      if (action.type === 'hover') {
        steps.push(this.createHoverStep(action));
        i++;
        continue;
      }

      // Handle assertions
      if (action.type === 'assert') {
        steps.push(this.createAssertionStep(action));
        i++;
        continue;
      }

      // Handle waits (deduplicate consecutive waits)
      if (action.type === 'wait') {
        const waitStep = this.createWaitStep(actions, i);
        steps.push(waitStep.step);
        i = waitStep.nextIndex;
        continue;
      }

      // Handle screenshots
      if (action.type === 'screenshot') {
        steps.push(this.createScreenshotStep(action));
        i++;
        continue;
      }

      // Default: create step from action
      steps.push(this.actionToStep(action));
      i++;
    }

    // Add smart waits where needed
    steps = this.addSmartWaits(steps);

    // Remove redundant steps
    steps = this.removeRedundantSteps(steps);

    logger.info('Actions optimized', { original: actions.length, optimized: steps.length });
    return steps;
  }

  /**
   * Group consecutive type actions into single fill step
   */
  private createFillStep(
    actions: RecordedAction[],
    startIndex: number
  ): { step: RecordedStep; nextIndex: number } {
    const firstAction = actions[startIndex];
    let text = firstAction.text || '';
    let i = startIndex + 1;

    // Merge consecutive type actions
    while (i < actions.length && actions[i].type === 'type' &&
           this.sameSelectorText(actions[i].selector, firstAction.selector)) {
      text += actions[i].text || '';
      i++;
    }

    return {
      step: {
        id: uuidv4(),
        actionType: 'fill',
        description: `Fill input with "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`,
        selector: firstAction.selector,
        text,
        value: text,
      },
      nextIndex: i,
    };
  }

  /**
   * Create click step with description
   */
  private createClickStep(action: RecordedAction): RecordedStep {
    return {
      id: uuidv4(),
      actionType: 'click',
      description: this.generateActionDescription('click', action),
      selector: action.selector,
    };
  }

  /**
   * Create navigate step
   */
  private createNavigateStep(action: RecordedAction): RecordedStep {
    return {
      id: uuidv4(),
      actionType: 'navigate',
      description: `Navigate to ${action.url || 'URL'}`,
      url: action.url,
    };
  }

  /**
   * Create scroll step
   */
  private createScrollStep(action: RecordedAction): RecordedStep {
    const direction = action.scrollY && action.scrollY > 0 ? 'down' : 'up';
    return {
      id: uuidv4(),
      actionType: 'scroll',
      description: `Scroll ${direction} by ${Math.abs(action.scrollY || 0)}px`,
      scrollX: action.scrollX,
      scrollY: action.scrollY,
    };
  }

  /**
   * Create hover step
   */
  private createHoverStep(action: RecordedAction): RecordedStep {
    return {
      id: uuidv4(),
      actionType: 'hover',
      description: 'Hover over element',
      selector: action.selector,
    };
  }

  /**
   * Create assertion step
   */
  private createAssertionStep(action: RecordedAction): RecordedStep {
    const assertValue = action.value || action.text || 'exists';
    return {
      id: uuidv4(),
      actionType: 'assert',
      description: `Assert element ${action.text ? 'text' : 'visible'}`,
      selector: action.selector,
      assertion: {
        type: action.text ? 'text' : 'visible',
        value: assertValue,
      },
    };
  }

  /**
   * Group consecutive wait actions
   */
  private createWaitStep(
    actions: RecordedAction[],
    startIndex: number
  ): { step: RecordedStep; nextIndex: number } {
    let totalWait = 0;
    let i = startIndex;

    while (i < actions.length && actions[i].type === 'wait') {
      totalWait += parseInt(actions[i].key || '1000');
      i++;
    }

    return {
      step: {
        id: uuidv4(),
        actionType: 'wait',
        description: `Wait ${totalWait}ms`,
        waitMs: totalWait,
      },
      nextIndex: i,
    };
  }

  /**
   * Create screenshot step
   */
  private createScreenshotStep(action: RecordedAction): RecordedStep {
    return {
      id: uuidv4(),
      actionType: 'screenshot',
      description: `Take screenshot: ${action.text || 'default'}`,
      screenshot: action.value,
    };
  }

  /**
   * Add smart waits between steps
   */
  private addSmartWaits(steps: RecordedStep[]): RecordedStep[] {
    const result: RecordedStep[] = [];

    for (let i = 0; i < steps.length; i++) {
      result.push(steps[i]);

      // Check if we need to add wait
      const current = steps[i];
      const next = steps[i + 1];

      if (next && this.shouldAddWait(current, next)) {
        result.push({
          id: uuidv4(),
          actionType: 'wait',
          description: 'Wait for navigation',
          waitMs: 500,
        });
      }
    }

    return result;
  }

  /**
   * Remove redundant steps
   */
  private removeRedundantSteps(steps: RecordedStep[]): RecordedStep[] {
    const seen = new Set<string>();
    return steps.filter((step) => {
      const key = `${step.actionType}:${JSON.stringify(step.selector)}`;
      if (seen.has(key)) {
        return false; // Skip duplicate
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Check if wait should be added between steps
   */
  private shouldAddWait(current: RecordedStep, next: RecordedStep): boolean {
    // Add wait after navigation
    if (current.actionType === 'navigate') return true;

    // Add wait before assertion after click
    if (current.actionType === 'click' && next.actionType === 'assert') return true;

    // Add wait before assertion after fill
    if (current.actionType === 'fill' && next.actionType === 'assert') return true;

    return false;
  }

  /**
   * Check if two selectors are the same
   */
  private sameSelectorText(sel1?: Selector, sel2?: Selector): boolean {
    if (!sel1 || !sel2) return false;
    return sel1.type === sel2.type && sel1.value === sel2.value;
  }

  /**
   * Generate human-readable description
   */
  private generateActionDescription(type: ActionType, action: RecordedAction): string {
    switch (type) {
      case 'click':
        return `Click on element`;
      case 'type':
        return `Type "${action.text?.substring(0, 20)}"`;
      case 'fill':
        return `Fill field with value`;
      default:
        return `Perform ${type}`;
    }
  }

  /**
   * Convert raw action to step
   */
  private actionToStep(action: RecordedAction): RecordedStep {
    return {
      id: uuidv4(),
      actionType: action.type,
      description: this.generateActionDescription(action.type, action),
      selector: action.selector,
      text: action.text,
      value: action.value,
    };
  }
}

export const actionOptimizer = new ActionOptimizer();
