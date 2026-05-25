package detect

import "regexp"

var (
	terraformBlockRe = regexp.MustCompile(`terraform\s*\{`)
	requiredProvsRe  = regexp.MustCompile(`required_providers\s*\{`)
	provAssignRe     = regexp.MustCompile(`([A-Za-z_][A-Za-z0-9_-]*)\s*=\s*\{`)
	moduleBlockRe    = regexp.MustCompile(`module\s+"([^"]+)"\s*\{`)
	backendBlockRe   = regexp.MustCompile(`backend\s+"([^"]+)"\s*\{`)
	requiredVersRe   = regexp.MustCompile(`required_version\s*=\s*"([^"]+)"`)
)

func scanProviders(src string) []TfProvider {
	out := []TfProvider{}
	for _, tf := range findBlocks(src, terraformBlockRe) {
		for _, rp := range findBlocks(tf.Body, requiredProvsRe) {
			out = append(out, extractProviders(rp.Body)...)
		}
	}
	return out
}

func extractProviders(body string) []TfProvider {
	out := []TfProvider{}
	for _, m := range provAssignRe.FindAllStringSubmatchIndex(body, -1) {
		name := body[m[2]:m[3]]
		braceStart := m[1] - 1
		end, ok := matchBrace(body, braceStart)
		if !ok {
			continue
		}
		kv := kvPairs(body[braceStart+1 : end])
		out = append(out, TfProvider{Name: name, Source: kv["source"], Version: kv["version"]})
	}
	return out
}

func scanModules(src string) []TfModule {
	out := []TfModule{}
	for _, b := range findBlocks(src, moduleBlockRe) {
		kv := kvPairs(b.Body)
		if kv["source"] == "" {
			continue
		}
		out = append(out, TfModule{Name: b.Header[1], Source: kv["source"], Version: kv["version"]})
	}
	return out
}

func scanBackend(src string) *TfBackend {
	for _, tf := range findBlocks(src, terraformBlockRe) {
		for _, b := range findBlocks(tf.Body, backendBlockRe) {
			return &TfBackend{Type: b.Header[1], Config: kvPairs(b.Body)}
		}
	}
	return nil
}

func scanRequiredVersion(src string) string {
	for _, tf := range findBlocks(src, terraformBlockRe) {
		if m := requiredVersRe.FindStringSubmatch(tf.Body); m != nil {
			return m[1]
		}
	}
	return ""
}
