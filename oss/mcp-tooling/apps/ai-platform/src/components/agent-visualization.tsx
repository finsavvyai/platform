'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface Agent {
  id: string
  name: string
  status: 'running' | 'stopped' | 'error' | 'paused'
  type: string
  requests: number
  latency: number
  uptime: string
  lastActive: string
  description: string
}

interface AgentVisualizationProps {
  agents: Agent[]
}

export function AgentVisualization({ agents }: AgentVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || agents.length === 0) return

    // Clear previous visualization
    d3.select(containerRef.current).selectAll('*').remove()

    const width = containerRef.current.offsetWidth
    const height = 300

    // Create SVG
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

    // Group agents by type
    const groupedAgents = d3.group(agents, d => d.type)

    // Create force simulation
    const simulation = d3
      .forceSimulation()
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(30))
      .force('link', d3.forceLink().id((d: any) => d.id).distance(100))

    // Create nodes
    const nodes = agents.map(agent => ({
      ...agent,
      radius: Math.max(20, Math.min(40, agent.requests / 500)),
      color: agent.status === 'running' ? '#10b981' :
        agent.status === 'error' ? '#ef4444' :
          agent.status === 'paused' ? '#f59e0b' : '#6b7280'
    }))

    // Create links between agents of the same type
    const links: any[] = []
    groupedAgents.forEach((groupAgents, type) => {
      for (let i = 0; i < groupAgents.length - 1; i++) {
        for (let j = i + 1; j < groupAgents.length; j++) {
          if (Math.random() < 0.3) { // Randomly connect agents of same type
            links.push({
              source: groupAgents[i].id,
              target: groupAgents[j].id
            })
          }
        }
      }
    })

    // Create link elements
    const link = svg
      .append('g')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#9333ea')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1)

    // Create node groups
    const node = svg
      .append('g')
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .style('cursor', 'pointer')

    // Add circles for nodes
    node
      .append('circle')
      .attr('r', (d: any) => d.radius)
      .attr('fill', (d: any) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', 0.8)
      .on('mouseover', function (event, d: any) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => d.radius * 1.2)
          .attr('opacity', 1)

        // Show tooltip
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background', 'rgba(0, 0, 0, 0.9)')
          .style('color', 'white')
          .style('padding', '8px')
          .style('border-radius', '6px')
          .style('font-size', '12px')
          .style('pointer-events', 'none')
          .style('opacity', 0)
          .style('z-index', 1000)

        tooltip.transition().duration(200).style('opacity', 1)

        tooltip
          .html(`
            <div style="font-weight: bold; margin-bottom: 4px;">${d.name}</div>
            <div style="color: #a78bfa;">${d.type} • ${d.status}</div>
            <div style="margin-top: 4px;">
              <div>Requests: ${d.requests.toLocaleString()}</div>
              <div>Latency: ${d.latency}ms</div>
              <div>Uptime: ${d.uptime}</div>
            </div>
          `)
          .style('left', `${event.pageX + 10}px`)
          .style('top', `${event.pageY - 28}px`)
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', (d: any) => d.radius)
          .attr('opacity', 0.8)

        d3.selectAll('.tooltip').remove()
      })

    // Add labels
    node
      .append('text')
      .text((d: any) => d.name.split(' ')[0]) // Show first word of name
      .attr('text-anchor', 'middle')
      .attr('dy', '0.3em')
      .style('fill', 'white')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('pointer-events', 'none')
      .style('text-shadow', '0 0 4px rgba(0,0,0,0.8)')

    // Update simulation
    simulation.nodes(nodes as any).on('tick', ticked)

    simulation.force<d3.ForceLink<any, any>>('link')?.links(links)

    function ticked() {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    }

    // Add drag functionality
    const drag = d3
      .drag<SVGGElement, any>()
      .on('start', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d: any) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d: any) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(drag as any)

    // Cleanup
    return () => {
      simulation.stop()
      d3.selectAll('.tooltip').remove()
    }
  }, [agents])

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[300px]" />
      {agents.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-purple-300">No agents to visualize</p>
        </div>
      )}
    </div>
  )
}