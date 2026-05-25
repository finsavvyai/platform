package migrate

// coerceStringList accepts multi-shape GitLab fields (only / except
// / needs) which may be a scalar string, a string list, or a list
// of mappings (`only:\n  refs: ...`). Returns just the string-valued
// elements; mappings are dropped because PushCI's only_on takes a
// flat branch list.
func coerceStringList(v interface{}) []string {
	switch t := v.(type) {
	case nil:
		return nil
	case string:
		if t == "" {
			return nil
		}
		return []string{t}
	case []interface{}:
		out := make([]string, 0, len(t))
		for _, item := range t {
			if s, ok := item.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}
