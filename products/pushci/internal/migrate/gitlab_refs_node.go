package migrate

import "gopkg.in/yaml.v3"

func resolveReference(ref *yaml.Node, anchors map[string]*yaml.Node) *yaml.Node {
	if len(ref.Content) < 2 {
		return nil
	}
	cur, ok := anchors[ref.Content[0].Value]
	if !ok {
		return nil
	}
	for _, seg := range ref.Content[1:] {
		next := mappingLookup(cur, seg.Value)
		if next == nil {
			return nil
		}
		cur = next
	}
	return cur
}

func mappingLookup(n *yaml.Node, key string) *yaml.Node {
	if n == nil || n.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(n.Content); i += 2 {
		if n.Content[i].Value == key {
			return n.Content[i+1]
		}
	}
	return nil
}

func deepCopyNode(n *yaml.Node) *yaml.Node {
	if n == nil {
		return nil
	}
	cp := *n
	cp.Content = nil
	for _, c := range n.Content {
		cp.Content = append(cp.Content, deepCopyNode(c))
	}
	return &cp
}
