// Package detect — Java/Maven enriched parsing.
package detect

import (
	"encoding/xml"
	"os"
	"path/filepath"
	"strings"
)

// ParsePomXML decodes a pom.xml from bytes. Returns a MavenPom with
// resolved modules. Property substitution is applied lazily via
// ResolveVersion below — the raw pom keeps placeholders intact so
// callers can see them if they need to.
func ParsePomXML(data []byte) (*MavenPom, error) {
	var p MavenPom
	if err := xml.Unmarshal(data, &p); err != nil {
		return nil, err
	}
	if p.Packaging == "" {
		p.Packaging = "jar"
	}
	if p.GroupID == "" && p.Parent != nil {
		p.GroupID = p.Parent.GroupID
	}
	if p.Version == "" && p.Parent != nil {
		p.Version = p.Parent.Version
	}
	return &p, nil
}

// ParsePomFile reads and parses a pom.xml from disk.
func ParsePomFile(path string) (*MavenPom, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return ParsePomXML(data)
}

// ResolveVersion expands `${project.version}` / `${foo}` references
// using the pom's own properties. Bounded depth to avoid loops.
func (p *MavenPom) ResolveVersion(v string) string {
	if !strings.Contains(v, "${") {
		return v
	}
	table := p.propertyTable()
	out := v
	for i := 0; i < 10; i++ {
		next := out
		for k, val := range table {
			next = strings.ReplaceAll(next, "${"+k+"}", val)
		}
		if next == out {
			return next
		}
		out = next
	}
	return out
}

func (p *MavenPom) propertyTable() map[string]string {
	table := map[string]string{}
	for k, val := range p.Properties.Entries {
		table[k] = val
	}
	table["project.version"] = p.Version
	table["project.groupId"] = p.GroupID
	table["project.artifactId"] = p.ArtifactID
	return table
}

// IsMultiModule reports whether the pom declares submodules.
func (p *MavenPom) IsMultiModule() bool {
	return len(p.Modules.Module) > 0
}

// JavaVersion inspects common `<properties>` keys to guess the
// required Java version. Returns "" if nothing is declared.
func (p *MavenPom) JavaVersion() string {
	for _, k := range []string{"maven.compiler.release", "maven.compiler.target", "java.version"} {
		if v := strings.TrimSpace(p.Properties.Entries[k]); v != "" {
			return v
		}
	}
	return ""
}

// DetectMavenProject convenience helper: given a directory, if it
// contains a pom.xml return a parsed representation.
func DetectMavenProject(dir string) (*MavenPom, error) {
	pomPath := filepath.Join(dir, "pom.xml")
	if !fileExists(pomPath) {
		return nil, nil
	}
	return ParsePomFile(pomPath)
}
