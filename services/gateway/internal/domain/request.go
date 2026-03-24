package domain

import "errors"

// Context represents whether the analysis is from a writer or reader perspective.
type Context string

const (
	ContextWriter Context = "writer"
	ContextReader Context = "reader"
)

// AIModel carries the user's model selection. Empty fields mean "use service default".
type AIModel struct {
	Provider string `json:"provider"` // e.g. "anthropic"
	ModelID  string `json:"modelId"`  // e.g. "claude-sonnet-4-20250514"
}

// AnalyzeRequest is the domain object representing an incoming analysis request.
type AnalyzeRequest struct {
	Text           string
	Context        Context
	PlatformUserID string   // hashed; empty for user-JWT auth
	Model          *AIModel // nil = use the claim-extractor's configured default
}

func (r AnalyzeRequest) Validate() error {
	if r.Text == "" {
		return errors.New("text must not be empty")
	}
	if r.Context != ContextWriter && r.Context != ContextReader {
		return errors.New("context must be 'writer' or 'reader'")
	}
	return nil
}
