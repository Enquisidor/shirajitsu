package llm

import (
	"fmt"
	"strings"
)

// SystemPrompt instructs the LLM on how to evaluate sources.
const SystemPrompt = `You are a source relevance and divergence evaluator. Your job is to assess, for each provided source, how relevant it is to a given claim and how differently it frames the claim relative to the claim's assertion.

For each source return:
- relevanceScore: 0.0–1.0 — how relevant the source is to the claim (0.0 = unrelated, 1.0 = directly addresses the claim)
- divergenceScore: 0.0–1.0 — how differently the source frames the claim relative to the claim's assertion (0.0 = aligns fully, 1.0 = frames the claim substantially differently). Return null for community-verified and tier3 sources — only score divergence for tier1 and tier2 sources.

Output ONLY a JSON array — no prose, no markdown fences. Each element must have: sourceIndex (integer), relevanceScore (float), divergenceScore (float or null).`

// buildUserPrompt constructs the user-facing prompt from the claim text and sources.
func buildUserPrompt(claimText string, sources []SourceSummary) string {
	var sb strings.Builder
	sb.WriteString("Claim:\n")
	sb.WriteString(claimText)
	sb.WriteString("\n\nSources:\n")
	for _, s := range sources {
		sb.WriteString(fmt.Sprintf("[%d] Title: %s\n    URL: %s\n    Tier: %s\n    Excerpt: %s\n\n",
			s.Index, s.Title, s.URL, s.Tier, s.Snippet))
	}
	return sb.String()
}
