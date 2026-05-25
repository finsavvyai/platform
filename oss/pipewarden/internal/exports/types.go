package exports

type SARIFResult struct {
	RuleID     string                 `json:"ruleId"`
	Level      string                 `json:"level"`
	Message    SARIFMessage           `json:"message"`
	Locations  []SARIFLocation        `json:"locations"`
	Properties map[string]interface{} `json:"properties,omitempty"`
}

type SARIFMessage struct {
	Text string `json:"text"`
}

type SARIFLocation struct {
	PhysicalLocation SARIFPhysicalLocation `json:"physicalLocation"`
}

type SARIFPhysicalLocation struct {
	ArtifactLocation SARIFArtifactLocation `json:"artifactLocation"`
	Region           *SARIFRegion          `json:"region,omitempty"`
}

type SARIFArtifactLocation struct {
	URI string `json:"uri"`
}

type SARIFRegion struct {
	StartLine   int `json:"startLine"`
	StartColumn int `json:"startColumn,omitempty"`
	EndLine     int `json:"endLine,omitempty"`
	EndColumn   int `json:"endColumn,omitempty"`
}

type SARIFRun struct {
	Tool    SARIFTool     `json:"tool"`
	Results []SARIFResult `json:"results"`
}

type SARIFTool struct {
	Driver SARIFDriver `json:"driver"`
}

type SARIFDriver struct {
	Name           string      `json:"name"`
	Version        string      `json:"version"`
	InformationURI string      `json:"informationUri,omitempty"`
	Rules          []SARIFRule `json:"rules,omitempty"`
}

type SARIFRule struct {
	ID                   string             `json:"id"`
	ShortDescription     SARIFDescription   `json:"shortDescription"`
	FullDescription      *SARIFDescription  `json:"fullDescription,omitempty"`
	DefaultConfiguration SARIFConfiguration `json:"defaultConfiguration"`
	Help                 SARIFHelp          `json:"help,omitempty"`
}

type SARIFDescription struct {
	Text string `json:"text"`
}

type SARIFConfiguration struct {
	Level string `json:"level"`
}

type SARIFHelp struct {
	Text     string `json:"text,omitempty"`
	Markdown string `json:"markdown,omitempty"`
}

type SARIFLog struct {
	Version string     `json:"version"`
	Runs    []SARIFRun `json:"runs"`
}
