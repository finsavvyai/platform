package analysis

type SARIFLocation struct {
	ID               string                 `json:"id,omitempty"`
	PhysicalLocation SARIFPhysicalLocation  `json:"physicalLocation,omitempty"`
	LogicalLocations []SARIFLogicalLocation `json:"logicalLocations,omitempty"`
	Message          SARIFMessage           `json:"message,omitempty"`
	Relationships    []SARIFRelationship    `json:"relationships,omitempty"`
}

// SARIFPhysicalLocation specifies a file and region.
type SARIFPhysicalLocation struct {
	ArtifactLocation SARIFArtifactLocation `json:"artifactLocation"`
	Region           SARIFRegion           `json:"region,omitempty"`
}

// SARIFArtifactLocation specifies a file path or URI.
type SARIFArtifactLocation struct {
	URI       string `json:"uri"`
	URIBaseId string `json:"uriBaseId,omitempty"`
	Index     int    `json:"index,omitempty"`
}

// SARIFRegion specifies a range within a file.
type SARIFRegion struct {
	StartLine   int                  `json:"startLine,omitempty"`
	EndLine     int                  `json:"endLine,omitempty"`
	StartColumn int                  `json:"startColumn,omitempty"`
	EndColumn   int                  `json:"endColumn,omitempty"`
	CharOffset  int                  `json:"charOffset,omitempty"`
	CharLength  int                  `json:"charLength,omitempty"`
	Snippet     SARIFArtifactContent `json:"snippet,omitempty"`
}

// SARIFArtifactContent represents content snippet.
type SARIFArtifactContent struct {
	Text      string         `json:"text,omitempty"`
	Markdown  string         `json:"markdown,omitempty"`
	Rendering SARIFRendering `json:"rendering,omitempty"`
}

// SARIFRendering specifies how content should be rendered.
type SARIFRendering struct {
	Markdown SARIFMarkdown `json:"markdown,omitempty"`
}

// SARIFMarkdown defines markdown rendering options.
type SARIFMarkdown struct {
	InlineCodeRanges [][]int `json:"inlineCodeRanges,omitempty"`
}

// SARIFLogicalLocation specifies a logical location in code.
type SARIFLogicalLocation struct {
	Name               string `json:"name,omitempty"`
	FullyQualifiedName string `json:"fullyQualifiedName,omitempty"`
	ParentIndex        int    `json:"parentIndex,omitempty"`
	Kind               string `json:"kind,omitempty"`
}

// SARIFFix describes a fix for a result.
type SARIFFix struct {
	Description     SARIFMessage          `json:"description,omitempty"`
	ArtifactChanges []SARIFArtifactChange `json:"artifactChanges"`
	Properties      SARIFFixProperties    `json:"properties,omitempty"`
}

// SARIFArtifactChange describes changes to fix the issue.
type SARIFArtifactChange struct {
	ArtifactLocation SARIFArtifactLocation `json:"artifactLocation"`
	Replacements     []SARIFReplacement    `json:"replacements"`
}

// SARIFReplacement describes text replacement.
type SARIFReplacement struct {
	DeletedRegion   SARIFRegion          `json:"deletedRegion,omitempty"`
	InsertedContent SARIFArtifactContent `json:"insertedContent,omitempty"`
}

// SARIFRelatedLocation specifies a related location.
type SARIFRelatedLocation struct {
	ID               string                 `json:"id,omitempty"`
	PhysicalLocation SARIFPhysicalLocation  `json:"physicalLocation,omitempty"`
	LogicalLocations []SARIFLogicalLocation `json:"logicalLocations,omitempty"`
	Message          SARIFMessage           `json:"message,omitempty"`
}

// SARIFSuppression records suppression of a result.
type SARIFSuppression struct {
	Kind          string        `json:"kind"`            // "inSource", "external"
	State         string        `json:"state,omitempty"` // "accepted", "underReview", "rejected"
	Location      SARIFLocation `json:"location,omitempty"`
	Justification string        `json:"justification,omitempty"`
	InlineComment SARIFComment  `json:"inlineComment,omitempty"`
}

// SARIFComment represents an inline suppression comment.
type SARIFComment struct {
	Text string `json:"text"`
}

// SARIFRunProperties contains properties specific to the run.
type SARIFRunProperties struct {
	SecuritySeverity string   `json:"security-severity,omitempty"`
	Tags             []string `json:"tags,omitempty"`
}

// SARIFResultProperties contains result-specific properties.
type SARIFResultProperties struct {
	SecuritySeverity string   `json:"security-severity,omitempty"`
	Tags             []string `json:"tags,omitempty"`
}

// SARIFFixProperties contains fix-specific properties.
type SARIFFixProperties struct {
	Tags []string `json:"tags,omitempty"`
}

// SARIFInvocation describes how the tool was invoked.
type SARIFInvocation struct {
	CommandLine         string      `json:"commandLine,omitempty"`
	ExecutionSuccessful bool        `json:"executionSuccessful"`
	EndTimeUtc          string      `json:"endTimeUtc,omitempty"`
	Properties          interface{} `json:"properties,omitempty"`
}
