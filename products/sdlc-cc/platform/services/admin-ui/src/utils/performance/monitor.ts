// Performance monitoring
export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, unknown>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []

  startTimer(name: string): () => void {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.metrics.push({
        name,
        duration,
        timestamp: Date.now(),
      })
    }
  }

  record(name: string, duration: number, metadata?: Record<string, unknown>): void {
    this.metrics.push({ name, duration, timestamp: Date.now(), metadata })
  }

  recordMetric(name: string, duration: number, metadata?: Record<string, unknown>): void {
    this.record(name, duration, metadata)
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics]
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

export const performanceMonitor = new PerformanceMonitor()
export default performanceMonitor
