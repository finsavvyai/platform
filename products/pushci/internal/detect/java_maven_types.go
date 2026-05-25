// Package detect — Java/Maven enriched parsing types.
package detect

import "encoding/xml"

// MavenPom is the subset of a pom.xml we care about for pipeline
// generation. Additional fields can be added without breaking the
// existing XML unmarshal — Go's xml package ignores unknown tags.
type MavenPom struct {
	XMLName    xml.Name     `xml:"project"`
	GroupID    string       `xml:"groupId"`
	ArtifactID string       `xml:"artifactId"`
	Version    string       `xml:"version"`
	Packaging  string       `xml:"packaging"`
	Parent     *MavenParent `xml:"parent"`
	Modules    MavenModules `xml:"modules"`
	Properties MavenProps   `xml:"properties"`
	Deps       MavenDepList `xml:"dependencies"`
}

// MavenParent represents the `<parent>` coordinates a child module
// inherits from.
type MavenParent struct {
	GroupID    string `xml:"groupId"`
	ArtifactID string `xml:"artifactId"`
	Version    string `xml:"version"`
}

// MavenModules wraps the `<modules>` block so Go's xml decoder can
// collect repeated `<module>` children.
type MavenModules struct {
	Module []string `xml:"module"`
}

// MavenDepList wraps `<dependencies>` for the same reason.
type MavenDepList struct {
	Dependency []MavenDep `xml:"dependency"`
}

// MavenDep is one `<dependency>`.
type MavenDep struct {
	GroupID    string `xml:"groupId"`
	ArtifactID string `xml:"artifactId"`
	Version    string `xml:"version"`
	Scope      string `xml:"scope"`
}
