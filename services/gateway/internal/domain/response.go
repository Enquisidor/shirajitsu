package domain

// AnalyzeResponse is the domain object returned by the gateway for a completed analysis.
type AnalyzeResponse struct {
	AnalysisID      string       `json:"analysisId"`
	RegistryVersion string       `json:"registryVersion"`
	SessionStats    SessionStats `json:"sessionStats"`
	FailedClaims    []FailedClaim `json:"failedClaims"`
	Annotations     []Annotation `json:"annotations"`
}

// SessionStats summarises the outcome of one analysis run.
type SessionStats struct {
	TotalClaims      int `json:"totalClaims"`
	SuccessfulClaims int `json:"successfulClaims"`
	FailedClaims     int `json:"failedClaims"`
	TotalTokens      int `json:"totalTokens"`
	TotalSources     int `json:"totalSources"`
}

// FailedClaim records a claim that could not be annotated.
type FailedClaim struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

// Annotation is the gateway-level representation of a single annotated claim.
type Annotation struct {
	Claim           ClaimSummary   `json:"claim"`
	State           string         `json:"state"`
	TensionRating   *TensionRating `json:"tensionRating"`
	Sources         []SourceResult `json:"sources"`
	CommentaryItems []interface{}  `json:"commentaryItems"`
	GeneratedAt     string         `json:"generatedAt"`
	EvaluationFailed bool          `json:"evaluationFailed"`
}

// ClaimSummary is the claim fields surfaced inside each Annotation.
type ClaimSummary struct {
	ClaimText     string `json:"claimText"`
	CharOffset    int    `json:"charOffset"`
	CharLength    int    `json:"charLength"`
	RiskLevel     string `json:"riskLevel"`
	RiskReasoning string `json:"riskReasoning"`
	SearchQuery   string `json:"searchQuery"`
}

// TensionRating carries the tension score for a claim.
type TensionRating struct {
	Score       float64 `json:"score"`
	SourceCount int     `json:"sourceCount"`
	Label       string  `json:"label"`
}

// SourceResult is the gateway-level representation of an evaluated source.
type SourceResult struct {
	URL             string   `json:"url"`
	Title           string   `json:"title"`
	Tier            string   `json:"tier"`
	TierLabel       string   `json:"tierLabel"`
	Summary         string   `json:"summary"`
	Accessible      bool     `json:"accessible"`
	RelevanceScore  float64  `json:"relevanceScore"`
	DivergenceScore *float64 `json:"divergenceScore"`
}
