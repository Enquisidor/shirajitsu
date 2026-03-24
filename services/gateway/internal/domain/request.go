package domain

import "errors"

// Context represents whether the analysis is from a writer or reader perspective.
type Context string

const (
	ContextWriter Context = "writer"
	ContextReader Context = "reader"
)

// AnalyzeRequest is the domain object representing an incoming analysis request.
type AnalyzeRequest struct {
	Text           string
	Context        Context
	PlatformUserID string // hashed; empty for user-JWT auth
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
