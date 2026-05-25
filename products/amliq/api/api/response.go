package api

import (
	"encoding/json"
	"net/http"
	"time"
)

type SuccessResponse struct {
	Data      interface{} `json:"data"`
	Timestamp int64       `json:"timestamp"`
}

type ErrorResponse struct {
	Error      string `json:"error"`
	Code       string `json:"code"`
	Details    string `json:"details,omitempty"`
	UpgradeURL string `json:"upgrade_url,omitempty"`
}

func Success(w http.ResponseWriter, data interface{}, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(SuccessResponse{
		Data:      data,
		Timestamp: time.Now().Unix(),
	})
}

func Error(w http.ResponseWriter, code, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error: message,
		Code:  code,
	})
}

// PaywallError emits a 402 with an upgrade_url so the dashboard can
// render a one-click checkout button instead of a dead-end error.
// upgradeURL is computed via UpgradeCheckoutURL so the value can be
// overridden by env in production.
func PaywallError(w http.ResponseWriter, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusPaymentRequired)
	json.NewEncoder(w).Encode(ErrorResponse{
		Error:      message,
		Code:       code,
		UpgradeURL: UpgradeCheckoutURL(),
	})
}

func Paginated(w http.ResponseWriter, data interface{}, total int64, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	resp := map[string]interface{}{
		"data":  data,
		"total": total,
	}
	json.NewEncoder(w).Encode(resp)
}
