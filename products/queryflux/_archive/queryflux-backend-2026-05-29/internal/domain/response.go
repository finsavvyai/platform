package domain

// APIResponse wraps all API responses for frontend compatibility.
type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

func SuccessResponse(data interface{}) APIResponse {
	return APIResponse{Success: true, Data: data}
}

func SuccessMessageResponse(data interface{}, message string) APIResponse {
	return APIResponse{Success: true, Data: data, Message: message}
}

func ErrorResponse(message string) APIResponse {
	return APIResponse{Success: false, Message: message}
}
