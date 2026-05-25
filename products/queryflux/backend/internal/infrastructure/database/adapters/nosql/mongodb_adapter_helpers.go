package nosql

import (
	"fmt"
	"strconv"
	"time"
)

// Helper functions for type conversion
func toUint64(v interface{}) (uint64, error) {
	switch val := v.(type) {
	case int:
		return uint64(val), nil
	case int32:
		return uint64(val), nil
	case int64:
		return uint64(val), nil
	case uint64:
		return val, nil
	case float64:
		return uint64(val), nil
	case string:
		i, err := strconv.ParseUint(val, 10, 64)
		return i, err
	default:
		return 0, fmt.Errorf("invalid type for uint64")
	}
}

func toDuration(v interface{}) (time.Duration, error) {
	switch val := v.(type) {
	case string:
		return time.ParseDuration(val)
	case int:
		return time.Duration(val), nil
	case int64:
		return time.Duration(val), nil
	case float64:
		return time.Duration(val), nil
	default:
		return 0, fmt.Errorf("invalid type for duration")
	}
}
