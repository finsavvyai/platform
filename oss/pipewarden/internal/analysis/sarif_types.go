package analysis

// SARIFReport represents a complete SARIF 2.1.0 report for GitHub Security tab integration.
type SARIFReport struct {
	Version                  string        `json:"version"`
	Runs                     []SARIFRun    `json:"runs"`
	InlineExternalProperties []interface{} `json:"inlineExternalProperties,omitempty"`
}

// SARIFRun represents a single analysis run within a SARIF report.
type SARIFRun struct {
	Tool        SARIFTool          `json:"tool"`
	Results     []SARIFResult      `json:"results"`
	Properties  SARIFRunProperties `json:"properties,omitempty"`
	Invocations []SARIFInvocation  `json:"invocations,omitempty"`
}

// SARIFTool describes the analysis tool (PipeWarden).
type SARIFTool struct {
	Driver SARIFDriver `json:"driver"`
}

// SARIFDriver provides metadata about the tool.
type SARIFDriver struct {
	Name           string      `json:"name"`
	Version        string      `json:"version"`
	InformationURI string      `json:"informationUri,omitempty"`
	Rules          []SARIFRule `json:"rules,omitempty"`
	SupportedRules []string    `json:"supportedRules,omitempty"`
}

// SARIFRule defines a rule that the tool can report.
type SARIFRule struct {
	ID                   string              `json:"id"`
	Name                 string              `json:"name,omitempty"`
	ShortDescription     SARIFMessage        `json:"shortDescription,omitempty"`
	FullDescription      SARIFMessage        `json:"fullDescription,omitempty"`
	Help                 SARIFMessage        `json:"help,omitempty"`
	Tags                 []string            `json:"tags,omitempty"`
	DefaultConfiguration SARIFRuleConfig     `json:"defaultConfiguration,omitempty"`
	Relationships        []SARIFRelationship `json:"relationships,omitempty"`
}

// SARIFRuleConfig contains rule-level configuration.
type SARIFRuleConfig struct {
	Enabled bool   `json:"enabled"`
	Level   string `json:"level"`
}

// SARIFRelationship describes relationships between rules (e.g., to CWE).
type SARIFRelationship struct {
	Target      SARIFArtifactLocation `json:"target"`
	Kinds       []string              `json:"kinds,omitempty"`
	Description SARIFMessage          `json:"description,omitempty"`
}

// SARIFResult represents a single finding/issue.
type SARIFResult struct {
	RuleID           string                 `json:"ruleId"`
	RuleIndex        int                    `json:"ruleIndex,omitempty"`
	Kind             string                 `json:"kind"`  // "pass", "notApplicable", "open", "review", "informational", "fail"
	Level            string                 `json:"level"` // "notApplicable", "note", "warning", "error"
	Message          SARIFMessage           `json:"message"`
	AnalysisTarget   SARIFArtifactLocation  `json:"analysisTarget,omitempty"`
	Locations        []SARIFLocation        `json:"locations,omitempty"`
	Fixes            []SARIFFix             `json:"fixes,omitempty"`
	Properties       SARIFResultProperties  `json:"properties,omitempty"`
	Rank             float64                `json:"rank"`
	Confidence       float64                `json:"confidence,omitempty"`
	RelatedLocations []SARIFRelatedLocation `json:"relatedLocations,omitempty"`
	Suppressions     []SARIFSuppression     `json:"suppressions,omitempty"`
}

// SARIFMessage is a localized message string.
type SARIFMessage struct {
	Text      string        `json:"text,omitempty"`
	Markdown  string        `json:"markdown,omitempty"`
	ID        string        `json:"id,omitempty"`
	Arguments []interface{} `json:"arguments,omitempty"`
}

// SARIFLocation specifies where a result was found.
