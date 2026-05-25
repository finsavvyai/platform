package main

// SARIFLog represents a complete SARIF 2.1.0 report.
type SARIFLog struct {
	Version string     `json:"version"`
	Runs    []SARIFRun `json:"runs"`
}

// SARIFRun represents a single analysis run.
type SARIFRun struct {
	Tool        SARIFTool         `json:"tool"`
	Results     []SARIFResult     `json:"results"`
	Invocations []SARIFInvocation `json:"invocations,omitempty"`
}

// SARIFTool describes the analysis tool (PushCI).
type SARIFTool struct {
	Driver SARIFDriver `json:"driver"`
}

// SARIFDriver provides tool metadata.
type SARIFDriver struct {
	Name           string      `json:"name"`
	Version        string      `json:"version"`
	InformationURI string      `json:"informationUri,omitempty"`
	Rules          []SARIFRule `json:"rules,omitempty"`
}

// SARIFRule defines a rule the tool can report.
type SARIFRule struct {
	ID                   string             `json:"id"`
	Name                 string             `json:"name,omitempty"`
	ShortDescription     SARIFMessage       `json:"shortDescription,omitempty"`
	FullDescription      SARIFMessage       `json:"fullDescription,omitempty"`
	DefaultConfiguration SARIFConfiguration `json:"defaultConfiguration,omitempty"`
	Tags                 []string           `json:"tags,omitempty"`
}

// SARIFConfiguration contains rule-level configuration.
type SARIFConfiguration struct {
	Level string `json:"level"`
}

// SARIFMessage is a localized message string.
type SARIFMessage struct {
	Text string `json:"text"`
}

// SARIFResult represents a single finding/issue.
type SARIFResult struct {
	RuleID     string                 `json:"ruleId"`
	Kind       string                 `json:"kind"`
	Level      string                 `json:"level"`
	Message    SARIFMessage           `json:"message"`
	Locations  []SARIFLocation        `json:"locations,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
	Rank       float64                `json:"rank"`
}

// SARIFLocation specifies where a result was found.
type SARIFLocation struct {
	PhysicalLocation SARIFPhysicalLocation `json:"physicalLocation,omitempty"`
}

// SARIFPhysicalLocation specifies a file and region.
type SARIFPhysicalLocation struct {
	ArtifactLocation SARIFArtifactLocation `json:"artifactLocation"`
	Region           SARIFRegion           `json:"region,omitempty"`
}

// SARIFArtifactLocation specifies a file path.
type SARIFArtifactLocation struct {
	URI string `json:"uri"`
}

// SARIFRegion specifies a range within a file.
type SARIFRegion struct {
	StartLine int `json:"startLine,omitempty"`
}

// SARIFInvocation describes how the tool was invoked.
type SARIFInvocation struct {
	CommandLine         string `json:"commandLine,omitempty"`
	ExecutionSuccessful bool   `json:"executionSuccessful"`
	EndTimeUtc          string `json:"endTimeUtc,omitempty"`
}
