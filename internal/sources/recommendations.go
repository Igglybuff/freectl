package sources

// RecommendedSource represents a suggested data source that users can add
type RecommendedSource struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	Type        string `json:"type"`
	Description string `json:"description"`
	Category    string `json:"category"`
	ID          string `json:"id"`
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
			ID:          "awesome-lists",
		},
		{
			Name:        "Awesome Sysadmin",
			URL:         "https://github.com/kahun/awesome-sysadmin",
			Type:        "git",
			Description: "A curated list of awesome open source sysadmin resources",
			Category:    "System Administration",
			ID:          "awesome-sysadmin",
		},
		{
			Name:        "Awesome Selfhosted",
			URL:         "https://github.com/awesome-selfhosted/awesome-selfhosted",
			Type:        "git",
			Description: "A list of self-hosted services and software",
			Category:    "Self Hosting",
			ID:          "awesome-selfhosted",
		},
		{
			Name:        "Awesome Rust",
			URL:         "https://github.com/rust-unofficial/awesome-rust",
			Type:        "git",
			Description: "A curated list of Rust code and resources",
			Category:    "Programming",
			ID:          "awesome-rust",
		},
		{
			Name:        "Awesome Go",
			URL:         "https://github.com/avelino/awesome-go",
			Type:        "git",
			Description: "A curated list of awesome Go frameworks, libraries and software",
			Category:    "Programming",
			ID:          "awesome-go",
		},
		{
			Name:        "FREEMEDIAHECKYEAH",
			URL:         "https://github.com/fmhy/edit",
			Type:        "git",
			Description: "The largest collection of free stuff on the internet!",
			Category:    "Free Media",
			ID:          "fmhy",
		},
		{
			Name:        "HackerNews Top 5000",
			URL:         "https://refactoringenglish.com/tools/hn-popularity/",
			Type:        "hn5000",
			Description: "The top 5000 most popular blogs and websites from HackerNews",
			Category:    "Blogs",
			ID:          "hn5000",
		},
	}
}
