import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
expect.extend(matchers as any);
