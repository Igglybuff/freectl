// Add theme toggle functionality
function toggleTheme() {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

// Initialize theme from localStorage or system preference
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.setAttribute('data-theme', savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.setAttribute('data-theme', 'dark');
    }
}

// Initialize theme on page load
initializeTheme();

// Set initial active tab based on URL hash
const initialTab = window.location.hash.slice(1) || 'search';
showTab(initialTab);

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
        document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
});

const searchInput = document.getElementById('searchInput');
const repoFilter = document.getElementById('repoFilter');
const favoritesSearchInput = document.getElementById('favoritesSearchInput');
const resultsDiv = document.getElementById('results');
const favoritesDiv = document.getElementById('favorites');
let currentFavorites = new Set();
let allFavorites = [];
const errorMessage = document.getElementById('errorMessage');
let searchTimeout;
let currentPage = 1;
let totalPages = 1;
let totalResults = 0;
let currentQuery = '';
let currentResults = [];
let currentCategories = new Set();
let favoriteCategories = new Set();

// Add repository color mapping
let repositoryColors = new Map();

// Generate a consistent color for a repository name
function getRepositoryColor(repoName) {
    if (repositoryColors.has(repoName)) {
        return repositoryColors.get(repoName);
    }

    // Generate a color based on the repository name
    // We'll use HSL to ensure good contrast and saturation
    const hash = repoName.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash % 360);
    const color = `hsl(${hue}, 70%, 40%)`;
    repositoryColors.set(repoName, color);
    return color;
}

function showTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('#searchTab, #favoritesTab, #statsTab, #settingsTab').forEach(tab => {
        tab.style.display = 'none';
    });

    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab content
    document.getElementById(tabName + 'Tab').style.display = 'block';
    
    // Add active class to selected tab button
    document.querySelector(`.tab-button[data-tab="${tabName}"]`).classList.add('active');

    // Update URL hash without triggering scroll
    window.history.replaceState(null, null, `#${tabName}`);

    // Load data specific to each tab
    if (tabName === 'stats') {
        loadRepositories();
    } else if (tabName === 'favorites') {
        loadFavorites();
    } else if (tabName === 'settings') {
        loadSettings();
        loadRepositoryList();
    }
}

// Add event listeners for tab buttons
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        showTab(button.dataset.tab);
    });
});

function getDisplayText(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? '#dc3545' : '#333';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleFavorite(link, description, category, repository) {
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
        body: JSON.stringify({ link, description, category, repository }),
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

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const link = btn.getAttribute('data-link');
        btn.classList.toggle('active', currentFavorites.has(link));
    });
}

// Settings functionality
const defaultSettings = {
    minQueryLength: 2,
    maxQueryLength: 1000,
    searchDelay: 300,
    showScores: true,
    resultsPerPage: 10,
    cacheDir: '~/.local/cache/freectl',
    autoUpdate: true,
    truncateTitles: true,
    maxTitleLength: 100,
    customHeader: 'Repository Search'
};

// Initialize current settings with defaults
let currentSettings = { ...defaultSettings };

function createResultHTML(result, showScore = true) {
    const isFavorite = currentFavorites.has(result.url);
    const repoColor = getRepositoryColor(result.repository);
    
    // Truncate description if enabled
    let description = result.description;
    if (currentSettings && currentSettings.truncateTitles && description.length > currentSettings.maxTitleLength) {
        description = description.substring(0, currentSettings.maxTitleLength) + '...';
    }
    
    // Check if category is invalid
    const isInvalid = result.title.length > 80;
    
    return `
        <div class="result-item ${isInvalid ? 'invalid-result' : ''}">
            <div class="result-content">
                <div>
                    <a href="${result.url}" class="result-link" target="_blank" title="${result.description}">${description}</a>
                    <span class="result-domain">${getDisplayText(result.url)}</span>
                </div>
                ${showScore && currentSettings.showScores ? `<div class="result-score">Score: ${result.score}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${isInvalid ? 
                    `<div class="warning-tag">⚠️ Invalid category</div>` :
                    `<div class="category-tag">${result.title || 'n/a'}</div>`
                }
                <div class="repo-tag" style="background-color: ${repoColor}">${result.repository}</div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        data-link="${result.url}"
                        onclick="toggleFavorite('${result.url}', '${result.description.replace(/'/g, "\\'")}', '${result.title || ''}', '${result.repository.replace(/'/g, "\\'")}')"
                        >
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function filterFavorites(query) {
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

function updateFavoritesDisplay() {
    const query = favoritesSearchInput.value.trim();
    const filteredFavorites = filterFavorites(query);
    
    if (filteredFavorites.length === 0) {
        favoritesDiv.innerHTML = '<div class="no-results">No favorites found</div>';
        return;
    }

    favoritesDiv.innerHTML = filteredFavorites.map(f => createResultHTML({
        url: f.link,
        description: f.description,
        title: f.category,
        repository: f.repository || 'Unknown',
        score: f.score
    }, false)).join('');
    updateFavoriteButtons();
}

function loadFavorites() {
    fetch('/favorites')
        .then(response => response.json())
        .then(favorites => {
            allFavorites = favorites;
            currentFavorites = new Set(favorites.map(f => f.link));
            updateFavoritesDisplay();
            updateFavoriteCategoryFilter();
        })
        .catch(error => console.error('Error:', error));
}

// Add event listener for favorites search
favoritesSearchInput.addEventListener('input', function() {
    updateFavoritesDisplay();
});

function validateSearchInput(input) {
    const value = input.value.trim();
    
    // Check for empty input
    if (value === '') {
        input.classList.add('error');
        errorMessage.textContent = 'Please enter a search query';
        errorMessage.style.display = 'block';
        return false;
    }

    // Check for minimum length
    if (value.length < 2) {
        input.classList.add('error');
        errorMessage.textContent = 'Search query must be at least 2 characters long';
        errorMessage.style.display = 'block';
        return false;
    }

    // Check for maximum length
    if (value.length > 1000) {
        input.classList.add('error');
        errorMessage.textContent = 'Search query is too long';
        errorMessage.style.display = 'block';
        return false;
    }

    // Check for invalid characters
    if (/[<>]/.test(value)) {
        input.classList.add('error');
        errorMessage.textContent = 'Search query contains invalid characters';
        errorMessage.style.display = 'block';
        return false;
    }

    // Clear error state
    input.classList.remove('error');
    errorMessage.style.display = 'none';
    return true;
}

// Load repositories into the filter dropdown
function loadRepositoryFilter() {
    fetch('/repositories/list')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load repositories');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to load repositories');
            }

            const searchFilter = document.getElementById('repoFilter');
            const favoritesFilter = document.getElementById('favoriteRepoFilter');
            const options = '<option value="">All repositories</option>' +
                data.repositories
                    .filter(repo => repo.enabled)
                    .map(repo => `<option value="${repo.name}">${repo.name}</option>`)
                    .join('');
            
            searchFilter.innerHTML = options;
            favoritesFilter.innerHTML = options;
        })
        .catch(error => {
            console.error('Error:', error);
            const errorOption = '<option value="">Error loading repositories</option>';
            document.getElementById('repoFilter').innerHTML = errorOption;
            document.getElementById('favoriteRepoFilter').innerHTML = errorOption;
        });
}

// Add this variable to store all categories from the last search
let allSearchCategories = new Set();

function updateCategoryFilter(results, selectedCategory = '') {
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Only update the full category list if this is a new search (not a filter)
    if (!selectedCategory) {
        allSearchCategories.clear();
        // Add only valid categories from results
        results.forEach(result => {
            // Skip invalid categories (longer than 80 characters)
            if (result.title && result.title.length <= 80) {
                allSearchCategories.add(result.title || 'n/a');
            }
        });
    }
    
    const options = ['<option value="">All categories</option>'];
    Array.from(allSearchCategories).sort().forEach(category => {
        const value = category === 'n/a' ? '' : category;
        // Only mark as selected if it exactly matches the selectedCategory
        const selected = category === selectedCategory;
        options.push(`<option value="${value}"${selected ? ' selected' : ''}>${category}</option>`);
    });
    
    categoryFilter.innerHTML = options.join('');
}

function updateFavoriteCategoryFilter() {
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

// Add event listeners
document.addEventListener('DOMContentLoaded', function() {
    loadRepositoryFilter();
    
    // Add event listener for repository filter changes
    document.getElementById('repoFilter').addEventListener('change', function() {
        performSearch(1);
    });

    document.getElementById('favoriteRepoFilter').addEventListener('change', function() {
        updateFavoritesDisplay();
    });

    // Add event listener for search input
    searchInput.addEventListener('input', function() {
        const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
        clearTimeout(searchTimeout);
        if (validateSearchInput(this)) {
            searchTimeout = setTimeout(() => performSearch(1), settings.searchDelay);
        }
    });

    // Add event listener for Enter key in search input
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            clearTimeout(searchTimeout);
            if (validateSearchInput(this)) {
                performSearch(1);
            }
        }
    });

    // Add event listener for favorites search input
    favoritesSearchInput.addEventListener('input', function() {
        updateFavoritesDisplay();
    });

    // Load initial data
    loadFavorites();
    
    // Check URL hash for initial tab
    const hash = window.location.hash.slice(1);
    if (hash) {
        showTab(hash);
    }

    // Load settings when the page loads
    loadSettings();

    // Add event listeners for settings buttons
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('resetSettings').addEventListener('click', resetSettings);

    // Add event listener for truncate titles checkbox
    const truncateTitlesCheckbox = document.getElementById('truncateTitles');
    const maxTitleLengthInput = document.getElementById('maxTitleLength');
    
    truncateTitlesCheckbox.addEventListener('change', function() {
        maxTitleLengthInput.disabled = !this.checked;
        // Immediately apply the setting change
        currentSettings.truncateTitles = this.checked;
        // Re-render current results with new setting
        if (currentQuery) {
            performSearch(currentPage);
        }
    });

    // Add event listener for max title length changes
    maxTitleLengthInput.addEventListener('change', function() {
        currentSettings.maxTitleLength = parseInt(this.value);
        // Re-render current results with new setting
        if (currentQuery) {
            performSearch(currentPage);
        }
    });

    // Add event listener for category filter changes
    document.getElementById('categoryFilter').addEventListener('change', function() {
        performSearch(1);
    });

    document.getElementById('favoriteCategoryFilter').addEventListener('change', function() {
        updateFavoritesDisplay();
    });
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add repository list loading
function loadRepositories() {
    fetch('/list')
        .then(response => response.json())
        .then(repos => {
            const select = document.getElementById('statsRepo');
            select.innerHTML = repos.map(repo => 
                `<option value="${repo.name}">${repo.name}</option>`
            ).join('');
            
            // If we have repositories, select the first one and load its stats
            if (repos.length > 0) {
                select.value = repos[0].name;
                loadStats();
            }
        })
        .catch(error => {
            console.error('Error loading repositories:', error);
            const select = document.getElementById('statsRepo');
            select.innerHTML = '<option value="">Error loading repositories</option>';
        });
}

// Update loadStats function to use selected repository
function loadStats() {
    const repoName = document.getElementById('statsRepo').value;
    if (!repoName) {
        document.getElementById('totalFiles').textContent = '-';
        document.getElementById('totalLinks').textContent = '-';
        document.getElementById('repoSize').textContent = '-';
        document.getElementById('https-count').textContent = '-';
        document.getElementById('http-count').textContent = '-';
        document.getElementById('topCategories').innerHTML = 'Please select a repository';
        document.getElementById('topDomains').innerHTML = 'Please select a repository';
        return;
    }

    fetch(`/stats?repo=${encodeURIComponent(repoName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('totalFiles').textContent = data.TotalFiles;
            document.getElementById('totalLinks').textContent = data.TotalLinks;
            document.getElementById('repoSize').textContent = formatBytes(data.TotalSize);
            document.getElementById('https-count').textContent = data.ProtocolStats.https || 0;
            document.getElementById('http-count').textContent = data.ProtocolStats.http || 0;
            
            document.getElementById('topCategories').innerHTML = data.Categories
                .slice(0, 10)
                .map(cat => `
                    <div class="stats-list-item">
                        <span class="stats-list-label">${cat.Name}</span>
                        <span class="stats-list-value">${cat.LinkCount}</span>
                    </div>
                `).join('');
            
            const sortedDomains = Object.entries(data.DomainsCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);
            
            document.getElementById('topDomains').innerHTML = sortedDomains
                .map(([domain, count]) => `
                    <div class="stats-list-item">
                        <span class="stats-list-label">${domain}</span>
                        <span class="stats-list-value">${count}</span>
                    </div>
                `).join('');
        })
        .catch(error => {
            console.error('Error loading stats:', error);
            document.getElementById('totalFiles').textContent = '-';
            document.getElementById('totalLinks').textContent = '-';
            document.getElementById('repoSize').textContent = '-';
            document.getElementById('https-count').textContent = '-';
            document.getElementById('http-count').textContent = '-';
            document.getElementById('topCategories').innerHTML = 'Error loading stats';
            document.getElementById('topDomains').innerHTML = 'Error loading stats';
        });
}

// Add event listener for repository selection
document.getElementById('statsRepo').addEventListener('change', loadStats);

// Add this function to update the header text
function updateHeaderText(text) {
    document.getElementById('mainHeader').textContent = text;
    document.getElementById('pageTitle').textContent = text;
}

// Update loadSettings function to handle custom header
function loadSettings() {
    fetch('/settings')
        .then(response => response.json())
        .then(settings => {
            document.getElementById('minQueryLength').value = settings.minQueryLength;
            document.getElementById('maxQueryLength').value = settings.maxQueryLength;
            document.getElementById('searchDelay').value = settings.searchDelay;
            document.getElementById('showScores').checked = settings.showScores;
            document.getElementById('resultsPerPage').value = settings.resultsPerPage;
            document.getElementById('cacheDir').value = settings.cacheDir;
            document.getElementById('autoUpdate').checked = settings.autoUpdate;
            document.getElementById('truncateTitles').checked = settings.truncateTitles;
            document.getElementById('maxTitleLength').value = settings.maxTitleLength;
            document.getElementById('customHeader').value = settings.customHeader;
            updateHeaderText(settings.customHeader);
            currentSettings = settings;
        })
        .catch(error => {
            console.error('Error loading settings:', error);
            showToast('Failed to load settings', 'error');
        });
}

// Update saveSettings function to include custom header
function saveSettings() {
    const settings = {
        minQueryLength: parseInt(document.getElementById('minQueryLength').value),
        maxQueryLength: parseInt(document.getElementById('maxQueryLength').value),
        searchDelay: parseInt(document.getElementById('searchDelay').value),
        showScores: document.getElementById('showScores').checked,
        resultsPerPage: parseInt(document.getElementById('resultsPerPage').value),
        cacheDir: document.getElementById('cacheDir').value,
        autoUpdate: document.getElementById('autoUpdate').checked,
        truncateTitles: document.getElementById('truncateTitles').checked,
        maxTitleLength: parseInt(document.getElementById('maxTitleLength').value),
        customHeader: document.getElementById('customHeader').value
    };

    fetch('/settings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
    })
    .then(response => response.json())
    .then(savedSettings => {
        currentSettings = savedSettings;
        updateHeaderText(savedSettings.customHeader);
        showToast('Settings saved successfully');
    })
    .catch(error => {
        console.error('Error saving settings:', error);
        showToast('Failed to save settings', 'error');
    });
}

// Update resetSettings function to handle custom header
function resetSettings() {
    fetch('/settings')
        .then(response => response.json())
        .then(settings => {
            const defaultSettings = {
                minQueryLength: 2,
                maxQueryLength: 1000,
                searchDelay: 300,
                showScores: true,
                resultsPerPage: 10,
                cacheDir: '~/.local/cache/freectl',
                autoUpdate: true,
                truncateTitles: true,
                maxTitleLength: 100,
                customHeader: 'Repository Search'
            };

            // Update UI with default values
            document.getElementById('minQueryLength').value = defaultSettings.minQueryLength;
            document.getElementById('maxQueryLength').value = defaultSettings.maxQueryLength;
            document.getElementById('searchDelay').value = defaultSettings.searchDelay;
            document.getElementById('showScores').checked = defaultSettings.showScores;
            document.getElementById('resultsPerPage').value = defaultSettings.resultsPerPage;
            document.getElementById('cacheDir').value = defaultSettings.cacheDir;
            document.getElementById('autoUpdate').checked = defaultSettings.autoUpdate;
            document.getElementById('truncateTitles').checked = defaultSettings.truncateTitles;
            document.getElementById('maxTitleLength').value = defaultSettings.maxTitleLength;
            document.getElementById('customHeader').value = defaultSettings.customHeader;
            updateHeaderText(defaultSettings.customHeader);

            // Save default settings
            fetch('/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(defaultSettings)
            })
            .then(response => response.json())
            .then(savedSettings => {
                currentSettings = savedSettings;
                showToast('Settings reset to defaults');
            })
            .catch(error => {
                console.error('Error saving default settings:', error);
                showToast('Failed to save default settings', 'error');
            });
        })
        .catch(error => {
            console.error('Error resetting settings:', error);
            showToast('Failed to reset settings', 'error');
        });
}

// Update search delay based on settings
searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    if (validateSearchInput(this)) {
        searchTimeout = setTimeout(() => performSearch(1), currentSettings.searchDelay);
    }
});

function updateRepository() {
    const updateButton = document.getElementById('updateRepo');
    updateButton.disabled = true;
    updateButton.textContent = 'Updating repositories...';
    
    fetch('/update', {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update repositories');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showToast(`Repositories updated successfully in ${data.duration}`);
            // Reload stats to show updated information
            loadStats();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update repositories', true);
    })
    .finally(() => {
        updateButton.disabled = false;
        updateButton.textContent = 'Update repositories';
    });
}

// Add event listener for update button
document.getElementById('updateRepo').addEventListener('click', updateRepository);

function updatePagination() {
    const pagination = document.getElementById('pagination');
    pagination.innerHTML = '';

    // Create a container for the buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'pagination-buttons';

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.className = 'pagination-button';
    prevButton.innerHTML = '&larr;';
    prevButton.disabled = currentPage === 1;
    prevButton.onclick = () => performSearch(currentPage - 1);
    buttonContainer.appendChild(prevButton);

    // Page numbers
    const pageNumbers = document.createElement('div');
    pageNumbers.style.display = 'flex';
    pageNumbers.style.gap = '4px';

    // Calculate visible page range
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
    
    if (endPage - startPage < 4) {
        if (startPage === 1) {
            endPage = Math.min(5, totalPages);
        } else if (endPage === totalPages) {
            startPage = Math.max(1, totalPages - 4);
        }
    }

    // First page
    if (startPage > 1) {
        const firstButton = document.createElement('button');
        firstButton.className = 'pagination-button';
        firstButton.textContent = '1';
        firstButton.onclick = () => performSearch(1);
        pageNumbers.appendChild(firstButton);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 8px';
            pageNumbers.appendChild(ellipsis);
        }
    }

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-button ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i.toString();
        pageButton.onclick = () => performSearch(i);
        pageNumbers.appendChild(pageButton);
    }

    // Last page
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 8px';
            pageNumbers.appendChild(ellipsis);
        }
        const lastButton = document.createElement('button');
        lastButton.className = 'pagination-button';
        lastButton.textContent = totalPages.toString();
        lastButton.onclick = () => performSearch(totalPages);
        pageNumbers.appendChild(lastButton);
    }

    buttonContainer.appendChild(pageNumbers);

    // Next button
    const nextButton = document.createElement('button');
    nextButton.className = 'pagination-button';
    nextButton.innerHTML = '&rarr;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.onclick = () => performSearch(currentPage + 1);
    buttonContainer.appendChild(nextButton);

    // Add the button container to pagination
    pagination.appendChild(buttonContainer);

    // Page info (now below the buttons)
    const pageInfo = document.createElement('div');
    pageInfo.className = 'pagination-info';
    pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${totalResults} results)`;
    pagination.appendChild(pageInfo);
}

function performSearch(page = 1) {
    const query = searchInput.value.trim();
    if (!validateSearchInput(searchInput)) {
        return;
    }

    const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    const selectedRepo = repoFilter.value;
    const selectedCategory = categoryFilter.value;
    currentQuery = query;
    currentPage = page;
    
    resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    let url = `/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${settings.resultsPerPage}`;
    if (selectedRepo) {
        url += `&repo=${encodeURIComponent(selectedRepo)}`;
    }
    if (selectedCategory) {
        url += `&category=${encodeURIComponent(selectedCategory)}`;
    }
    
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch results');
            }
            return response.json();
        })
        .then(data => {
            if (!data || !data.results || data.results.length === 0) {
                resultsDiv.innerHTML = '<div class="no-results">No results found. Go to Settings to update your repositories.</div>';
                return;
            }

            // Store current results
            currentResults = data.results;
            
            // Only update category filter with full list on new searches, not category filters
            updateCategoryFilter(data.results, selectedCategory);

            // Display results
            resultsDiv.innerHTML = currentResults.map(result => createResultHTML(result, true)).join('');
            updateFavoriteButtons();

            // Update pagination info
            totalPages = data.total_pages;
            totalResults = data.total_results;
            updatePagination();
        })
        .catch(error => {
            console.error('Error:', error);
            resultsDiv.innerHTML = '<div class="error">Failed to fetch results. Please try again.</div>';
        });
}

// Add repository function
function addRepository() {
    const urlInput = document.getElementById('repoUrl');
    const nameInput = document.getElementById('repoName');
    const url = urlInput.value.trim();
    const name = nameInput.value.trim();

    if (!url) {
        showToast('Repository URL is required', true);
        return;
    }

    fetch('/repositories/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, name }),
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to add repository');
            }
            showToast('Repository added successfully');
            urlInput.value = '';
            nameInput.value = '';
            loadRepositoryList();
            loadRepositories(); // Refresh repository filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to add repository: ${error.message}`, true);
        });
}

// Add event listener for add repository button
document.getElementById('addRepo').addEventListener('click', addRepository);

function loadRepositoryList() {
    const repoList = document.getElementById('repoList');
    repoList.innerHTML = 'Loading repositories...';

    fetch('/repositories/list')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to load repositories');
            }

            if (data.repositories.length === 0) {
                repoList.innerHTML = '<div class="no-results">No repositories found</div>';
                return;
            }

            repoList.innerHTML = data.repositories.map(repo => `
                <div class="repo-item">
                    <div class="repo-info">
                        <div class="repo-name">${repo.name}</div>
                        <div class="repo-path">${repo.path}</div>
                    </div>
                    <div class="repo-actions">
                        <button class="repo-button toggle ${repo.enabled ? '' : 'disabled'}" onclick="toggleRepository('${repo.name}')">
                            ${repo.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="repo-button delete" onclick="deleteRepository('${repo.name}')">Delete</button>
                    </div>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error:', error);
            repoList.innerHTML = `<div class="error-message">Failed to load repositories: ${error.message}</div>`;
        });
}

function deleteRepository(name) {
    if (!confirm(`Are you sure you want to delete repository '${name}'? This cannot be undone.`)) {
        return;
    }

    fetch('/repositories/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete repository');
            }
            showToast('Repository deleted successfully');
            loadRepositoryList();
            loadRepositories(); // Refresh repository filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to delete repository: ${error.message}`, true);
        });
}

function toggleRepository(name) {
    fetch('/repositories/toggle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.error || 'Failed to toggle repository');
        }
        showToast(data.message);
        loadRepositoryList();
        loadRepositories(); // Refresh repository filters
    })
    .catch(error => {
        console.error('Error:', error);
        showToast(`Failed to toggle repository: ${error.message}`, true);
    });
} 