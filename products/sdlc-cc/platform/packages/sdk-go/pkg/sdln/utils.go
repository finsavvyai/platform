package sdln

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"time"
)

// ========================================
// Utility Functions
// ========================================

// GetEnv retrieves an environment variable with a default value
func GetEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// GetEnvAsDuration retrieves an environment variable as a time.Duration
func GetEnvAsDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		duration, err := time.ParseDuration(value)
		if err == nil {
			return duration
		}
	}
	return defaultValue
}

// GetEnvAsBool retrieves an environment variable as a boolean
func GetEnvAsBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return strings.ToLower(value) == "true" || value == "1"
	}
	return defaultValue
}

// GetEnvAsInt retrieves an environment variable as an integer
func GetEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		var result int
		_, err := fmt.Sscanf(value, "%d", &result)
		if err == nil {
			return result
		}
	}
	return defaultValue
}

// ========================================
// String Utilities
// ========================================

// ToSnakeCase converts a string from CamelCase or PascalCase to snake_case
func ToSnakeCase(s string) string {
	var result []rune
	for i, r := range s {
		if i > 0 && 'A' <= r && r <= 'Z' {
			result = append(result, '_')
		}
		result = append(result, 'a'+(r-'A'))
	}
	return string(result)
}

// ToCamelCase converts a string from snake_case to CamelCase
func ToCamelCase(s string) string {
	words := strings.Split(s, "_")
	for i, word := range words {
		if i > 0 {
			words[i] = strings.Title(word)
		}
	}
	return strings.Join(words, "")
}

// ToPascalCase converts a string from snake_case to PascalCase
func ToPascalCase(s string) string {
	words := strings.Split(s, "_")
	for i, word := range words {
		words[i] = strings.Title(word)
	}
	return strings.Join(words, "")
}

// ToKebabCase converts a string from snake_case to kebab-case
func ToKebabCase(s string) string {
	return strings.ReplaceAll(s, "_", "-")
}

// TruncateString truncates a string to the specified length
func TruncateString(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// SanitizeString removes non-alphanumeric characters from a string
func SanitizeString(s string) string {
	var result strings.Builder
	for _, r := range s {
		if ('a' <= r && r <= 'z') || ('A' <= r && r <= 'Z') || ('0' <= r && r <= '9') {
			result.WriteRune(r)
		}
	}
	return result.String()
}

// ========================================
// File Utilities
// ========================================

// EnsureDir ensures a directory exists, creating it if necessary
func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// FileExists checks if a file exists
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// DirExists checks if a directory exists
func DirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// ReadFile reads the entire contents of a file
func ReadFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}

// WriteFile writes data to a file, creating directories as needed
func WriteFile(path string, data []byte, perm os.FileMode) error {
	// Ensure directory exists
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	return os.WriteFile(path, data, perm)
}

// AppendFile appends data to a file, creating it if it doesn't exist
func AppendFile(path string, data []byte, perm os.FileMode) error {
	// Ensure directory exists
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, perm)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(data)
	return err
}

// CopyFile copies a file from source to destination
func CopyFile(src, dst string) error {
	source, err := os.Open(src)
	if err != nil {
		return fmt.Errorf("failed to open source file: %w", err)
	}
	defer source.Close()

	// Ensure destination directory exists
	if err := EnsureDir(filepath.Dir(dst)); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	destination, err := os.Create(dst)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer destination.Close()

	_, err = io.Copy(destination, source)
	return err
}

// MoveFile moves a file from source to destination
func MoveFile(src, dst string) error {
	// Ensure destination directory exists
	if err := EnsureDir(filepath.Dir(dst)); err != nil {
		return fmt.Errorf("failed to create destination directory: %w", err)
	}

	return os.Rename(src, dst)
}

// DeleteFile removes a file if it exists
func DeleteFile(path string) error {
	if FileExists(path) {
		return os.Remove(path)
	}
	return nil
}

// GetFileSize returns the size of a file
func GetFileSize(path string) (int64, error) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

// ========================================
// JSON Utilities
// ========================================

// ToJSON converts any value to JSON bytes
func ToJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// ToJSONString converts any value to a JSON string
func ToJSONString(v interface{}) (string, error) {
	data, err := ToJSON(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// FromJSON converts JSON bytes to a value
func FromJSON(data []byte, v interface{}) error {
	return json.Unmarshal(data, v)
}

// FromJSONString converts a JSON string to a value
func FromJSONString(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}

// ToJSONPretty converts any value to pretty-printed JSON
func ToJSONPretty(v interface{}) ([]byte, error) {
	return json.MarshalIndent(v, "", "  ")
}

// ToJSONPrettyString converts any value to a pretty-printed JSON string
func ToJSONPrettyString(v interface{}) (string, error) {
	data, err := ToJSONPretty(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// ========================================
// HTTP Utilities
// ========================================

// CreateHTTPRequest creates a new HTTP request
func CreateHTTPRequest(method, url string, body io.Reader) (*http.Request, error) {
	return http.NewRequestWithContext(context.Background(), method, url, body)
}

// ExecuteHTTPRequest executes an HTTP request and returns the response
func ExecuteHTTPRequest(req *http.Request) (*http.Response, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}
	return client.Do(req)
}

// ExecuteHTTPRequestWithTimeout executes an HTTP request with a custom timeout
func ExecuteHTTPRequestWithTimeout(req *http.Request, timeout time.Duration) (*http.Response, error) {
	client := &http.Client{
		Timeout: timeout,
	}
	return client.Do(req)
}

// ========================================
// Reflection Utilities
// ========================================

// GetTypeName returns the type name of a value
func GetTypeName(v interface{}) string {
	t := reflect.TypeOf(v)
	return t.String()
}

// GetStructFields returns a map of struct field names to values
func GetStructFields(v interface{}) map[string]interface{} {
	result := make(map[string]interface{})

	val := reflect.ValueOf(v)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		return result
	}

	typ := val.Type()
	for i := 0; i < val.NumField(); i++ {
		field := typ.Field(i)
		fieldValue := val.Field(i)

		// Skip unexported fields
		if field.PkgPath != "" {
			continue
		}

		fieldName := field.Name
		var fieldVal interface{}

		switch fieldValue.Kind() {
		case reflect.String:
			fieldVal = fieldValue.String()
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			fieldVal = fieldValue.Int()
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			fieldVal = fieldValue.Uint()
		case reflect.Float32, reflect.Float64:
			fieldVal = fieldValue.Float()
		case reflect.Bool:
			fieldVal = fieldValue.Bool()
		case reflect.Slice, reflect.Array:
			if fieldValue.Type().Elem().Kind() == reflect.Uint8 {
				fieldVal = fieldValue.Bytes()
			} else {
				fieldVal = fieldValue.Interface()
			}
		case reflect.Map:
			fieldVal = fieldValue.Interface()
		case reflect.Struct:
			if fieldValue.Type().String() == "Time" {
				fieldVal = fieldValue.Interface()
			} else {
				fieldVal = GetStructFields(fieldValue.Interface())
			}
		case reflect.Ptr:
			if !fieldValue.IsNil() {
				fieldVal = GetStructFields(fieldValue.Interface())
			}
		default:
			fieldVal = fieldValue.Interface()
		}

		result[fieldName] = fieldVal
	}

	return result
}

// SetStructField sets a struct field value using reflection
func SetStructField(v interface{}, fieldName string, value interface{}) error {
	val := reflect.ValueOf(v)
	if val.Kind() == reflect.Ptr {
		val = val.Elem()
	}

	if val.Kind() != reflect.Struct {
		return fmt.Errorf("value is not a struct")
	}

	field := val.FieldByName(fieldName)
	if !field.IsValid() || !field.CanSet() {
		return fmt.Errorf("field %s not found or not settable", fieldName)
	}

	fieldVal := reflect.ValueOf(value)
	if !fieldVal.Type().AssignableTo(field.Type()) {
		return fmt.Errorf("value type %s is not assignable to field type %s", fieldVal.Type(), field.Type())
	}

	field.Set(fieldVal)
	return nil
}

// ========================================
// Timestamp Utilities
// ========================================

// NowUTC returns the current UTC time
func NowUTC() Timestamp {
	return Timestamp(time.Now().UTC())
}

// NewTimestamp creates a new Timestamp from a time.Time
func NewTimestamp(t time.Time) Timestamp {
	return Timestamp(t.UTC())
}

// NewTimestampFromUnix creates a new Timestamp from a Unix timestamp
func NewTimestampFromUnix(sec int64) Timestamp {
	return Timestamp(time.Unix(sec, 0).UTC())
}

// NewTimestampNow creates a new Timestamp with the current time
func NewTimestampNow() Timestamp {
	return Timestamp(time.Now().UTC())
}

// UnixNow returns the current Unix timestamp
func UnixNow() int64 {
	return time.Now().Unix()
}

// UnixToTime converts a Unix timestamp to Time
func UnixToTime(timestamp int64) Timestamp {
	return Timestamp(time.Unix(timestamp, 0).UTC())
}

// TimeFromDuration creates a Timestamp from a duration
func TimeFromDuration(d time.Duration) Timestamp {
	return Timestamp(time.Now().Add(d))
}

// DurationSince returns the duration since a given time
func DurationSince(t Timestamp) time.Duration {
	return time.Since(time.Time(t))
}

// FormatDuration formats a duration in a human-readable way
func FormatDuration(d time.Duration) string {
	if d < time.Microsecond {
		return fmt.Sprintf("%d ns", d.Nanoseconds())
	}
	if d < time.Millisecond {
		return fmt.Sprintf("%.1f µs", float64(d.Nanoseconds())/1000)
	}
	if d < time.Second {
		return fmt.Sprintf("%.1f ms", float64(d.Nanoseconds())/1000000)
	}
	if d < time.Minute {
		return fmt.Sprintf("%.1f s", float64(d.Nanoseconds())/1000000000)
	}
	if d < time.Hour {
		return fmt.Sprintf("%.1f m", d.Minutes())
	}
	if d < 24*time.Hour {
		return fmt.Sprintf("%.1f h", d.Hours())
	}
	return fmt.Sprintf("%.1f days", d.Hours()/24)
}

// ========================================
// Validation Utilities
// ========================================

// IsEmpty checks if a string is empty or whitespace
func IsEmpty(s string) bool {
	return strings.TrimSpace(s) == ""
}

// IsValidEmail checks if a string is a valid email address
func IsValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".") &&
		!strings.HasPrefix(email, "@") && !strings.HasSuffix(email, "@")
}

// IsValidURL checks if a string is a valid URL
func IsValidURL(url string) bool {
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://")
}

// IsJSON checks if a string is valid JSON
func IsJSON(s string) bool {
	var js interface{}
	return json.Unmarshal([]byte(s), &js) == nil
}

// Min returns the minimum of two integers
func Min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Max returns the maximum of two integers
func Max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// Clamp clamps a value between min and max
func Clamp(value, min, max int) int {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// ========================================
// Collection Utilities
// ========================================

// Contains checks if a slice contains a value
func Contains(slice []string, value string) bool {
	for _, item := range slice {
		if item == value {
			return true
		}
	}
	return false
}

// ContainsAny checks if a slice contains any of the specified values
func ContainsAny(slice []string, values []string) bool {
	for _, value := range values {
		if Contains(slice, value) {
			return true
		}
	}
	return false
}

// Unique removes duplicates from a slice of strings
func Unique(slice []string) []string {
	keys := make(map[string]bool)
	result := make([]string, 0, len(slice))

	for _, item := range slice {
		if !keys[item] {
			keys[item] = true
			result = append(result, item)
		}
	}

	return result
}

// FilterStrings filters a slice based on a predicate function (renamed to avoid conflict with Filter type)
func FilterStrings(slice []string, predicate func(string) bool) []string {
	result := make([]string, 0, len(slice))
	for _, item := range slice {
		if predicate(item) {
			result = append(result, item)
		}
	}
	return result
}

// Map applies a function to each element of a slice
func Map(slice []string, fn func(string) string) []string {
	result := make([]string, len(slice))
	for i, item := range slice {
		result[i] = fn(item)
	}
	return result
}

// Reduce reduces a slice to a single value
func Reduce(slice []string, initial string, fn func(string, string) string) string {
	result := initial
	for _, item := range slice {
		result = fn(result, item)
	}
	return result
}

// ========================================
// Error Utilities
// ========================================

// JoinErrors joins multiple errors into a single error
func JoinErrors(errs ...error) error {
	var messages []string
	for _, err := range errs {
		if err != nil {
			messages = append(messages, err.Error())
		}
	}
	if len(messages) == 0 {
		return nil
	}
	return errors.New(strings.Join(messages, "; "))
}

// IsTimeout reports whether err signals a network/timeout condition.
// The original implementation referenced a non-existent `*TimestampoutError`
// type; until a real timeout error type is defined, fall back to a
// substring check matching IsNetworkError's behavior so callers don't get
// a build error.
func IsTimeout(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline exceeded")
}

// IsNetworkError checks if an error is a network error
func IsNetworkError(err error) bool {
	return strings.Contains(err.Error(), "connection") ||
		strings.Contains(err.Error(), "timeout") ||
		strings.Contains(err.Error(), "network")
}

// IsNotFoundError checks if an error is a "not found" error
func IsNotFoundError(err error) bool {
	return strings.Contains(err.Error(), "not found") ||
		strings.Contains(err.Error(), "does not exist")
}

// ========================================
// Context Utilities
// ========================================

// WithTimeout adds a timeout to a context
func WithTimeout(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(parent, timeout)
}

// WithCancel adds cancellation to a context
func WithCancel(parent context.Context) (context.Context, context.CancelFunc) {
	return context.WithCancel(parent)
}

// WithValue adds a value to a context
func WithValue(parent context.Context, key, value interface{}) context.Context {
	return context.WithValue(parent, key, value)
}

// GetValue retrieves a value from a context
func GetValue(ctx context.Context, key interface{}) (interface{}, bool) {
	v := ctx.Value(key)
	return v, v != nil
}

// ========================================
// Debug Utilities
// ========================================

// DebugPrint prints debug information if debug mode is enabled
func DebugPrint(format string, args ...interface{}) {
	if GetEnvAsBool("DEBUG", false) {
		fmt.Printf("[DEBUG] "+format+"\n", args...)
	}
}

// DebugPrintf prints formatted debug information if debug mode is enabled
func DebugPrintf(format string, args ...interface{}) {
	if GetEnvAsBool("DEBUG", false) {
		fmt.Printf("[DEBUG] "+format, args...)
	}
}

// PrintJSON prints data as JSON if debug mode is enabled
func PrintJSON(data interface{}) error {
	if GetEnvAsBool("DEBUG", false) {
		jsonData, err := ToJSONPretty(data)
		if err != nil {
			return err
		}
		fmt.Printf("[DEBUG] JSON:\n%s\n", string(jsonData))
	}
	return nil
}

// PrintStruct prints struct information if debug mode is enabled
func PrintStruct(v interface{}) error {
	if GetEnvAsBool("DEBUG", false) {
		fields := GetStructFields(v)
		jsonData, err := ToJSONPretty(fields)
		if err != nil {
			return err
		}
		fmt.Printf("[DEBUG] Struct (%s):\n%s\n", GetTypeName(v), string(jsonData))
	}
	return nil
}

// ========================================
// Performance Utilities
// ========================================

// TimeFunction measures execution time of a function
func TimeFunction(fn func() error) (time.Duration, error) {
	start := time.Now()
	err := fn()
	return time.Since(start), err
}

// TimeFunctionValue measures execution time of a function that returns a value
func TimeFunctionValue[T any](fn func() (T, error)) (T, time.Duration, error) {
	start := time.Now()
	result, err := fn()
	return result, time.Since(start), err
}

// resultWrapper holds function result and error for timeout handling
type resultWrapper[T any] struct {
	result T
	err    error
}

// TimeFunctionValueWithTimeout measures execution time with timeout
func TimeFunctionValueWithTimeout[T any](fn func() (T, error), timeout time.Duration) (T, time.Duration, error) {
	start := time.Now()

	done := make(chan resultWrapper[T], 1)

	go func() {
		result, err := fn()
		select {
		case done <- resultWrapper[T]{result: result, err: err}:
		case <-time.After(timeout):
			done <- resultWrapper[T]{result: *new(T), err: fmt.Errorf("timeout after %v", timeout)}
		}
	}()

	wrapper := <-done
	close(done)

	return wrapper.result, time.Since(start), wrapper.err
}

// Memoize creates a memoized version of a function
func Memoize[T any, R any](fn func(T) R) func(T) R {
	cache := make(map[string]R)

	return func(input T) R {
		key := fmt.Sprintf("%v", input)
		if result, exists := cache[key]; exists {
			return result
		}

		result := fn(input)
		cache[key] = result
		return result
	}
}

// ========================================
// Conversion Utilities
// ========================================

// ToString safely converts any value to a string
func ToString(v interface{}) string {
	switch val := v.(type) {
	case string:
		return val
	case []byte:
		return string(val)
	case int:
		return fmt.Sprintf("%d", val)
	case int64:
		return fmt.Sprintf("%d", val)
	case float64:
		return fmt.Sprintf("%f", val)
	case bool:
		return fmt.Sprintf("%t", val)
	case nil:
		return ""
	default:
		return fmt.Sprintf("%v", v)
	}
}

// ToInt safely converts any value to an integer
func ToInt(v interface{}) int {
	switch val := v.(type) {
	case int:
		return val
	case int64:
		return int(val)
	case float64:
		return int(val)
	case string:
		var i int
		if _, err := fmt.Sscanf(val, "%d", &i); err == nil {
			return i
		}
		return 0
	case bool:
		if val {
			return 1
		}
		return 0
	default:
		return 0
	}
}

// ToFloat64 safely converts any value to a float64
func ToFloat64(v interface{}) float64 {
	switch val := v.(type) {
	case float64:
		return val
	case int:
		return float64(val)
	case int64:
		return float64(val)
	case string:
		var f float64
		if _, err := fmt.Sscanf(val, "%f", &f); err == nil {
			return f
		}
		return 0.0
	case bool:
		if val {
			return 1.0
		}
		return 0.0
	default:
		return 0.0
	}
}

// ToBool safely converts any value to a boolean
func ToBool(v interface{}) bool {
	switch val := v.(type) {
	case bool:
		return val
	case string:
		return strings.ToLower(val) == "true" || val == "1"
	case int:
		return val != 0
	case int64:
		return val != 0
	case float64:
		return val != 0
	default:
		return false
	}
}
