package search

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
)

const googleCSEBase = "https://www.googleapis.com/customsearch/v1"

// GoogleCSEProvider implements Provider using the Google Custom Search API.
type GoogleCSEProvider struct {
	apiKey string
	cseID  string
	client *http.Client
}

// NewGoogleCSEProvider constructs a GoogleCSEProvider from the given config.
// apiKey and cseID are loaded from SEARCH_API_KEY and GOOGLE_CSE_ID environment
// variables respectively — never hardcoded.
func NewGoogleCSEProvider(apiKey, cseID string) *GoogleCSEProvider {
	return &GoogleCSEProvider{
		apiKey: apiKey,
		cseID:  cseID,
		client: &http.Client{},
	}
}

func (p *GoogleCSEProvider) Name() string { return "google-cse" }

// Search calls the Google Custom Search JSON API and returns up to maxResults items.
// maxResults is bounded to 10 by the API; callers must not rely on receiving more.
func (p *GoogleCSEProvider) Search(ctx context.Context, query string, maxResults int) ([]Result, error) {
	if maxResults > 10 {
		maxResults = 10 // Google CSE API maximum per request
	}

	params := url.Values{}
	params.Set("key", p.apiKey)
	params.Set("cx", p.cseID)
	params.Set("q", query)
	params.Set("num", fmt.Sprintf("%d", maxResults))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, googleCSEBase+"?"+params.Encode(), nil)
	if err != nil {
		return nil, fmt.Errorf("google-cse: build request: %w", err)
	}

	resp, err := p.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("google-cse: request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google-cse: API returned %d", resp.StatusCode)
	}

	var body struct {
		Items []struct {
			Link    string `json:"link"`
			Title   string `json:"title"`
			Snippet string `json:"snippet"`
		} `json:"items"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("google-cse: decode response: %w", err)
	}

	results := make([]Result, 0, len(body.Items))
	for _, item := range body.Items {
		results = append(results, Result{
			URL:     item.Link,
			Title:   item.Title,
			Snippet: item.Snippet,
		})
	}
	return results, nil
}
