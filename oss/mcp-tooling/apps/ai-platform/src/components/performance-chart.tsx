'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export function PerformanceChart() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous chart
    d3.select(containerRef.current).selectAll('*').remove()

    // Generate sample data
    const now = new Date()
    const hours = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() - (23 - i) * 3600000)
      return {
        time: time,
        cpu: Math.random() * 80 + 10,
        memory: Math.random() * 60 + 20,
        network: Math.random() * 100 + 50
      }
    })

    const margin = { top: 20, right: 20, bottom: 30, left: 40 }
    const width = containerRef.current.offsetWidth - margin.left - margin.right
    const height = 200 - margin.top - margin.bottom

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
      .domain(d3.extent(hours, d => d.time) as [Date, Date])
      .range([0, width])

    const yScale = d3
      .scaleLinear()
      .domain([0, 100])
      .range([height, 0])

    // Line generators
    const cpuLine = d3
      .line<any>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.cpu))
      .curve(d3.curveMonotoneX)

    const memoryLine = d3
      .line<any>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.memory))
      .curve(d3.curveMonotoneX)

    const networkLine = d3
      .line<any>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.network))
      .curve(d3.curveMonotoneX)

    // Add CPU line
    svg
      .append('path')
      .datum(hours)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('d', cpuLine)

    // Add Memory line
    svg
      .append('path')
      .datum(hours)
      .attr('fill', 'none')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2)
      .attr('d', memoryLine)

    // Add Network line
    svg
      .append('path')
      .datum(hours)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('d', networkLine)

    // Add dots for current values
    const currentData = hours[hours.length - 1]

    svg
      .append('circle')
      .attr('cx', xScale(currentData.time))
      .attr('cy', yScale(currentData.cpu))
      .attr('r', 4)
      .attr('fill', '#10b981')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    svg
      .append('circle')
      .attr('cx', xScale(currentData.time))
      .attr('cy', yScale(currentData.memory))
      .attr('r', 4)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    svg
      .append('circle')
      .attr('cx', xScale(currentData.time))
      .attr('cy', yScale(currentData.network))
      .attr('r', 4)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)

    // Add axes
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M')))
      .selectAll('text')
      .style('fill', '#a78bfa')
      .style('font-size', '10px')

    svg
      .append('g')
      .call(d3.axisLeft(yScale).tickFormat(d => `${d}%`))
      .selectAll('text')
      .style('fill', '#a78bfa')
      .style('font-size', '10px')

    // Remove axis lines
    svg.selectAll('.domain').remove()
    svg.selectAll('.tick line').remove()

    // Add legend
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - 120}, 10)`)

    const legendItems = [
      { color: '#10b981', label: 'CPU' },
      { color: '#3b82f6', label: 'Memory' },
      { color: '#f59e0b', label: 'Network' }
    ]

    legendItems.forEach((item, i) => {
      const legendRow = legend
        .append('g')
        .attr('transform', `translate(0, ${i * 20})`)

      legendRow
        .append('circle')
        .attr('r', 3)
        .attr('fill', item.color)

      legendRow
        .append('text')
        .attr('x', 10)
        .attr('y', 4)
        .text(item.label)
        .style('fill', '#a78bfa')
        .style('font-size', '10px')
    })

  }, [])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[200px]" />
      <div className="mt-4 flex justify-between text-xs text-purple-300">
        <span>CPU: {Math.round(Math.random() * 80 + 10)}%</span>
        <span>Memory: {Math.round(Math.random() * 60 + 20)}%</span>
        <span>Network: {Math.round(Math.random() * 100 + 50)} MB/s</span>
      </div>
    </div>
  )
}