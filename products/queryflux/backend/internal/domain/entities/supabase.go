package entities

// SupabaseMetadata represents Supabase-specific metadata
type SupabaseMetadata struct {
	RLSPolicies []RLSPolicy        `json:"rls_policies"`
	Functions   []SupabaseFunction `json:"functions"`
}

// RLSPolicy represents a Row Level Security policy
type RLSPolicy struct {
	SchemaName string   `json:"schema_name"`
	TableName  string   `json:"table_name"`
	PolicyName string   `json:"policy_name"`
	Permissive string   `json:"permissive"`
	Roles      []string `json:"roles"`
	Command    string   `json:"command"`
	Expression string   `json:"expression"`
	WithCheck  string   `json:"with_check"`
}

// SupabaseFunction represents a Supabase function
type SupabaseFunction struct {
	SchemaName   string `json:"schema_name"`
	FunctionName string `json:"function_name"`
	ReturnType   string `json:"return_type"`
	Arguments    string `json:"arguments"`
}
