package production

// LifecycleRule holds lifecycle rule
type LifecycleRule struct {
	ID                             string                                  `json:"id"`
	Status                         string                                  `json:"status"`
	Filter                         Filter                                  `json:"filter"`
	Expiration                     LifecycleExpiration                     `json:"expiration"`
	Transition                     []LifecycleTransition                   `json:"transition"`
	NoncurrentVersionExpiration    LifecycleExpiration                     `json:"noncurrent_version_expiration"`
	NoncurrentVersionTransition    []LifecycleTransition                   `json:"noncurrent_version_transition"`
	AbortIncompleteMultipartUpload LifecycleAbortIncompleteMultipartUpload `json:"abort_incomplete_multipart_upload"`
}

type LifecycleExpiration struct {
	Date                      string `json:"date"`
	Days                      int    `json:"days"`
	ExpiredObjectDeleteMarker bool   `json:"expired_object_delete_marker"`
}

type LifecycleTransition struct {
	Date         string `json:"date"`
	Days         int    `json:"days"`
	StorageClass string `json:"storage_class"`
}

type LifecycleAbortIncompleteMultipartUpload struct {
	DaysAfterInitiation int `json:"days_after_initiation"`
}

// ReplicationConfig holds replication configuration
type ReplicationConfig struct {
	Role  string            `json:"role"`
	Rules []ReplicationRule `json:"rules"`
}

type ReplicationRule struct {
	ID                      string                  `json:"id"`
	Status                  string                  `json:"status"`
	Priority                int                     `json:"priority"`
	Filter                  Filter                  `json:"filter"`
	Destination             DestinationConfig       `json:"destination"`
	DeleteMarkerReplication DeleteMarkerReplication `json:"delete_marker_replication"`
}

type DeleteMarkerReplication struct {
	Status string `json:"status"`
}

// ObjectLockConfig holds object lock configuration
type ObjectLockConfig struct {
	ObjectLockEnabled string         `json:"object_lock_enabled"`
	Rule              ObjectLockRule `json:"rule"`
}

type ObjectLockRule struct {
	DefaultRetention DefaultRetention `json:"default_retention"`
}

type DefaultRetention struct {
	Mode  string `json:"mode"`
	Days  int    `json:"days"`
	Years int    `json:"years"`
}

// PublicAccessBlockConfig holds public access block configuration
type PublicAccessBlockConfig struct {
	BlockPublicAcls       bool `json:"block_public_acls"`
	IgnorePublicAcls      bool `json:"ignore_public_acls"`
	BlockPublicPolicy     bool `json:"block_public_policy"`
	RestrictPublicBuckets bool `json:"restrict_public_buckets"`
}

// Filter holds filter configuration
type Filter struct {
	Prefix string `json:"prefix"`
	Tags   []Tag  `json:"tags"`
}

type Tag struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// DestinationConfig holds destination configuration
type DestinationConfig struct {
	Bucket                   string           `json:"bucket"`
	Account                  string           `json:"account"`
	Format                   string           `json:"format"`
	Prefix                   string           `json:"prefix"`
	StorageClass             string           `json:"storage_class"`
	Encryption               EncryptionConfig `json:"encryption"`
	AccessControlAccessScope string           `json:"access_control_access_scope"`
	Metrics                  MetricsConfig    `json:"metrics"`
}

// ByteMatchStatement holds byte match statement
type ByteMatchStatement struct {
	SearchString         string       `json:"search_string"`
	FieldToMatch         FieldToMatch `json:"field_to_match"`
	TextTransformation   string       `json:"text_transformation"`
	PositionalConstraint string       `json:"positional_constraint"`
}

// GeoMatchStatement holds geo match statement
type GeoMatchStatement struct {
	CountryCodes      []string          `json:"country_codes"`
	ForwardedIPConfig ForwardedIPConfig `json:"forwarded_ip_config"`
}

type ForwardedIPConfig struct {
	HeaderName       string `json:"header_name"`
	FallbackBehavior string `json:"fallback_behavior"`
}

type FieldToMatch struct {
	Type string `json:"type"` // "URI", "QUERY_STRING", "HEADER", "METHOD", "BODY", "SINGLE_HEADER"
	Data string `json:"data"`
}

// RuleGroupConfig holds rule group configuration
type RuleGroupConfig struct {
	Name             string              `json:"name"`
	Priority         int                 `json:"priority"`
	Capacity         int                 `json:"capacity"`
	Statement        WAFStatement        `json:"statement"`
	Action           WAFAction           `json:"action"`
	VisibilityConfig WAFVisibilityConfig `json:"visibility_config"`
}

// NOTE: WAFAction, WAFStatement, WAFVisibilityConfig and their sub-structs are in infrastructure_config.go
// Only defining types that were NOT found there.

// WAFCaptchaConfig holds captcha configuration
type WAFCaptchaConfig struct {
	ImmunityTimeProperty WAFCaptchaImmunityTimeProperty `json:"immunity_time_property"`
}

type WAFCaptchaImmunityTimeProperty struct {
	ImmunityTime int `json:"immunity_time"`
}

// IPSetReferenceStatement holds IP set reference statement
type IPSetReferenceStatement struct {
	ARN string `json:"arn"`
}

// RegexPatternSetReferenceStatement holds regex pattern set reference statement
type RegexPatternSetReferenceStatement struct {
	ARN                string       `json:"arn"`
	FieldToMatch       FieldToMatch `json:"field_to_match"`
	TextTransformation string       `json:"text_transformation"`
}

// SizeConstraintStatement holds size constraint statement
type SizeConstraintStatement struct {
	FieldToMatch       FieldToMatch `json:"field_to_match"`
	ComparisonOperator string       `json:"comparison_operator"`
	Size               int          `json:"size"`
	TextTransformation string       `json:"text_transformation"`
}

// SqliMatchStatement holds SQLi match statement
type SqliMatchStatement struct {
	FieldToMatch       FieldToMatch `json:"field_to_match"`
	TextTransformation string       `json:"text_transformation"`
}

// XssMatchStatement holds XSS match statement
type XssMatchStatement struct {
	FieldToMatch       FieldToMatch `json:"field_to_match"`
	TextTransformation string       `json:"text_transformation"`
}

// AndStatement holds AND statement
type AndStatement struct {
	Statements []WAFStatement `json:"statements"`
}

// OrStatement holds OR statement
type OrStatement struct {
	Statements []WAFStatement `json:"statements"`
}

// NotStatement holds NOT statement
type NotStatement struct {
	Statement *WAFStatement `json:"statement"`
}

type ManagedRuleGroupStatement struct {
	VendorName    string         `json:"vendor_name"`
	Name          string         `json:"name"`
	ExcludedRules []ExcludedRule `json:"excluded_rules"`
}

type ExcludedRule struct {
	Name string `json:"name"`
}

type WAFLoggingConfig struct {
	Enabled     bool   `json:"enabled"`
	Destination string `json:"destination"`
}

type GuardDutyConfig struct {
	Enabled bool `json:"enabled"`
}

type MacieConfig struct {
	Enabled bool `json:"enabled"`
}

type SecurityGroupConfig struct {
	Name        string              `json:"name"`
	VPCID       string              `json:"vpc_id"`
	Ingress     []SecurityGroupRule `json:"ingress"`
	Egress      []SecurityGroupRule `json:"egress"`
	Description string              `json:"description"`
}

type SecurityGroupRule struct {
	Protocol    string `json:"protocol"`
	Port        int    `json:"port"`
	CIDR        string `json:"cidr"`
	Description string `json:"description"`
}

type NACLConfig struct {
	Name  string            `json:"name"`
	VPCID string            `json:"vpc_id"`
	Rules []NACLRule        `json:"rules"`
	Tags  map[string]string `json:"tags"`
}
type NACLRule struct {
	Number    int           `json:"number"`
	Protocol  string        `json:"protocol"`
	PortRange NACLPortRange `json:"port_range"`
	CIDR      string        `json:"cidr"`
	Action    string        `json:"action"`
	Egress    bool          `json:"egress"`
}

type NACLPortRange struct {
	From int `json:"from"`
	To   int `json:"to"`
}

type InspectorConfig struct {
	Enabled bool `json:"enabled"`
}
