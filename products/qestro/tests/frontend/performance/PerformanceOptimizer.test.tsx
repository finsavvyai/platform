/**
 * Performance Optimizer Tests
 * Comprehensive test suite for performance optimization utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, render, screen, waitFor } from '@testing-library/react';
import { fireEvent, userEvent } from '@testing-library/user-event';
import React from 'react';

// Mock performance API
Object.defineProperty(global, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    memory: {
      usedJSHeapSize: 50 * 1024 * 1024,
      totalJSHeapSize: 100 * 1024 * 1024,
      jsHeapSizeLimit: 2048 * 1024 * 1024,
    },
  },
  writable: true,
});

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
})) as any;

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as any;

// Mock requestIdleCallback
global.requestIdleCallback = vi.fn((callback) => {
  setTimeout(callback, 0);
  return 1;
}) as any;

// Mock cancelIdleCallback
global.cancelIdleCallback = vi.fn() as any;

// Mock fetch
global.fetch = vi.fn() as any;

// Import utilities after mocking
import {
  EnhancedPerformanceMonitor,
  AdvancedVirtualScroll,
  OptimizedImage,
  ResourcePreloader,
  withPerformanceTracking,
  useEnhancedPerformanceMonitor,
  useSmartMemo,
  useDeferredValueWithTimeout,
} from '../../../frontend/src/utils/PerformanceOptimizer';

import {
  useDebouncedCallback,
  useThrottledCallback,
  useIntersectionObserver,
  useResizeObserver,
  useMediaQuery,
  useIdleCallback,
  usePerformanceState,
  useResourceLoader,
  useInteractionPerformance,
  useMemoryManagement,
} from '../../../frontend/src/hooks/usePerformanceOptimizations';

import PerformanceConfigManager, {
  usePerformanceConfig,
  defaultPerformanceConfig
} from '../../../frontend/src/config/performanceConfig';

describe('EnhancedPerformanceMonitor', () => {
  let monitor: EnhancedPerformanceMonitor;

  beforeEach(() => {
    monitor = EnhancedPerformanceMonitor.getInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = EnhancedPerformanceMonitor.getInstance();
      const instance2 = EnhancedPerformanceMonitor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Monitoring Lifecycle', () => {
    it('should start and stop monitoring', () => {
      expect(monitor.getMetrics().componentCount).toBe(0);

      monitor.startMonitoring();
      expect(monitor.getMetrics()).toBeDefined();

      monitor.stopMonitoring();
      expect(monitor.getMetrics()).toBeDefined();
    });

    it('should not start monitoring if already running', () => {
      monitor.startMonitoring();
      const metrics1 = monitor.getMetrics();

      monitor.startMonitoring();
      const metrics2 = monitor.getMetrics();

      expect(metrics1).toEqual(metrics2);
    });
  });

  describe('Component Tracking', () => {
    it('should track component renders', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('TestComponent', 10, 5);
      const metrics = monitor.getMetrics();

      expect(metrics.componentRenders).toHaveLength(1);
      expect(metrics.componentRenders[0].componentName).toBe('TestComponent');
      expect(metrics.componentRenders[0].renderTime).toBe(10);
      expect(metrics.componentRenders[0].propsCount).toBe(5);
      expect(metrics.componentRenders[0].renderCount).toBe(1);
    });

    it('should track multiple renders of the same component', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('TestComponent', 10);
      monitor.trackComponentRender('TestComponent', 15);

      const metrics = monitor.getMetrics();
      const component = metrics.componentRenders.find(c => c.componentName === 'TestComponent');

      expect(component).toBeDefined();
      expect(component!.renderCount).toBe(2);
      expect(component!.renderTime).toBe(25);
    });

    it('should mark expensive components correctly', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('FastComponent', 5);
      monitor.trackComponentRender('SlowComponent', 20);

      const metrics = monitor.getMetrics();
      const fastComponent = metrics.componentRenders.find(c => c.componentName === 'FastComponent');
      const slowComponent = metrics.componentRenders.find(c => c.componentName === 'SlowComponent');

      expect(fastComponent!.isExpensive).toBe(false);
      expect(slowComponent!.isExpensive).toBe(true);
    });

    it('should track state changes', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('TestComponent', 10);
      monitor.trackStateChange('TestComponent');

      const metrics = monitor.getMetrics();
      const component = metrics.componentRenders.find(c => c.componentName === 'TestComponent');

      expect(component!.stateChanges).toBe(1);
    });
  });

  describe('Performance Scoring', () => {
    it('should calculate performance score correctly', () => {
      monitor.startMonitoring();

      // Good performance scenario
      monitor.trackComponentRender('FastComponent', 5);
      const score1 = monitor.getPerformanceScore();
      expect(score1).toBeGreaterThan(80);

      // Poor performance scenario
      monitor.trackComponentRender('SlowComponent', 50);
      const score2 = monitor.getPerformanceScore();
      expect(score2).toBeLessThan(score1);
    });
  });

  describe('Performance Report', () => {
    it('should generate performance report', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('TestComponent', 10);
      const report = monitor.getPerformanceReport();

      expect(report).toContain('Performance Analysis Report');
      expect(report).toContain('Overall Score');
      expect(report).toContain('TestComponent');
    });

    it('should include recommendations for poor performance', () => {
      monitor.startMonitoring();

      monitor.trackComponentRender('SlowComponent', 50);
      const report = monitor.getPerformanceReport();

      expect(report).toContain('expensive component');
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe and unsubscribe to metrics updates', () => {
      const callback = vi.fn();
      monitor.startMonitoring();

      const unsubscribe = monitor.subscribe(callback);

      monitor.trackComponentRender('TestComponent', 10);
      expect(callback).toHaveBeenCalledWith(monitor.getMetrics());

      unsubscribe();
      monitor.trackComponentRender('AnotherComponent', 10);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});

describe('AdvancedVirtualScroll', () => {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 10,
  }));

  it('should render virtual list correctly', () => {
    const renderItem = vi.fn((item, index, isVisible) => (
      <div data-testid={`item-${item.id}`}>{item.name}</div>
    ));

    render(
      <AdvancedVirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={renderItem}
      />
    );

    // Should only render visible items + overscan
    expect(renderItem).toHaveBeenCalledTimes(Math.ceil(400 / 50) + 10); // 400/50 = 8 + 5 overscan * 2
  });

  it('should handle dynamic item heights', () => {
    const estimateItemHeight = vi.fn(() => 50);
    const renderItem = vi.fn((item, index, isVisible) => (
      <div data-testid={`item-${item.id}`}>{item.name}</div>
    ));

    render(
      <AdvancedVirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={renderItem}
        estimateItemHeight={estimateItemHeight}
      />
    );

    expect(estimateItemHeight).toHaveBeenCalled();
  });

  it('should call onScroll callback', async () => {
    const onScroll = vi.fn();
    const renderItem = (item: any, index: number, isVisible: boolean) => (
      <div data-testid={`item-${item.id}`}>{item.name}</div>
    );

    render(
      <AdvancedVirtualScroll
        items={items}
        itemHeight={50}
        containerHeight={400}
        renderItem={renderItem}
        onScroll={onScroll}
      />
    );

    const container = screen.getByRole('list');
    fireEvent.scroll(container, { target: { scrollTop: 100 } });

    expect(onScroll).toHaveBeenCalledWith(100, expect.any(Array));
  });
});

describe('OptimizedImage', () => {
  const mockSrc = 'https://example.com/image.jpg';
  const mockWebpSrc = 'https://example.com/image.webp';
  const mockPlaceholder = 'https://example.com/placeholder.jpg';

  beforeEach(() => {
    // Mock canvas for WebP detection
    Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
      value: vi.fn(() => 'data:image/webp;base64,test'),
    });
  });

  it('should render placeholder initially', () => {
    render(
      <OptimizedImage
        src={mockSrc}
        alt="Test image"
        placeholderSrc={mockPlaceholder}
      />
    );

    const placeholder = screen.getByAltText('');
    expect(placeholder).toBeInTheDocument();
    expect(placeholder).toHaveAttribute('src', mockPlaceholder);
  });

  it('should detect WebP support', () => {
    render(
      <OptimizedImage
        src={mockSrc}
        webpSrc={mockWebpSrc}
        alt="Test image"
      />
    );

    // WebP detection should be attempted
    expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalled();
  });

  it('should handle load event', async () => {
    render(
      <OptimizedImage
        src={mockSrc}
        alt="Test image"
      />
    );

    const img = screen.getByAltText('Test image');
    fireEvent.load(img);

    await waitFor(() => {
      expect(img).toHaveStyle('opacity: 1');
    });
  });

  it('should handle error event and fallback', async () => {
    render(
      <OptimizedImage
        src={mockSrc}
        webpSrc={mockWebpSrc}
        alt="Test image"
      />
    );

    const img = screen.getByAltText('Test image');
    fireEvent.error(img);

    await waitFor(() => {
      // Should try original source as fallback
      expect(img).toHaveAttribute('src', mockSrc);
    });
  });

  it('should show error state on ultimate failure', async () => {
    render(
      <OptimizedImage
        src="invalid-url"
        alt="Test image"
      />
    );

    const img = screen.getByAltText('Test image');
    fireEvent.error(img);

    await waitFor(() => {
      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });
  });
});

describe('ResourcePreloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should preload images', async () => {
    const imgSrc = 'https://example.com/image.jpg';

    // Mock Image constructor
    global.Image = vi.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
    })) as any;

    await ResourcePreloader.preloadImage(imgSrc);

    expect(global.Image).toHaveBeenCalled();
  });

  it('should preload scripts', async () => {
    const scriptSrc = 'https://example.com/script.js';

    // Mock link element
    const mockLink = {
      rel: '',
      as: '',
      href: '',
      onload: null,
      onerror: null,
    };

    global.document.createElement = vi.fn().mockReturnValue(mockLink);
    global.document.head.appendChild = vi.fn();

    await ResourcePreloader.preloadScript(scriptSrc);

    expect(mockLink.rel).toBe('preload');
    expect(mockLink.as).toBe('script');
    expect(mockLink.href).toBe(scriptSrc);
  });

  it('should preload critical resources', async () => {
    const resources = {
      images: ['img1.jpg', 'img2.jpg'],
      scripts: ['script1.js'],
      fonts: [{ url: 'font.woff2', family: 'TestFont' }],
    };

    // Mock all required constructors and methods
    global.Image = vi.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
    })) as any;

    global.document.createElement = vi.fn().mockReturnValue({
      rel: '',
      as: '',
      href: '',
      onload: null,
      onerror: null,
    });

    global.document.head.appendChild = vi.fn();
    global.FontFace = vi.fn().mockImplementation(() => ({
      load: vi.fn().mockResolvedValue(undefined),
    }));

    global.document.fonts = {
      add: vi.fn(),
    };

    const result = await ResourcePreloader.preloadCriticalResources(resources);

    expect(result).toBeDefined();
  });

  it('should not preload already loaded resources', async () => {
    const imgSrc = 'https://example.com/image.jpg';

    global.Image = vi.fn().mockImplementation(() => ({
      onload: null,
      onerror: null,
      src: '',
    })) as any;

    // First preload
    await ResourcePreloader.preloadImage(imgSrc);
    const imageConstructorCalls1 = (global.Image as vi.Mock).mock.calls.length;

    // Second preload (should be skipped)
    await ResourcePreloader.preloadImage(imgSrc);
    const imageConstructorCalls2 = (global.Image as vi.Mock).mock.calls.length;

    expect(imageConstructorCalls2).toBe(imageConstructorCalls1);
  });
});

describe('Performance Hooks', () => {
  describe('useDebouncedCallback', () => {
    it('should debounce callback execution', async () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));

      act(() => {
        result.current('test1');
        result.current('test2');
        result.current('test3');
      });

      // Should not be called immediately
      expect(callback).not.toHaveBeenCalled();

      // Wait for debounce
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test3');
    });

    it('should call callback on cleanup', () => {
      const callback = vi.fn();
      const { result, unmount } = renderHook(() => useDebouncedCallback(callback, 100));

      act(() => {
        result.current('test');
      });

      unmount();

      expect(callback).toHaveBeenCalledWith('test');
    });
  });

  describe('useThrottledCallback', () => {
    it('should throttle callback execution', async () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useThrottledCallback(callback, 100));

      act(() => {
        result.current('test1');
        result.current('test2');
        result.current('test3');
      });

      // Should call immediately for first call
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('test1');

      // Wait for throttle period
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      act(() => {
        result.current('test4');
      });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenLastCalledWith('test4');
    });
  });

  describe('useIntersectionObserver', () => {
    it('should initialize intersection observer', () => {
      const { result } = renderHook(() => useIntersectionObserver());

      expect(result.current.entries).toEqual([]);
      expect(result.current.isIntersecting).toBe(false);
      expect(typeof result.current.observe).toBe('function');
      expect(typeof result.current.unobserve).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
    });

    it('should handle observer callback', () => {
      const mockCallback = vi.fn();
      global.IntersectionObserver = vi.fn().mockImplementation(callback => {
        mockCallback.mockImplementation(callback);
        return {
          observe: vi.fn(),
          unobserve: vi.fn(),
          disconnect: vi.fn(),
        };
      }) as any;

      const { result } = renderHook(() => useIntersectionObserver());

      act(() => {
        mockCallback([{ isIntersecting: true }]);
      });

      expect(result.current.isIntersecting).toBe(true);
    });
  });

  describe('usePerformanceState', () => {
    it('should manage state with performance tracking', () => {
      const { result } = renderHook(() => usePerformanceState(0));

      expect(result.current[0]).toBe(0);

      act(() => {
        result.current[1](5);
      });

      expect(result.current[0]).toBe(5);
    });

    it('should handle batch updates', () => {
      const onStateChange = vi.fn();
      const { result } = renderHook(() =>
        usePerformanceState(0, { batchUpdates: true, onStateChange })
      );

      act(() => {
        result.current[1](10);
      });

      expect(result.current[0]).toBe(10);
      expect(onStateChange).toHaveBeenCalledWith(10, 0);
    });

    it('should handle debounced updates', async () => {
      const { result } = renderHook(() =>
        usePerformanceState(0, { debounceMs: 100 })
      );

      act(() => {
        result.current[1](5);
        result.current[1](10);
      });

      expect(result.current[0]).toBe(0); // Should still be initial value

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      expect(result.current[0]).toBe(10); // Should be updated after debounce
    });
  });

  describe('useResourceLoader', () => {
    it('should initialize with empty states', () => {
      const { result } = renderHook(() => useResourceLoader());

      expect(result.current.loadedResources).toBeInstanceOf(Set);
      expect(result.current.loadingResources).toBeInstanceOf(Set);
      expect(result.current.failedResources).toBeInstanceOf(Set);
      expect(typeof result.current.loadResource).toBe('function');
    });

    it('should load resources successfully', async () => {
      global.Image = vi.fn().mockImplementation(() => ({
        onload: null,
        onerror: null,
        src: '',
      })) as any;

      const { result } = renderHook(() => useResourceLoader());

      await act(async () => {
        await result.current.loadResource('test.jpg', 'image');
      });

      expect(result.current.loadedResources.has('test.jpg')).toBe(true);
      expect(result.current.loadingResources.has('test.jpg')).toBe(false);
    });

    it('should handle resource loading failures', async () => {
      global.Image = vi.fn().mockImplementation(() => {
        const img = {
          onload: null,
          onerror: null,
          src: '',
        };
        setTimeout(() => img.onerror?.({}), 0);
        return img;
      }) as any;

      const { result } = renderHook(() => useResourceLoader());

      await act(async () => {
        await result.current.loadResource('invalid.jpg', 'image');
      });

      expect(result.current.failedResources.has('invalid.jpg')).toBe(true);
    });
  });

  describe('useMemoryManagement', () => {
    it('should track memory usage', () => {
      const { result } = renderHook(() => useMemoryManagement());

      expect(typeof result.current.memoryUsage).toBe('number');
      expect(typeof result.current.memoryPressure).toBe('string');
      expect(typeof result.current.addCleanupCallback).toBe('function');
      expect(typeof result.current.runCleanup).toBe('function');
    });

    it('should add and run cleanup callbacks', () => {
      const cleanup = vi.fn();
      const { result } = renderHook(() => useMemoryManagement());

      act(() => {
        result.current.addCleanupCallback(cleanup);
      });

      act(() => {
        result.current.runCleanup();
      });

      expect(cleanup).toHaveBeenCalled();
    });
  });
});

describe('Performance Configuration', () => {
  let configManager: PerformanceConfigManager;

  beforeEach(() => {
    configManager = PerformanceConfigManager.getInstance();
  });

  describe('Configuration Management', () => {
    it('should load default configuration', () => {
      const config = configManager.getConfig();
      expect(config.enabled).toBe(true);
      expect(config.virtualScrolling).toBe(true);
      expect(config.lazyLoading).toBe(true);
    });

    it('should update configuration', () => {
      const callback = vi.fn();
      configManager.subscribe(callback);

      configManager.updateConfig({
        virtualScrolling: false,
        lazyLoading: false,
      });

      const updatedConfig = configManager.getConfig();
      expect(updatedConfig.virtualScrolling).toBe(false);
      expect(updatedConfig.lazyLoading).toBe(false);
      expect(callback).toHaveBeenCalled();
    });

    it('should validate performance budgets', () => {
      const bundleSize = 500 * 1024; // 500KB
      const result = configManager.validateBudget('bundleSize', bundleSize);
      expect(result).toBe('good');
    });

    it('should validate web vitals', () => {
      const fcp = 1500; // 1.5s
      const result = configManager.validateWebVital('firstContentfulPaint', fcp);
      expect(result).toBe('good');
    });

    it('should export and import configuration', () => {
      const originalConfig = configManager.getConfig();
      const exportedConfig = configManager.exportConfig();

      configManager.updateConfig({ virtualScrolling: false });
      configManager.importConfig(exportedConfig);

      const restoredConfig = configManager.getConfig();
      expect(restoredConfig.virtualScrolling).toBe(originalConfig.virtualScrolling);
    });
  });

  describe('usePerformanceConfig Hook', () => {
    it('should provide configuration', () => {
      const { result } = renderHook(() => usePerformanceConfig());

      expect(result.current.enabled).toBeDefined();
      expect(result.current.virtualScrolling).toBeDefined();
      expect(result.current.lazyLoading).toBeDefined();
    });

    it('should update when configuration changes', async () => {
      const { result, rerender } = renderHook(() => usePerformanceConfig());

      act(() => {
        configManager.updateConfig({ virtualScrolling: false });
      });

      expect(result.current.virtualScrolling).toBe(false);
    });
  });
});

describe('Performance Component HOC', () => {
  it('should wrap component with performance tracking', () => {
    const TestComponent = vi.fn(() => <div>Test</div>);
    const TrackedComponent = withPerformanceTracking(TestComponent, 'TestComponent');

    render(<TrackedComponent prop1="value1" prop2="value2" />);

    expect(TestComponent).toHaveBeenCalledWith(
      { prop1: 'value1', prop2: 'value2' },
      {}
    );
  });

  it('should use component name if not provided', () => {
    const TestComponent = vi.fn(() => <div>Test</div>);
    TestComponent.displayName = 'CustomComponent';
    const TrackedComponent = withPerformanceTracking(TestComponent);

    render(<TrackedComponent />);

    expect(TestComponent).toHaveBeenCalled();
  });
});

describe('Performance Hooks Integration', () => {
  it('should use enhanced performance monitor hook', () => {
    const { result } = renderHook(() => useEnhancedPerformanceMonitor());

    expect(result.current.metrics).toBeDefined();
    expect(typeof result.current.isMonitoring).toBe('boolean');
  });

  it('should use smart memo hook', () => {
    const factory = vi.fn(() => ({ data: 'test' }));
    const { result, rerender } = renderHook(() => useSmartMemo(factory, ['dep1']));

    expect(factory).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ data: 'test' });

    rerender();
    expect(factory).toHaveBeenCalledTimes(1); // Should not re-run

    rerender({ deps: ['dep2'] });
    expect(factory).toHaveBeenCalledTimes(2); // Should re-run
  });

  it('should use deferred value with timeout', async () => {
    const { result, rerender } = renderHook(() =>
      useDeferredValueWithTimeout('initial', 100)
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated' });

    // Should still be initial before timeout
    expect(result.current).toBe('initial');

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(result.current).toBe('updated');
  });
});