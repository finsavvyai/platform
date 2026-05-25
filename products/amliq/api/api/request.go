package api

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const maxBodySize = 1 << 20 // 1 MB

func DecodeJSON(r *http.Request, v interface{}) error {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodySize)
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

func ReadBody(r *http.Request) ([]byte, error) {
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodySize)
	defer r.Body.Close()
	return io.ReadAll(r.Body)
}

func PathParam(r *http.Request, key string) string {
	return r.PathValue(key)
}

func QueryParam(r *http.Request, key string) string {
	return r.URL.Query().Get(key)
}

func BearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	parts := strings.Fields(auth)
	if len(parts) == 2 && parts[0] == "Bearer" {
		return parts[1]
	}
	return ""
}

func APIKey(r *http.Request) string {
	return r.Header.Get("X-API-Key")
}
