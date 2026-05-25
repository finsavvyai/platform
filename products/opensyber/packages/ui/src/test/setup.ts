import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// Stub canvas — jsdom does not support it
HTMLCanvasElement.prototype.getContext = (() => null) as never;
