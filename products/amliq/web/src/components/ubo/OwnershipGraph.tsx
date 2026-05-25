export interface UBONode {
  id: string
  label: string
  ownershipPct: number
}

export interface UBOEdge {
  from: string
  to: string
}

interface Props {
  nodes: UBONode[]
  edges: UBOEdge[]
}

const NODE_W = 160
const NODE_H = 52
const H_GAP = 40
const V_GAP = 80

function nodeColor(pct: number, isRoot: boolean): string {
  if (isRoot) return '#C9A96E'
  if (pct > 50) return '#F59E0B'
  if (pct >= 25) return '#EAB308'
  return '#6B7280'
}

function buildLevels(nodes: UBONode[], edges: UBOEdge[]): UBONode[][] {
  const childSet = new Set(edges.map(e => e.to))
  const roots = nodes.filter(n => !childSet.has(n.id))
  const visited = new Set<string>()
  const levels: UBONode[][] = []

  let current = roots.length > 0 ? roots : [nodes[0]].filter(Boolean)
  while (current.length > 0) {
    const next: UBONode[] = []
    const level: UBONode[] = []
    for (const node of current) {
      if (!node || visited.has(node.id)) continue
      visited.add(node.id)
      level.push(node)
      const children = edges
        .filter(e => e.from === node.id)
        .map(e => nodes.find(n => n.id === e.to))
        .filter((n): n is UBONode => !!n && !visited.has(n.id))
      next.push(...children)
    }
    if (level.length > 0) levels.push(level)
    current = next
  }

  // Include any disconnected nodes
  const unvisited = nodes.filter(n => !visited.has(n.id))
  if (unvisited.length > 0) levels.push(unvisited)

  return levels
}

export function OwnershipGraph({ nodes, edges }: Props) {
  if (nodes.length === 0) return null

  const childSet = new Set(edges.map(e => e.to))
  const rootIds = new Set(nodes.filter(n => !childSet.has(n.id)).map(n => n.id))

  const levels = buildLevels(nodes, edges)
  const maxPerRow = Math.max(...levels.map(l => l.length), 1)
  const svgW = Math.max(maxPerRow * (NODE_W + H_GAP) - H_GAP + 80, 400)
  const svgH = levels.length * (NODE_H + V_GAP) - V_GAP + 60

  // Compute positions
  const pos: Record<string, { x: number; y: number }> = {}
  levels.forEach((level, row) => {
    const rowW = level.length * NODE_W + (level.length - 1) * H_GAP
    const startX = (svgW - rowW) / 2
    level.forEach((node, col) => {
      pos[node.id] = {
        x: startX + col * (NODE_W + H_GAP),
        y: 20 + row * (NODE_H + V_GAP),
      }
    })
  })

  return (
    <div className="overflow-auto w-full">
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        aria-label="Ownership structure graph"
        role="img"
      >
        {/* Edges */}
        {edges.map((edge, i) => {
          const from = pos[edge.from]
          const to = pos[edge.to]
          if (!from || !to) return null
          const x1 = from.x + NODE_W / 2
          const y1 = from.y + NODE_H
          const x2 = to.x + NODE_W / 2
          const y2 = to.y
          const mx = (x1 + x2) / 2
          const my = (y1 + y2) / 2
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
              fill="none"
              stroke="var(--dash-border, #334155)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          )
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const p = pos[node.id]
          if (!p) return null
          const isRoot = rootIds.has(node.id)
          const fill = nodeColor(node.ownershipPct, isRoot)
          const textColor = isRoot ? '#1a1a1a' : node.ownershipPct < 25 ? '#e5e7eb' : '#1a1a1a'
          return (
            <g key={node.id} transform={`translate(${p.x}, ${p.y})`}>
              <rect
                x={0} y={0}
                width={NODE_W} height={NODE_H}
                rx={10} ry={10}
                fill={fill}
                opacity={isRoot ? 1 : 0.85}
                stroke={isRoot ? '#a07840' : 'transparent'}
                strokeWidth={isRoot ? 2 : 0}
              />
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 - 6}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fontWeight={600}
                fill={textColor}
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
              </text>
              <text
                x={NODE_W / 2}
                y={NODE_H / 2 + 10}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill={textColor}
                opacity={0.85}
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {node.ownershipPct.toFixed(1)}%
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
