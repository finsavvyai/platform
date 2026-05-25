package voice

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
)

const groqWhisperEndpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
const groqWhisperModel = "whisper-large-v3"

// transcribeGroq uploads the audio file to Groq's Whisper endpoint
// and returns the recognized text. Uses GROQ_API_KEY from env;
// caller already verified the var is set before reaching here.
func transcribeGroq(ctx context.Context, audioPath string) (string, error) {
	body, contentType, err := buildMultipartBody(audioPath)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, groqWhisperEndpoint, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+os.Getenv("GROQ_API_KEY"))
	req.Header.Set("Content-Type", contentType)
	c := &http.Client{Timeout: timeoutForTranscription}
	resp, err := c.Do(req)
	if err != nil {
		return "", fmt.Errorf("voice listen: groq HTTP: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("voice listen: groq %d: %s", resp.StatusCode, raw)
	}
	var out struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", fmt.Errorf("voice listen: groq decode: %w", err)
	}
	return strings.TrimSpace(out.Text), nil
}

func buildMultipartBody(audioPath string) (*bytes.Buffer, string, error) {
	buf := &bytes.Buffer{}
	mw := multipart.NewWriter(buf)
	if err := mw.WriteField("model", groqWhisperModel); err != nil {
		return nil, "", err
	}
	f, err := os.Open(audioPath) // #nosec G304 -- caller-controlled tmp path
	if err != nil {
		return nil, "", err
	}
	defer f.Close()
	fw, err := mw.CreateFormFile("file", "in.wav")
	if err != nil {
		return nil, "", err
	}
	if _, err := io.Copy(fw, f); err != nil {
		return nil, "", err
	}
	if err := mw.Close(); err != nil {
		return nil, "", err
	}
	return buf, mw.FormDataContentType(), nil
}
