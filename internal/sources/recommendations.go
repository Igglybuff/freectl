package sources

// RecommendedSource represents a suggested data source that users can add
type RecommendedSource struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// GetRecommendedSources returns a curated list of recommended data sources
func GetRecommendedSources() []RecommendedSource {
	return []RecommendedSource{
		{
			Name:        "Awesome Lists",
			URL:         "https://github.com/sindresorhus/awesome",
			Type:        "git",
			Description: "A curated list of awesome lists",
			Category:    "Curated Lists",
		},
		{
			Name:        "Awesome Sysadmin",
			URL:         "https://github.com/kahun/awesome-sysadmin",
			Type:        "git",
			Description: "A curated list of awesome open source sysadmin resources",
			Category:    "System Administration",
		},
		{
			Name:        "Awesome Selfhosted",
			URL:         "https://github.com/awesome-selfhosted/awesome-selfhosted",
			Type:        "git",
			Description: "A list of self-hosted services and software",
			Category:    "Self Hosting",
		},
		{
			Name:        "Awesome Rust",
			URL:         "https://github.com/rust-unofficial/awesome-rust",
			Type:        "git",
			Description: "A curated list of Rust code and resources",
			Category:    "Programming",
		},
		{
			Name:        "Awesome Go",
			URL:         "https://github.com/avelino/awesome-go",
			Type:        "git",
			Description: "A curated list of awesome Go frameworks, libraries and software",
			Category:    "Programming",
		},
	}
}
