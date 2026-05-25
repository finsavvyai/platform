import type { DeviceConfig } from './types.js';

export const DESKTOP_PRESETS: Record<string, DeviceConfig> = {
  'desktop-fullhd': {
    name: 'Desktop Full HD',
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
  },
  'desktop-hd': {
    name: 'Desktop HD',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
  },
  'desktop-wxga': {
    name: 'Desktop WXGA',
    viewport: { width: 1366, height: 768 },
    isMobile: false,
  },
  'desktop-4k': {
    name: 'Desktop 4K',
    viewport: { width: 3840, height: 2160 },
    isMobile: false,
  },
};

export const TABLET_PRESETS: Record<string, DeviceConfig> = {
  'tablet-ipad': {
    name: 'iPad (5th Gen)',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'tablet-ipad-pro': {
    name: 'iPad Pro',
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  'tablet-samsung': {
    name: 'Samsung Galaxy Tab S7',
    userAgent:
      'Mozilla/5.0 (Linux; Android 11; SM-T875) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

export const MOBILE_PRESETS: Record<string, DeviceConfig> = {
  'mobile-iphone15': {
    name: 'iPhone 15',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'mobile-iphone14pro': {
    name: 'iPhone 14 Pro',
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'mobile-pixel8': {
    name: 'Google Pixel 8',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  },
  'mobile-galaxys24': {
    name: 'Samsung Galaxy S24',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
  'mobile-galaxya50': {
    name: 'Samsung Galaxy A50',
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; SM-A505F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
};

export class DevicePresets {
  static getDesktopPresets(): DeviceConfig[] {
    return Object.values(DESKTOP_PRESETS);
  }

  static getTabletPresets(): DeviceConfig[] {
    return Object.values(TABLET_PRESETS);
  }

  static getMobilePresets(): DeviceConfig[] {
    return Object.values(MOBILE_PRESETS);
  }

  static getAllPresets(): Record<string, DeviceConfig> {
    return {
      ...DESKTOP_PRESETS,
      ...TABLET_PRESETS,
      ...MOBILE_PRESETS,
    };
  }

  static getPreset(name: string): DeviceConfig | undefined {
    const presets = this.getAllPresets();
    return presets[name];
  }

  static getPresetNames(): string[] {
    return Object.keys(this.getAllPresets());
  }
}
