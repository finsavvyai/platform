// Object utilities for the SDLC.ai JavaScript SDK

export class ObjectUtils {
  /**
   * Deep merge objects
   */
  static deepMerge<T extends Record<string, unknown>>(target: T, ...sources: Array<Partial<T>>): T {
    if (!sources.length) return target;
    const source = sources.shift();

    if (this.isObject(target) && this.isObject(source)) {
      for (const key in source) {
        const sourceVal = (source as Record<string, unknown>)[key];
        if (this.isObject(sourceVal)) {
          if (!(target as Record<string, unknown>)[key]) Object.assign(target, { [key]: {} });
          this.deepMerge((target as Record<string, unknown>)[key] as Record<string, unknown>, sourceVal as Partial<Record<string, unknown>>);
        } else {
          Object.assign(target, { [key]: sourceVal });
        }
      }
    }

    return this.deepMerge(target, ...sources);
  }

  /**
   * Check if value is an object
   */
  static isObject(item: unknown): item is Record<string, unknown> {
    return item !== null && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Deep clone object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array) return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const clonedObj = {} as { [key: string]: unknown };
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          clonedObj[key] = this.deepClone(obj[key]);
        }
      }
      return clonedObj as T;
    }
    return obj;
  }

  /**
   * Omit keys from object
   */
  static omit<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    keys.forEach(key => delete result[key]);
    return result;
  }

  /**
   * Pick keys from object
   */
  static pick<T extends Record<string, unknown>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    keys.forEach(key => {
      if (key in obj) {
        result[key] = obj[key];
      }
    });
    return result;
  }
}
