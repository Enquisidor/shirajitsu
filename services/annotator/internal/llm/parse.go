package llm

import (
	"encoding/json"
	"fmt"
	"strings"
)

// rawSourceScore mirrors the JSON shape returned by the LLM.
type rawSourceScore struct {
	SourceIndex     int      `json:"sourceIndex"`
	RelevanceScore  float64  `json:"relevanceScore"`
	DivergenceScore *float64 `json:"divergenceScore"`
}

// parseSourceScores parses the LLM's JSON text response into []SourceScore.
// It handles:
//   - JSON wrapped in markdown fences (```json ... ``` or ``` ... ```)
//   - Empty array (valid)
//   - Malformed JSON (returns error)
func parseSourceScores(raw string) ([]SourceScore, error) {
	raw = strings.TrimSpace(raw)

	// Strip markdown fences if present
	if strings.HasPrefix(raw, "```") {
		// Remove opening fence (```json or ```)
		raw = raw[3:]
		if strings.HasPrefix(raw, "json") {
			raw = raw[4:]
		}
		// Remove closing fence
		if idx := strings.LastIndex(raw, "```"); idx != -1 {
			raw = raw[:idx]
		}
		raw = strings.TrimSpace(raw)
	}

	var items []rawSourceScore
	if err := json.Unmarshal([]byte(raw), &items); err != nil {
		return nil, fmt.Errorf("could not parse source scores from LLM response: %w (raw: %s)", err, raw[:min(len(raw), 200)])
	}

	scores := make([]SourceScore, len(items))
	for i, item := range items {
		scores[i] = SourceScore{
			SourceIndex:     item.SourceIndex,
			RelevanceScore:  item.RelevanceScore,
			DivergenceScore: item.DivergenceScore,
		}
	}
	return scores, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
