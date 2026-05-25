/**
 * SelectorBuilder - Generates stable selectors for page elements
 */

export class SelectorBuilder {
  /**
   * Get a stable selector for an element
   */
  async getSelector(element: any): Promise<string> {
    try {
      // Try ID first
      const id = await element.getAttribute('id');
      if (id) return `#${id}`;

      // Try name
      const name = await element.getAttribute('name');
      if (name) return `[name="${name}"]`;

      // Try data-testid
      const testId = await element.getAttribute('data-testid');
      if (testId) return `[data-testid="${testId}"]`;

      // Fall back to CSS selector
      return await element.evaluate((el: HTMLElement) => {
        if (el.id) return `#${el.id}`;
        if (el.className) return `.${el.className.split(' ')[0]}`;
        return el.tagName.toLowerCase();
      });
    } catch {
      return 'unknown';
    }
  }
}

export const selectorBuilder = new SelectorBuilder();
