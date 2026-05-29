import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({
      theme: 'dark',
      sidebarState: 'expanded',
      commandPaletteOpen: false,
    });
  });

  describe('initial state', () => {
    it('should have dark theme by default', () => {
      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('should have expanded sidebar by default', () => {
      expect(useUIStore.getState().sidebarState).toBe('expanded');
    });

    it('should have command palette closed by default', () => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      useUIStore.getState().setTheme('light');

      expect(useUIStore.getState().theme).toBe('light');
    });

    it('should set theme to dark', () => {
      useUIStore.getState().setTheme('light');
      useUIStore.getState().setTheme('dark');

      expect(useUIStore.getState().theme).toBe('dark');
    });

    it('should set theme to system', () => {
      useUIStore.getState().setTheme('system');

      expect(useUIStore.getState().theme).toBe('system');
    });
  });

  describe('toggleSidebar', () => {
    it('should collapse when expanded', () => {
      useUIStore.getState().toggleSidebar();

      expect(useUIStore.getState().sidebarState).toBe('collapsed');
    });

    it('should expand when collapsed', () => {
      useUIStore.getState().toggleSidebar(); // expanded -> collapsed
      useUIStore.getState().toggleSidebar(); // collapsed -> expanded

      expect(useUIStore.getState().sidebarState).toBe('expanded');
    });

    it('should alternate on multiple toggles', () => {
      const store = useUIStore.getState;

      useUIStore.getState().toggleSidebar();
      expect(store().sidebarState).toBe('collapsed');

      useUIStore.getState().toggleSidebar();
      expect(store().sidebarState).toBe('expanded');

      useUIStore.getState().toggleSidebar();
      expect(store().sidebarState).toBe('collapsed');
    });
  });

  describe('setSidebarState', () => {
    it('should set sidebar to collapsed', () => {
      useUIStore.getState().setSidebarState('collapsed');

      expect(useUIStore.getState().sidebarState).toBe('collapsed');
    });

    it('should set sidebar to expanded', () => {
      useUIStore.getState().setSidebarState('collapsed');
      useUIStore.getState().setSidebarState('expanded');

      expect(useUIStore.getState().sidebarState).toBe('expanded');
    });
  });

  describe('openCommandPalette', () => {
    it('should open the command palette', () => {
      useUIStore.getState().openCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });

    it('should remain open if already open', () => {
      useUIStore.getState().openCommandPalette();
      useUIStore.getState().openCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });
  });

  describe('closeCommandPalette', () => {
    it('should close the command palette', () => {
      useUIStore.getState().openCommandPalette();
      useUIStore.getState().closeCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });

    it('should remain closed if already closed', () => {
      useUIStore.getState().closeCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });
  });

  describe('toggleCommandPalette', () => {
    it('should open when closed', () => {
      useUIStore.getState().toggleCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(true);
    });

    it('should close when open', () => {
      useUIStore.getState().openCommandPalette();
      useUIStore.getState().toggleCommandPalette();

      expect(useUIStore.getState().commandPaletteOpen).toBe(false);
    });

    it('should alternate on repeated toggles', () => {
      const store = useUIStore.getState;

      useUIStore.getState().toggleCommandPalette();
      expect(store().commandPaletteOpen).toBe(true);

      useUIStore.getState().toggleCommandPalette();
      expect(store().commandPaletteOpen).toBe(false);

      useUIStore.getState().toggleCommandPalette();
      expect(store().commandPaletteOpen).toBe(true);
    });
  });
});
