import type { Preview } from '@storybook/react';
import '../src/styles/index.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f172a' },
        { name: 'light', value: '#ffffff' },
        { name: 'slate', value: '#1e293b' },
      ],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
