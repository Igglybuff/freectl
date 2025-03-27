import { showToast } from './ui.js';
import { getDisplayText } from './ui.js';
import { getRepositoryColor } from './ui.js';
import { getCurrentSettings } from './settings.js';

let currentFavorites = new Set();
let allFavorites = [];
let favoriteCategories = new Set();

export function toggleFavorite(link, description, category, repository, name) {
    const isFavorite = currentFavorites.has(link);
    const endpoint = isFavorite ? '/favorites/remove' : '/favorites/add';
    const btn = document.querySelector(`.favorite-btn[data-link="${link}"]`);
    
    // Add loading state
    btn.classList.add('loading');
    
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ link, name, description, category, repository }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update favorite');
        }
        return response.json();
    })
    .then(favorites => {
        // Update the favorites list with the new data from the server
        allFavorites = favorites;
        currentFavorites = new Set(favorites.map(f => f.link));
        updateFavoriteButtons();
        updateFavoritesDisplay();
        showToast(isFavorite ? 'Removed from favorites' : 'Added to favorites');
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update favorite', true);
    })
    .finally(() => {
        // Remove loading state
        btn.classList.remove('loading');
    });
}

export function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const link = btn.getAttribute('data-link');
        btn.classList.toggle('active', currentFavorites.has(link));
    });
}

export function filterFavorites(query) {
    const selectedRepo = document.getElementById('favoriteRepoFilter').value;
    const selectedCategory = document.getElementById('favoriteCategoryFilter').value;
    query = query ? query.toLowerCase() : '';
    
    return allFavorites.filter(f => {
        const matchesQuery = !query || 
            f.description.toLowerCase().includes(query) ||
            f.category.toLowerCase().includes(query) ||
            f.link.toLowerCase().includes(query);
            
        const matchesRepo = !selectedRepo || f.repository === selectedRepo;
        const matchesCategory = !selectedCategory || f.category === selectedCategory;
        
        return matchesQuery && matchesRepo && matchesCategory;
    });
}

export function updateFavoritesDisplay() {
    const query = document.getElementById('favoritesSearchInput').value.trim();
    const filteredFavorites = filterFavorites(query);
    const favoritesDiv = document.getElementById('favorites');
    
    if (filteredFavorites.length === 0) {
        favoritesDiv.innerHTML = '<div class="no-results">No favorites found</div>';
        return;
    }

    favoritesDiv.innerHTML = filteredFavorites.map(f => createResultHTML({
        url: f.link,
        name: f.name,
        description: f.description,
        category: f.category,
        repository: f.repository || 'Unknown',
        score: f.score
    }, false)).join('');
    
    // Add event listeners for description toggles
    addDescriptionToggleListeners();
    updateFavoriteButtons();
}

// Add description toggle functionality
function addDescriptionToggleListeners() {
    document.querySelectorAll('.result-description-toggle').forEach(button => {
        button.addEventListener('click', function() {
            const description = this.closest('.result-content').querySelector('.result-description');
            const isShowing = description.classList.contains('show');
            description.classList.toggle('show');
            this.classList.toggle('expanded');
        });
    });

    // Add kebab menu functionality
    document.querySelectorAll('.kebab-menu-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = this.closest('.kebab-menu');
            const content = menu.querySelector('.kebab-menu-content');
            
            // Close all other open menus
            document.querySelectorAll('.kebab-menu-content').forEach(otherContent => {
                if (otherContent !== content) {
                    otherContent.classList.remove('show');
                }
            });
            
            content.classList.toggle('show');
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.kebab-menu')) {
            document.querySelectorAll('.kebab-menu-content').forEach(content => {
                content.classList.remove('show');
            });
        }
    });

    // Handle add repository action
    document.querySelectorAll('.add-repo-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const url = this.dataset.url;
            
            // Clean the URL by removing fragments, query params, and trailing slashes
            const cleanUrl = url.split('#')[0].split('?')[0].replace(/\/$/, '');
            
            // Add loading state
            this.classList.add('loading');
            
            // Make POST request to add repository
            fetch('/repositories/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: cleanUrl }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to add repository');
                }
                showToast('Repository added successfully');
                // Close the kebab menu
                this.closest('.kebab-menu-content').classList.remove('show');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(`Failed to add repository: ${error.message}`, true);
            })
            .finally(() => {
                // Remove loading state
                this.classList.remove('loading');
            });
        });
    });

    // Handle VirusTotal scan action
    document.querySelectorAll('.scan-virustotal-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const url = this.dataset.url;
            
            // Add loading state
            this.classList.add('loading');
            
            // Make POST request to scan URL
            fetch('/scan/virustotal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to scan URL');
                }
                showToast(data.message);
                // Close the kebab menu
                this.closest('.kebab-menu-content').classList.remove('show');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(`Failed to scan URL: ${error.message}`, true);
            })
            .finally(() => {
                // Remove loading state
                this.classList.remove('loading');
            });
        });
    });
}

export function loadFavorites() {
    fetch('/favorites')
        .then(response => response.json())
        .then(favorites => {
            allFavorites = favorites;
            currentFavorites = new Set(favorites.map(f => f.link));
            updateFavoritesDisplay();
            updateFavoriteCategoryFilter();
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('Failed to load favorites', true);
        });
}

export function updateFavoriteCategoryFilter() {
    const favoriteCategoryFilter = document.getElementById('favoriteCategoryFilter');
    const categories = new Set();
    
    // Add only valid categories from favorites
    allFavorites.forEach(f => {
        // Skip invalid categories (longer than 80 characters)
        if (f.category && f.category.length <= 80) {
            categories.add(f.category || 'n/a');
        }
    });
    
    favoriteCategories = categories;

    const options = ['<option value="">All categories</option>'];
    Array.from(categories).sort().forEach(category => {
        const value = category === 'n/a' ? '' : category;
        options.push(`<option value="${value}">${category}</option>`);
    });
    
    favoriteCategoryFilter.innerHTML = options.join('');
}

function createResultHTML(result, showScore = true) {
    const isFavorite = currentFavorites.has(result.url);
    const repoColor = getRepositoryColor(result.repository, new Map());
    const currentSettings = getCurrentSettings();
    
    // Check if category is invalid
    const isInvalid = result.category && result.category.length > 80;

    // Escape the description for use in the data attribute
    const escapedDescription = result.description.replace(/"/g, '&quot;');
    const escapedName = (result.name || '').replace(/"/g, '&quot;');

    return `<div class="result-item ${isInvalid ? 'invalid-result' : ''}">
            <div class="result-content">
                <div class="result-header">
                    <div class="result-main">
                        <a href="${result.url}" class="result-link" target="_blank">
                            ${result.name || result.description}
                        </a>
                        <button class="result-description-toggle" title="Toggle description">
                            <svg class="expand-icon" viewBox="0 0 24 24">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                            <svg class="collapse-icon" viewBox="0 0 24 24">
                                <path d="M19 13H5v-2h14v2z"/>
                            </svg>
                        </button>
                        <span class="result-description" data-full-description="${escapedDescription}">${result.description}</span>
                    </div>
                    <div class="result-tags">
                        ${isInvalid ? 
                            `<div class="warning-tag">⚠️ Invalid category</div>` :
                            `<div class="category-tag">${result.category || 'n/a'}</div>`
                        }
                        <div class="repo-tag" style="background-color: ${repoColor}">${result.repository}</div>
                        <span class="result-domain">${getDisplayText(result.url)}</span>
                        <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                                data-link="${result.url}"
                                data-name="${escapedName}"
                                data-description="${escapedDescription}"
                                data-category="${(result.category || '').replace(/"/g, '&quot;')}"
                                data-repository="${result.repository.replace(/"/g, '&quot;')}"
                                ><svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></button>
                        <div class="kebab-menu">
                            <button class="kebab-menu-btn" title="More options">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                            </button>
                            <div class="kebab-menu-content">
                                <button class="add-repo-btn" data-url="${result.url}">Add repository</button>
                                <button class="scan-virustotal-btn" data-url="${result.url}">Scan with VirusTotal</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
}