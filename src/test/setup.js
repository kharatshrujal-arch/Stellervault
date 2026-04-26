import '@testing-library/jest-dom';

// Mock Buffer for tests
import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: () => Promise.resolve(),
    readText: () => Promise.resolve(''),
  },
  writable: true,
});
