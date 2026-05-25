package migrate

import (
	"strings"

	"gopkg.in/yaml.v3"
)

// expandGitLabReferences inlines GitLab `!reference [.anchor, key]`
// tags. Without this, jobs whose `script:` mixes plain commands
// with `!reference` lookups fail to unmarshal into GitLabJob and
// extractJobs silently drops them. Standard `&`/`*` anchors are
// already resolved by yaml.v3.
func expandGitLabReferences(rawYAML string) string {
	var doc yaml.Node
	if err := yaml.Unmarshal([]byte(rawYAML), &doc); err != nil {
		return rawYAML
	}
	if len(doc.Content) == 0 || doc.Content[0].Kind != yaml.MappingNode {
		return rawYAML
	}
	root := doc.Content[0]
	expandRefsInNode(root, collectAnchorSections(root), 0)
	out, err := yaml.Marshal(&doc)
	if err != nil {
		return rawYAML
	}
	return string(out)
}

func collectAnchorSections(root *yaml.Node) map[string]*yaml.Node {
	m := map[string]*yaml.Node{}
	for i := 0; i+1 < len(root.Content); i += 2 {
		k, v := root.Content[i], root.Content[i+1]
		if strings.HasPrefix(k.Value, ".") && v.Kind == yaml.MappingNode {
			m[k.Value] = v
		}
	}
	return m
}

// expandRefsInNode walks the YAML tree replacing `!reference`
// sequences with deep copies of resolved content. Depth-bounded
// against circular refs.
func expandRefsInNode(n *yaml.Node, anchors map[string]*yaml.Node, depth int) {
	if n == nil || depth > 16 {
		return
	}
	switch n.Kind {
	case yaml.SequenceNode:
		n.Content = expandSequenceContent(n.Content, anchors, depth)
	case yaml.MappingNode, yaml.DocumentNode:
		for _, c := range n.Content {
			expandRefsInNode(c, anchors, depth+1)
		}
	}
}

func expandSequenceContent(in []*yaml.Node, anchors map[string]*yaml.Node, depth int) []*yaml.Node {
	var out []*yaml.Node
	for _, child := range in {
		if child.Tag == "!reference" && child.Kind == yaml.SequenceNode {
			if r := resolveReference(child, anchors); r != nil && r.Kind == yaml.SequenceNode {
				for _, item := range r.Content {
					out = append(out, deepCopyNode(item))
				}
				continue
			}
		}
		expandRefsInNode(child, anchors, depth+1)
		out = append(out, child)
	}
	return out
}
