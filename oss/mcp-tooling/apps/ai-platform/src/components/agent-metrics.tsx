'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Activity, Zap, Cpu, TrendingUp } from 'lucide-react'

interface MetricData {
  time: string
  agents: number
  requests: number
  latency: number
  errors: number
}

export function AgentMetrics() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedMetric, setSelectedMetric] = useState<'agents' | 'requests' | 'latency' | 'errors'>('agents')

  useEffect(() => {
    if (!containerRef.current) return

    // Generate sample data
    const now = new Date()
    const data: MetricData[] = Array.from({ length: 24 }, (_, i) => ({
      time: new Date(now.getTime() - (23 - i) * 3600000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      agents: Math.floor(Math.random() * 50) + 100,
      requests: Math.floor(Math.random() * 1000) + 2000,
      latency: Math.random() * 50 + 20,
      errors: Math.floor(Math.random() * 10)
    }))

    // Clear previous chart
    d3.select(containerRef.current).selectAll('*').remove()

    const margin = { top: 20, right: 30, bottom: 40, left: 50 }
    const width = containerRef.current.offsetWidth - margin.left - margin.right
    const height = 250 - margin.top - margin.bottom

    // Create SVG
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Scales
    const xScale = d3
      .scaleTime()
      .domain([
        new Date(now.getTime() - 23 * 3600000),
        new Date(now.getTime())
      ])
      .range([0, width])

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, d => {
        switch (selectedMetric) {
          case 'agents': return d.agents
          case 'requests': return d.requests / 100
          case 'latency': return d.latency
          case 'errors': return d.errors
          default: return 0
        }
      }) || 0])
      .range([height, 0])

    // Line generator
    const line = d3
      .line<MetricData>()
      .x(d => xScale(new Date(d.time)))
      .y(d => {
        switch (selectedMetric) {
          case 'agents': return yScale(d.agents)
          case 'requests': return yScale(d.requests / 100)
          case 'latency': return yScale(d.latency)
          case 'errors': return yScale(d.errors)
          default: return 0
        }
      })
      .curve(d3.curveMonotoneX)

    // Area generator
    const area = d3
      .area<MetricData>()
      .x(d => xScale(new Date(d.time)))
      .y0(height)
      .y1(d => {
        switch (selectedMetric) {
          case 'agents': return yScale(d.agents)
          case 'requests': return yScale(d.requests / 100)
          case 'latency': return yScale(d.latency)
          case 'errors': return yScale(d.errors)
          default: return 0
        }
      })
      .curve(d3.curveMonotoneX)

    // Add gradient
    const gradient = svg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%')

    gradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#9333ea')
      .attr('stop-opacity', 0.6)

    gradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#9333ea')
      .attr('stop-opacity', 0.1)

    // Add area
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'url(#gradient)')
      .attr('d', area)

    // Add line
    svg
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#9333ea')
      .attr('stroke-width', 3)
      .attr('d', line)

    // Add dots
    svg
      .selectAll('.dot')
      .data(data.filter((d, i) => i % 3 === 0)) // Show every 3rd dot
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(new Date(d.time)))
      .attr('cy', d => {
        switch (selectedMetric) {
          case 'agents': return yScale(d.agents)
          case 'requests': return yScale(d.requests / 100)
          case 'latency': return yScale(d.latency)
          case 'errors': return yScale(d.errors)
          default: return 0
        }
      })
      .attr('r', 4)
      .attr('fill', '#9333ea')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .on('mouseover', function(event, d) {
        d3.select(this).transition().duration(200).attr('r', 6)

        // Add tooltip
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.8)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '4px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)

        tooltip.transition().duration(200).style('opacity', 1)

        let value = ''
        switch (selectedMetric) {
          case 'agents': value = `${d.agents} agents`; break
          case 'requests': value = `${d.requests} requests`; break
          case 'latency': value = `${d.latency.toFixed(1)}ms`; break
          case 'errors': value = `${d.errors} errors`; break
        }

        tooltip
          .html(`${d.time}<br/>${value}`)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
      })
      .on('mouseout', function() {
        d3.select(this).transition().duration(200).attr('r', 4)
        d3.selectAll('.tooltip').remove()
      })

    // X-axis
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M')))
      .selectAll('text')
      .style('fill', '#a78bfa')
      .style('font-size', '12px')

    // Y-axis
    svg
      .append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#a78bfa')
      .style('font-size', '12px')

    // Remove axis lines
    svg.selectAll('.domain').remove()
    svg.selectAll('.tick line').remove()

  }, [selectedMetric])

  const metrics = [
    {
      id: 'agents',
      label: 'Active Agents',
      icon: Cpu,
      color: 'text-purple-400'
    },
    {
      id: 'requests',
      label: 'Requests/Min',
      icon: Zap,
      color: 'text-blue-400'
    },
    {
      id: 'latency',
      label: 'Latency (ms)',
      icon: Activity,
      color: 'text-green-400'
    },
    {
      id: 'errors',
      label: 'Errors',
      icon: TrendingUp,
      color: 'text-red-400'
    }
  ]

  return (
    <div className="space-y-4">
      {/* Metric selector */}
      <div className="flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <button
            key={metric.id}
            onClick={() => setSelectedMetric(metric.id as any)}
            className={`flex items-center space-x-2 px-3 py-1 rounded-lg border transition-all ${
              selectedMetric === metric.id
                ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
            }`}
          >
            <metric.icon className="h-4 w-4" />
            <span className="text-sm">{metric.label}</span>
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div
        ref={containerRef}
        className="w-full h-64 bg-black/20 rounded-lg p-2"
      />
    </div>
  )
}