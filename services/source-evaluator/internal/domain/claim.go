package domain

// Claim is a discrete, checkable factual claim received from the gateway.
// It is forwarded from the claim-extractor output without modification.
type Claim struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

// CommentaryItem is an item of unverified public discussion surfaced during search.
// Always labelled "unverified-public-discussion" — never presented as evidence.
type CommentaryItem struct {
	Text            string `json:"text"`
	SourceURL       string `json:"sourceUrl"`
	AnchorSourceURL string `json:"anchorSourceUrl"`
	Label           string `json:"label"`
}

// CommentaryLabel is the only valid label value for CommentaryItem.
const CommentaryLabel = "unverified-public-discussion"

// EvaluatedClaim holds the sources and commentary found for a single claim.
type EvaluatedClaim struct {
	ClaimIndex     int              `json:"claimIndex"`
	Sources        []Source         `json:"sources"`
	CommentaryItems []CommentaryItem `json:"commentaryItems"`
}
