package tests

import ("testing"; "github.com/stretchr/testify/assert"; "github.com/stretchr/testify/require")

type Node struct { ID, Type string }
type Edge struct { From, To string; Weight float64; Count int }
type FraudRing struct { Nodes []*Node; Edges []*Edge; Members int; Risk float64 }
type RingDetector struct { nodes map[string]*Node; edges map[string]map[string]*Edge }

func NewRingDetector() *RingDetector {
  return &RingDetector{nodes: make(map[string]*Node), edges: make(map[string]map[string]*Edge)}
}

func (rd *RingDetector) addNode(id, nodeType string) *Node {
  n := &Node{ID: id, Type: nodeType}
  rd.nodes[id] = n
  if rd.edges[id] == nil { rd.edges[id] = make(map[string]*Edge) }
  return n
}

func (rd *RingDetector) addEdge(from, to string, weight float64) *Edge {
  if rd.edges[from] == nil { rd.edges[from] = make(map[string]*Edge) }
  e := &Edge{From: from, To: to, Weight: weight, Count: 1}
  rd.edges[from][to] = e
  return e
}

func (rd *RingDetector) detectRings() []*FraudRing {
  rings, visited := make([]*FraudRing, 0), make(map[string]bool)
  for nodeID := range rd.nodes {
    if !visited[nodeID] {
      component := rd.dfs(nodeID, visited)
      if len(component) > 2 {
        rings = append(rings, &FraudRing{Nodes: component, Members: len(component), Risk: 0.5 + float64(len(component))*0.1})
      }
    }
  }
  return rings
}

func (rd *RingDetector) dfs(start string, visited map[string]bool) []*Node {
  component := make([]*Node, 0)
  stack := []string{start}
  for len(stack) > 0 {
    current := stack[len(stack)-1]
    stack = stack[:len(stack)-1]
    if visited[current] { continue }
    visited[current] = true
    component = append(component, rd.nodes[current])
    for neighbor := range rd.edges[current] {
      if !visited[neighbor] { stack = append(stack, neighbor) }
    }
  }
  return component
}

func (rd *RingDetector) analyzePattern(ring *FraudRing) map[string]interface{} {
  return map[string]interface{}{"size": ring.Members, "suspicious": ring.Members >= 3 && ring.Risk > 0.7}
}

func TestBasicRing(t *testing.T) {
  rd := NewRingDetector()
  for _, n := range []string{"A", "B", "C"} { rd.addNode(n, "account") }
  rd.addEdge("A", "B", 1.0)
  rd.addEdge("B", "C", 1.0)
  rd.addEdge("C", "A", 1.0)
  rings := rd.detectRings()
  assert.NotEmpty(t, rings)
  assert.Equal(t, 3, rings[0].Members)
}

func TestMultipleRings(t *testing.T) {
  rd := NewRingDetector()
  for _, n := range []string{"A", "B", "C", "X", "Y", "Z"} { rd.addNode(n, "account") }
  rd.addEdge("A", "B", 1.0)
  rd.addEdge("B", "C", 1.0)
  rd.addEdge("C", "A", 1.0)
  rd.addEdge("X", "Y", 1.0)
  rd.addEdge("Y", "Z", 1.0)
  rd.addEdge("Z", "X", 1.0)
  rings := rd.detectRings()
  assert.Equal(t, 2, len(rings))
}

func TestComplexGraph(t *testing.T) {
  rd := NewRingDetector()
  for i := 0; i < 5; i++ { rd.addNode(string(rune('A'+i)), "account") }
  rd.addEdge("A", "B", 1.0)
  rd.addEdge("B", "C", 1.0)
  rd.addEdge("C", "D", 1.0)
  rd.addEdge("D", "E", 1.0)
  rd.addEdge("E", "A", 1.0)
  rings := rd.detectRings()
  require.NotEmpty(t, rings)
  assert.GreaterOrEqual(t, rings[0].Members, 3)
}

func TestSuspiciousPattern(t *testing.T) {
  rd := NewRingDetector()
  for i := 0; i < 4; i++ { rd.addNode(string(rune('A'+i)), "account") }
  rd.addEdge("A", "B", 1.0)
  rd.addEdge("B", "C", 1.0)
  rd.addEdge("C", "D", 1.0)
  rd.addEdge("D", "A", 1.0)
  rings := rd.detectRings()
  require.NotEmpty(t, rings)
  assert.True(t, rd.analyzePattern(rings[0])["suspicious"].(bool))
}

func TestConnectedComponents(t *testing.T) {
  rd := NewRingDetector()
  rd.addNode("U1", "user")
  rd.addNode("U2", "user")
  rd.addEdge("U1", "U2", 1.0)
  rd.addNode("U3", "user")
  rd.addNode("U4", "user")
  rd.addNode("U5", "user")
  rd.addEdge("U3", "U4", 1.0)
  rd.addEdge("U4", "U5", 1.0)
  rd.addEdge("U5", "U3", 1.0)
  rings := rd.detectRings()
  assert.Equal(t, 1, len(rings))
  assert.Equal(t, 3, rings[0].Members)
}

func TestLargeRing(t *testing.T) {
  rd := NewRingDetector()
  for i := 0; i < 20; i++ { rd.addNode(string(rune('A'+i)), "account") }
  for i := 0; i < 20; i++ {
    rd.addEdge(string(rune('A'+i)), string(rune('A'+(i+1)%20)), 1.0)
  }
  rings := rd.detectRings()
  require.NotEmpty(t, rings)
  assert.GreaterOrEqual(t, rings[0].Members, 20)
}

func TestRiskCalc(t *testing.T) {
  rd := NewRingDetector()
  for i := 0; i < 5; i++ { rd.addNode(string(rune('A'+i)), "account") }
  for i := 0; i < 4; i++ { rd.addEdge(string(rune('A'+i)), string(rune('A'+i+1)), 1.0) }
  rd.addEdge("E", "A", 1.0)
  rings := rd.detectRings()
  require.NotEmpty(t, rings)
  assert.Greater(t, rings[0].Risk, 0.5)
}

func TestEmptyGraph(t *testing.T) {
  rd := NewRingDetector()
  rings := rd.detectRings()
  assert.Empty(t, rings)
}

func BenchmarkRingDetection(b *testing.B) {
  rd := NewRingDetector()
  for i := 0; i < 50; i++ { rd.addNode(string(rune('A'+i)), "account") }
  for i := 0; i < 49; i++ { rd.addEdge(string(rune('A'+i)), string(rune('A'+i+1)), 1.0) }
  rd.addEdge(string(rune('A'+49)), "A", 1.0)
  b.ResetTimer()
  for i := 0; i < b.N; i++ { _ = rd.detectRings() }
}
