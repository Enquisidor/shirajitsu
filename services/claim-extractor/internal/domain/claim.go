package domain

// RiskLevel represents the assessed verification risk of a claim.
type RiskLevel string

const (
	RiskHigh   RiskLevel = "high"
	RiskMedium RiskLevel = "medium"
	RiskLow    RiskLevel = "low"
)

// Claim is a discrete, checkable factual assertion extracted from text.
// It is never an opinion, framing, or rhetorical assertion.
type Claim struct {
	ClaimText    string    `json:"claimText"`
	CharOffset   int       `json:"charOffset"`
	CharLength   int       `json:"charLength"`
	RiskLevel    RiskLevel `json:"riskLevel"`
	RiskReasoning string   `json:"riskReasoning"`
	SearchQuery  string    `json:"searchQuery"`
}
