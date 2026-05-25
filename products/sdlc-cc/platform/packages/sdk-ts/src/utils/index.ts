// Utility functions for the SDLC.ai JavaScript SDK
// Re-exports all utility modules for backward compatibility

export { isNode, isBrowser, isWebWorker } from './environment';
export { SecurityUtils } from './security';
export { ValidationUtils } from './validation';
export { StorageUtils } from './storage';
export { NetworkUtils } from './network';
export { DateUtils } from './date';
export { TokenUtils } from './token';
export { ObjectUtils } from './object';
export { StringUtils } from './string';

// Aliased exports for backward compatibility
import { SecurityUtils } from './security';
import { ValidationUtils } from './validation';
import { StorageUtils } from './storage';
import { NetworkUtils } from './network';
import { DateUtils } from './date';
import { TokenUtils } from './token';
import { ObjectUtils } from './object';
import { StringUtils } from './string';

export {
  SecurityUtils as Security,
  ValidationUtils as Validation,
  StorageUtils as Storage,
  NetworkUtils as Network,
  DateUtils as Date,
  TokenUtils as Token,
  ObjectUtils as Object,
  StringUtils as String
};
