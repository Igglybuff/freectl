package search

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Favorite struct {
	Link        string `json:"link"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Repository  string `json:"repository"`
}

func getFavoritesPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("failed to get home directory: %w", err)
	}
	configDir := filepath.Join(home, ".config", "freectl")
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create config directory: %w", err)
	}
	return filepath.Join(configDir, "favourites.json"), nil
}

func LoadFavorites() ([]Favorite, error) {
	path, err := getFavoritesPath()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []Favorite{}, nil
		}
		return nil, fmt.Errorf("failed to read favorites file: %w", err)
	}

	var favorites []Favorite
	if err := json.Unmarshal(data, &favorites); err != nil {
		return nil, fmt.Errorf("failed to parse favorites file: %w", err)
	}

	return favorites, nil
}

func SaveFavorites(favorites []Favorite) error {
	path, err := getFavoritesPath()
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(favorites, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal favorites: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write favorites file: %w", err)
	}

	return nil
}

func AddFavorite(favorite Favorite) error {
	favorites, err := LoadFavorites()
	if err != nil {
		return err
	}

	// Check if already exists
	for _, f := range favorites {
		if f.Link == favorite.Link {
			return nil // Already exists
		}
	}

	favorites = append(favorites, favorite)
	return SaveFavorites(favorites)
}

func RemoveFavorite(favorite Favorite) error {
	favorites, err := LoadFavorites()
	if err != nil {
		return err
	}

	// Remove the favorite
	for i, f := range favorites {
		if f.Link == favorite.Link {
			favorites = append(favorites[:i], favorites[i+1:]...)
			break
		}
	}

	return SaveFavorites(favorites)
}

func IsFavorite(link string) (bool, error) {
	favorites, err := LoadFavorites()
	if err != nil {
		return false, err
	}

	for _, f := range favorites {
		if f.Link == link {
			return true, nil
		}
	}

	return false, nil
}
