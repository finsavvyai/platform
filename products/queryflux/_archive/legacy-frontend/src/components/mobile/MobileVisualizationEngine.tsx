import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Brain, Smartphone, TouchInterface, Eye, Download, Share2, ZoomIn, ZoomOut, RotateCw, Settings, Wifi, WifiOff, Battery, Sun, Moon, Globe, Activity, TrendingUp, BarChart3, PieChart, Navigation, Camera, Mic, MessageSquare, Heart, Star, AlertCircle } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface MobileVisualizationEngineProps {
  data: any[];
  visualizationType: string;
  width?: number;
  height?: number;
  enableRAG?: boolean;
  enableOffline?: boolean;
  enableGestures?: boolean;
  enableAR?: boolean;
  enableTouchOptimization?: boolean;
  enableHapticFeedback?: boolean;
  enableDarkMode?: boolean;
  enableBatteryOptimization?: boolean;
  onVisualizationInteraction?: (interaction: MobileInteraction) => void;
}

interface MobileInteraction {
  type: 'tap' | 'double_tap' | 'pinch' | 'swipe' | 'long_press' | 'rotate' | 'pan';
  position: { x: number, y: number };
  data?: any;
  timestamp: Date;
}

interface TouchGesture {
  type: 'pinch' | 'swipe' | 'rotate' | 'long_press';
  threshold: number;
  detected: boolean;
  data: any;
}

interface OfflineCache {
  id: string;
  data: any;
  timestamp: Date;
  size: number;
  expiresAt: Date;
}

interface MobilePerformanceMetrics {
  fps: number;
  renderTime: number;
  touchLatency: number;
  batteryUsage: number;
  memoryUsage: number;
  networkStatus: 'online' | 'offline' | 'slow';
}

interface ARMarker {
  id: string;
  position: { x: number, y: number, z: number };
  content: any;
  visible: boolean;
  tracking: boolean;
}

export function MobileVisualizationEngine({
  data,
  visualizationType,
  width = 375,
  height = 667,
  enableRAG = true,
  enableOffline = true,
  enableGestures = true,
  enableAR = true,
  enableTouchOptimization = true,
  enableHapticFeedback = true,
  enableDarkMode = true,
  enableBatteryOptimization = true,
  onVisualizationInteraction
}: MobileVisualizationEngineProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isOffline, setIsOffline] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(100);
  const [isCharging, setIsCharging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [touchPoints, setTouchPoints] = useState<Touch[]>([]);
  const [gestures, setGestures] = useState<TouchGesture[]>([]);
  const [arMarkers, setArMarkers] = useState<ARMarker[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<MobilePerformanceMetrics>({
    fps: 60,
    renderTime: 16,
    touchLatency: 50,
    batteryUsage: 0,
    memoryUsage: 0,
    networkStatus: 'online'
  });
  const [offlineCache, setOfflineCache] = useState<OfflineCache[]>([]);
  const [mobileInsights, setMobileInsights] = useState<any[]>([]);
  const [touchOptimizations, setTouchOptimizations] = useState({
    hitboxExpansion: 20,
    touchDelay: 100,
    hapticFeedback: true,
    visualFeedback: true
  });

  // Initialize mobile features
  useEffect(() => {
    initializeMobileFeatures();
    setupBatteryMonitoring();
    setupNetworkMonitoring();
    setupGestureRecognition();

    return () => {
      cleanupMobileFeatures();
    };
  }, []);

  // Handle mobile-specific features
  useEffect(() => {
    if (enableOffline) {
      cacheDataForOffline(data);
    }
  }, [data, enableOffline]);

  // Performance monitoring
  useEffect(() => {
    const frameInterval = setInterval(() => {
      updatePerformanceMetrics();
    }, 1000);

    return () => clearInterval(frameInterval);
  }, []);

  // Initialize mobile features
  const initializeMobileFeatures = useCallback(() => {
    // Check for touch support
    if ('ontouchstart' in window) {
      console.log('Touch device detected');
    }

    // Check for battery API
    if ('getBattery' in navigator) {
      navigator.getBattery().then((battery: any) => {
        setBatteryLevel(battery.level * 100);
        setIsCharging(battery.charging);

        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level * 100);
        });

        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      });
    }

    // Check for network status
    setIsOffline(!navigator.onLine);

    // Check for dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Setup battery monitoring
  const setupBatteryMonitoring = useCallback(() => {
    if (!enableBatteryOptimization) return;

    // Optimize performance based on battery level
    if (batteryLevel < 20 && !isCharging) {
      // Enable power saving mode
      setTouchOptimizations(prev => ({
        ...prev,
        touchDelay: 200,
        hapticFeedback: false,
        visualFeedback: true
      }));
    } else if (batteryLevel > 50) {
      // Full performance mode
      setTouchOptimizations(prev => ({
        ...prev,
        touchDelay: 100,
        hapticFeedback: true,
        visualFeedback: true
      }));
    }
  }, [batteryLevel, isCharging, enableBatteryOptimization]);

  // Setup network monitoring
  const setupNetworkMonitoring = useCallback(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setPerformanceMetrics(prev => ({ ...prev, networkStatus: 'online' }));
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOffline(true);
      setPerformanceMetrics(prev => ({ ...prev, networkStatus: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Setup gesture recognition
  const setupGestureRecognition = useCallback(() => {
    if (!enableGestures) return;

    const gesturePatterns: TouchGesture[] = [
      { type: 'pinch', threshold: 20, detected: false, data: { scale: 1 } },
      { type: 'swipe', threshold: 50, detected: false, data: { direction: 'horizontal' } },
      { type: 'rotate', threshold: 15, detected: false, data: { angle: 0 } },
      { type: 'long_press', threshold: 500, detected: false, data: { duration: 0 } }
    ];

    setGestures(gesturePatterns);
  }, [enableGestures]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    setTouchPoints(Array.from(touches));

    if (touches.length === 1) {
      // Single touch - drag or tap
      const touch = touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });

      // Start long press timer
      setTimeout(() => {
        if (isDragging) {
          detectGesture('long_press', touch);
        }
      }, 500);
    } else if (touches.length === 2) {
      // Multi-touch - pinch or rotate
      detectMultiTouchGesture(touches);
    }

    // Haptic feedback
    if (enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
  }, [isDragging, enableHapticFeedback]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    setTouchPoints(Array.from(touches));

    if (touches.length === 1 && isDragging) {
      const touch = touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;

      setPanOffset(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setDragStart({ x: touch.clientX, y: touch.clientY });
    } else if (touches.length === 2) {
      // Continue pinch/rotate detection
      detectMultiTouchGesture(touches);
    }
  }, [isDragging, dragStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touches = e.changedTouches;

    if (touches.length === 0) {
      setIsDragging(false);

      // Detect final gesture
      const finalTouch = e.changedTouches[0];
      if (finalTouch) {
        const deltaX = Math.abs(finalTouch.clientX - dragStart.x);
        const deltaY = Math.abs(finalTouch.clientY - dragStart.y);

        if (deltaX > 50 || deltaY > 50) {
          detectGesture('swipe', finalTouch);
        } else {
          detectGesture('tap', finalTouch);
        }
      }
    }

    setTouchPoints([]);
  }, [dragStart]);

  // Gesture detection
  const detectGesture = useCallback((gestureType: string, touch: Touch) => {
    const gesture: MobileInteraction = {
      type: gestureType as any,
      position: { x: touch.clientX, y: touch.clientY },
      timestamp: new Date()
    };

    onVisualizationInteraction?.(gesture);

    // Apply gesture effects
    switch (gestureType) {
      case 'tap':
        handleTapInteraction(gesture);
        break;
      case 'swipe':
        handleSwipeInteraction(gesture);
        break;
      case 'long_press':
        handleLongPressInteraction(gesture);
        break;
    }

    // Visual feedback
    if (touchOptimizations.visualFeedback) {
      showTouchFeedback(touch.clientX, touch.clientY);
    }
  }, [onVisualizationInteraction, touchOptimizations.visualFeedback]);

  const detectMultiTouchGesture = useCallback((touches: TouchList) => {
    if (touches.length !== 2) return;

    const touch1 = touches[0];
    const touch2 = touches[1];

    // Calculate distance for pinch
    const distance = Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );

    // Calculate angle for rotation
    const angle = Math.atan2(
      touch2.clientY - touch1.clientY,
      touch2.clientX - touch1.clientX
    );

    // Detect pinch gesture
    if (distance > 50) {
      const newZoom = Math.max(0.5, Math.min(3, zoom * (distance / 200)));
      setZoom(newZoom);

      if (enableHapticFeedback && 'vibrate' in navigator) {
        navigator.vibrate(20);
      }
    }

    // Detect rotation gesture
    const rotationDelta = angle * (180 / Math.PI);
    setRotation(prev => prev + rotationDelta);
  }, [zoom, enableHapticFeedback]);

  // Interaction handlers
  const handleTapInteraction = useCallback((interaction: MobileInteraction) => {
    // Handle tap on visualization elements
    console.log('Tap interaction:', interaction.position);
  }, []);

  const handleSwipeInteraction = useCallback((interaction: MobileInteraction) => {
    // Handle swipe gestures for navigation
    const deltaX = interaction.position.x - dragStart.x;
    const deltaY = interaction.position.y - dragStart.y;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe - navigate charts
      if (deltaX > 50) {
        // Swipe right - previous chart
        navigateChart('previous');
      } else {
        // Swipe left - next chart
        navigateChart('next');
      }
    } else {
      // Vertical swipe - scroll or zoom
      if (deltaY > 50) {
        // Swipe down - zoom out
        setZoom(prev => Math.max(0.5, prev - 0.1));
      } else {
        // Swipe up - zoom in
        setZoom(prev => Math.min(3, prev + 0.1));
      }
    }
  }, [dragStart]);

  const handleLongPressInteraction = useCallback((interaction: MobileInteraction) => {
    // Handle long press for context menu or details
    showContextMenu(interaction.position);
  }, []);

  // Navigation
  const navigateChart = useCallback((direction: 'previous' | 'next') => {
    // Navigate between different chart types
    const chartTypes = ['bar', 'line', 'pie', 'scatter', 'heatmap'];
    const currentIndex = chartTypes.indexOf(visualizationType);

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % chartTypes.length;
    } else {
      nextIndex = currentIndex === 0 ? chartTypes.length - 1 : currentIndex - 1;
    }

    // Would trigger chart type change
    console.log(`Navigate to ${chartTypes[nextIndex]} chart`);
  }, [visualizationType]);

  // Visual feedback
  const showTouchFeedback = useCallback((x: number, y: number) => {
    // Create ripple effect at touch position
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${theme.colors.accent}40;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: ripple 0.6s ease-out;
    `;

    document.body.appendChild(ripple);

    setTimeout(() => {
      document.body.removeChild(ripple);
    }, 600);
  }, [theme.colors.accent]);

  const showContextMenu = useCallback((position: { x: number, y: number }) => {
    // Show context menu at touch position
    console.log('Show context menu at:', position);
  }, []);

  // Offline functionality
  const cacheDataForOffline = useCallback((data: any[]) => {
    if (!enableOffline) return;

    const cacheItem: OfflineCache = {
      id: `cache-${Date.now()}`,
      data: data,
      timestamp: new Date(),
      size: JSON.stringify(data).length,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    setOfflineCache(prev => [...prev.slice(-9), cacheItem]);

    // Store in localStorage for persistence
    try {
      localStorage.setItem('queryflux-offline-cache', JSON.stringify(offlineCache));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }, [enableOffline]);

  const syncOfflineData = useCallback(() => {
    // Sync cached data when back online
    console.log('Syncing offline data...');
  }, []);

  // AR functionality
  const initializeAR = useCallback(() => {
    if (!enableAR) return;

    // Initialize AR markers
    const markers: ARMarker[] = [
      {
        id: 'marker-1',
        position: { x: 0, y: 0, z: 0 },
        content: { type: 'chart', data: data.slice(0, 5) },
        visible: false,
        tracking: false
      },
      {
        id: 'marker-2',
        position: { x: 1, y: 0, z: 0 },
        content: { type: 'insight', data: 'Key performance indicators' },
        visible: false,
        tracking: false
      }
    ];

    setArMarkers(markers);
  }, [enableAR, data]);

  // Performance monitoring
  const updatePerformanceMetrics = useCallback(() => {
    const now = performance.now();
    const metrics = {
      fps: 60, // Would calculate actual FPS
      renderTime: now - (performance.timing.navigationStart || 0),
      touchLatency: 50, // Would measure actual touch latency
      batteryUsage: isCharging ? 0 : (100 - batteryLevel) * 0.5,
      memoryUsage: 0, // Would get from performance.memory
      networkStatus: isOffline ? 'offline' : navigator.onLine ? 'online' : 'slow'
    };

    setPerformanceMetrics(metrics);
  }, [batteryLevel, isCharging, isOffline]);

  // Cleanup
  const cleanupMobileFeatures = useCallback(() => {
    // Cleanup event listeners and resources
  }, []);

  // Render mobile-optimized visualization
  const renderMobileVisualization = useCallback(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Apply transformations
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(zoom, zoom);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-width / 2, -height / 2);
    ctx.translate(panOffset.x, panOffset.y);

    // Render visualization based on type
    switch (visualizationType) {
      case 'bar':
        renderMobileBarChart(ctx, data, width, height);
        break;
      case 'line':
        renderMobileLineChart(ctx, data, width, height);
        break;
      case 'pie':
        renderMobilePieChart(ctx, data, width, height);
        break;
      default:
        renderMobileBarChart(ctx, data, width, height);
    }

    ctx.restore();

    // Render mobile overlays
    renderMobileOverlays(ctx);
  }, [data, visualizationType, width, height, zoom, rotation, panOffset]);

  const renderMobileBarChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    // Mobile-optimized bar dimensions
    const barWidth = Math.min(chartWidth / data.length * 0.7, 40);
    const barSpacing = (chartWidth - barWidth * data.length) / (data.length - 1);

    const maxValue = Math.max(...data.map(d => d.value || 0));
    const scale = chartHeight / maxValue;

    // Draw bars with mobile optimizations
    data.forEach((item, index) => {
      const value = item.value || 0;
      const barHeight = value * scale;
      const x = padding + index * (barWidth + barSpacing);
      const y = height - padding - barHeight;

      // Touch-optimized hitbox expansion
      const hitboxHeight = Math.max(barHeight, 44); // Minimum touch target

      // Gradient fill for mobile
      const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
      gradient.addColorStop(0, theme.colors.accent);
      gradient.addColorStop(1, adjustColor(theme.colors.accent, -20));

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y - hitboxHeight + barHeight, barWidth, hitboxHeight);

      // Rounded corners for modern look
      ctx.beginPath();
      ctx.roundRect(x, y - hitboxHeight + barHeight, barWidth, hitboxHeight, 4);
      ctx.fill();

      // Touch-friendly value labels
      ctx.fillStyle = theme.colors.text;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(value.toString(), x + barWidth / 2, y - 10);

      // Category labels
      ctx.font = '12px sans-serif';
      ctx.fillText(item.label || `Item ${index + 1}`, x + barWidth / 2, height - padding + 20);
    });

    // Mobile-optimized axes
    ctx.strokeStyle = theme.colors.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();
  };

  const renderMobileLineChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxValue = Math.max(...data.map(d => d.value || 0));
    const scale = chartHeight / maxValue;
    const xStep = chartWidth / (data.length - 1);

    // Draw area with gradient
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);

    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        // Smooth curve for mobile
        const prevX = padding + (index - 1) * xStep;
        const prevY = height - padding - ((data[index - 1].value || 0) * scale);
        const cp1x = prevX + xStep / 3;
        const cp1y = prevY;
        const cp2x = x - xStep / 3;
        const cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    });

    ctx.lineTo(padding + (data.length - 1) * xStep, height - padding);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, `${theme.colors.accent}60`);
    gradient.addColorStop(1, `${theme.colors.accent}20`);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = theme.colors.accent;
    ctx.lineWidth = 4; // Thicker for touch
    ctx.lineCap = 'round';

    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        const prevX = padding + (index - 1) * xStep;
        const prevY = height - padding - ((data[index - 1].value || 0) * scale);
        const cp1x = prevX + xStep / 3;
        const cp1y = prevY;
        const cp2x = x - xStep / 3;
        const cp2y = y;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
      }
    });

    ctx.stroke();

    // Draw touch-optimized data points
    data.forEach((item, index) => {
      const value = item.value || 0;
      const x = padding + index * xStep;
      const y = height - padding - (value * scale);

      // Larger touch targets
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fillStyle = theme.colors.accent;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  };

  const renderMobilePieChart = (ctx: CanvasRenderingContext2D, data: any[], width: number, height: number) => {
    if (!data || data.length === 0) return;

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;

    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    let currentAngle = -Math.PI / 2;

    const colors = [
      theme.colors.accent,
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6'
    ];

    data.forEach((item, index) => {
      const value = item.value || 0;
      const percentage = value / total;
      const angle = percentage * Math.PI * 2;

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
      ctx.closePath();

      const color = colors[index % colors.length];
      ctx.fillStyle = color;
      ctx.fill();

      // Border for better visibility
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Percentage label
      const labelAngle = currentAngle + angle / 2;
      const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
      const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${(percentage * 100).toFixed(0)}%`, labelX, labelY);

      currentAngle += angle;
    });
  };

  const renderMobileOverlays = (ctx: CanvasRenderingContext2D) => {
    // Render mobile-specific overlays
    if (isOffline) {
      // Offline indicator
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(0, 0, width, 30);
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Offline Mode', width / 2, 20);
    }

    // Battery indicator
    if (batteryLevel < 20 && !isCharging) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(width - 60, 10, 50, 20);
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${batteryLevel}%`, width - 15, 25);
    }

    // Touch indicators
    if (touchPoints.length > 0) {
      touchPoints.forEach(touch => {
        ctx.beginPath();
        ctx.arc(touch.clientX, touch.clientY, 20, 0, Math.PI * 2);
        ctx.strokeStyle = theme.colors.accent;
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  };

  // Helper functions
  function adjustColor(color: string, amount: number): string {
    // Simplified color adjustment
    return color;
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full glass-card rounded-2xl overflow-hidden"
      style={{ backgroundColor: theme.colors.foreground }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Mobile Status Bar */}
      <div className="flex items-center justify-between p-2 text-xs" style={{
        backgroundColor: isDarkMode ? '#000' : '#fff',
        color: isDarkMode ? '#fff' : '#000',
        borderBottom: `1px solid ${theme.colors.border}`
      }}>
        <div className="flex items-center gap-2">
          {isOffline ? (
            <WifiOff className="w-3 h-3" style={{ color: '#ef4444' }} />
          ) : (
            <Wifi className="w-3 h-3" style={{ color: '#10b981' }} />
          )}
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div className="flex items-center gap-2">
          {isCharging ? (
            <Battery className="w-3 h-3" style={{ color: '#10b981' }} />
          ) : (
            <Battery className="w-3 h-3" style={{
              color: batteryLevel < 20 ? '#ef4444' : batteryLevel < 50 ? '#f59e0b' : '#10b981'
            }} />
          )}
          <span>{Math.round(batteryLevel)}%</span>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-1"
          >
            {isDarkMode ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Main Visualization */}
      <div className="relative" style={{ height: 'calc(100% - 80px)' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ touchAction: 'none' }} // Prevent default touch behaviors
        />

        {/* Mobile Controls Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          {/* Zoom Controls */}
          <div className="flex gap-2">
            <button
              onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
              className="p-2 rounded-full glass-morphism"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
              className="p-2 rounded-full glass-morphism"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {enableAR && (
              <button
                onClick={() => {/* Initialize AR */}}
                className="p-2 rounded-full glass-morphism"
                style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {/* Share functionality */}}
              className="p-2 rounded-full glass-morphism"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => {/* Download functionality */}}
              className="p-2 rounded-full glass-morphism"
              style={{ backgroundColor: theme.colors.background, color: theme.colors.text }}
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Gesture Hints */}
        {enableGestures && (
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex justify-center gap-4 text-xs" style={{ color: theme.colors.textSecondary }}>
              <div className="flex items-center gap-1">
                <TouchInterface className="w-3 h-3" />
                <span>Pinch to zoom</span>
              </div>
              <div className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                <span>Swipe to navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <RotateCw className="w-3 h-3" />
                <span>Long press for options</span>
              </div>
            </div>
          </div>
        )}

        {/* Performance Metrics Overlay (Debug) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-4 right-4 p-2 rounded text-xs font-mono" style={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#00ff00'
          }}>
            <div>FPS: {performanceMetrics.fps}</div>
            <div>Touch: {performanceMetrics.touchLatency}ms</div>
            <div>Battery: {performanceMetrics.batteryUsage.toFixed(1)}%</div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Toolbar */}
      <div className="flex items-center justify-around p-3 border-t" style={{ borderColor: theme.colors.border }}>
        <button className="flex flex-col items-center gap-1 p-2">
          <Activity className="w-5 h-5" style={{ color: theme.colors.accent }} />
          <span className="text-xs" style={{ color: theme.colors.text }}>Analyze</span>
        </button>

        <button className="flex flex-col items-center gap-1 p-2">
          <TrendingUp className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>Trends</span>
        </button>

        <button className="flex flex-col items-center gap-1 p-2">
          <BarChart3 className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>Charts</span>
        </button>

        <button className="flex flex-col items-center gap-1 p-2">
          <MessageSquare className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>Insights</span>
        </button>

        <button className="flex flex-col items-center gap-1 p-2">
          <Settings className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          <span className="text-xs" style={{ color: theme.colors.textSecondary }}>Settings</span>
        </button>
      </div>

      {/* Global Styles for Animations */}
      <style jsx>{`
        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(4);
            opacity: 0;
          }
        }

        .touch-ripple {
          animation: ripple 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
