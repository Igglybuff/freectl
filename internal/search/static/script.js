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

    if (tabName === 'stats') {
        loadStats();
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

function toggleFavorite(link, description, category) {
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
        body: JSON.stringify({ link, description, category }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update favorite');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            if (isFavorite) {
                currentFavorites.delete(link);
                allFavorites = allFavorites.filter(f => f.link !== link);
                showToast('Removed from favorites');
            } else {
                currentFavorites.add(link);
                allFavorites.push({ link, description, category });
                showToast('Added to favorites');
            }
            updateFavoriteButtons();
            updateFavoritesDisplay();
        }
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

function createResultHTML(result, showScore = true) {
    const isFavorite = currentFavorites.has(result.url);
    return `
        <div class="result-item">
            <div class="result-content">
                <div>
                    <a href="${result.url}" class="result-link" target="_blank">${result.description}</a>
                    <span class="result-domain">${getDisplayText(result.url)}</span>
                </div>
                ${showScore ? `<div class="result-score">Score: ${result.score}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center;">
                <div class="category-tag">${result.title}</div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        data-link="${result.url}"
                        onclick="toggleFavorite('${result.url}', '${result.description.replace(/'/g, "\\'")}', '${result.title.replace(/'/g, "\\'")}')">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

function filterFavorites(query) {
    if (!query) {
        return allFavorites;
    }
    query = query.toLowerCase();
    return allFavorites.filter(f => 
        f.description.toLowerCase().includes(query) ||
        f.category.toLowerCase().includes(query) ||
        f.link.toLowerCase().includes(query)
    );
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

searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    if (validateSearchInput(this)) {
        searchTimeout = setTimeout(() => performSearch(1), 300);
    }
});

function performSearch(page = 1) {
    const query = searchInput.value.trim();
    if (!validateSearchInput(searchInput)) {
        return;
    }

    const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    currentQuery = query;
    currentPage = page;
    
    resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    fetch(`/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${settings.resultsPerPage}`)
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

            resultsDiv.innerHTML = data.results.map(result => createResultHTML(result, true)).join('');
            updateFavoriteButtons();

            // Update pagination info
            totalPages = data.total_pages;
            totalResults = data.total_results;

            // Create pagination controls
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
                    startPage = 1;
                } else if (endPage === totalPages) {
                    startPage = Math.max(1, totalPages - 4);
                    endPage = totalPages;
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
        })
        .catch(error => {
            console.error('Error:', error);
            resultsDiv.innerHTML = '<div class="no-results">No results found. Go to Settings to update your repositories.</div>';
        });
}

// Load initial favorites
loadFavorites();

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function loadStats() {
    fetch('/stats')
        .then(response => response.json())
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
    autoUpdate: true
};

function loadSettings() {
    const savedSettings = localStorage.getItem('settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        Object.keys(settings).forEach(key => {
            const element = document.getElementById(key);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        });
    }
}

function saveSettings() {
    const settings = {
        minQueryLength: parseInt(document.getElementById('minQueryLength').value),
        maxQueryLength: parseInt(document.getElementById('maxQueryLength').value),
        searchDelay: parseInt(document.getElementById('searchDelay').value),
        showScores: document.getElementById('showScores').checked,
        resultsPerPage: parseInt(document.getElementById('resultsPerPage').value),
        cacheDir: document.getElementById('cacheDir').value,
        autoUpdate: document.getElementById('autoUpdate').checked
    };

    localStorage.setItem('settings', JSON.stringify(settings));
    showToast('Settings saved successfully');
}

function resetSettings() {
    Object.keys(defaultSettings).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = defaultSettings[key];
            } else {
                element.value = defaultSettings[key];
            }
        }
    });
    localStorage.removeItem('settings');
    showToast('Settings reset to defaults');
}

// Add event listeners for settings
document.getElementById('saveSettings').addEventListener('click', saveSettings);
document.getElementById('resetSettings').addEventListener('click', resetSettings);

// Load settings when the page loads
loadSettings();

// Update search functionality to use settings
const originalValidateSearchInput = validateSearchInput;
validateSearchInput = function(input) {
    const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    const value = input.value.trim();
    
    // Check for empty input
    if (value === '') {
        input.classList.add('error');
        errorMessage.textContent = 'Please enter a search query';
        errorMessage.style.display = 'block';
        return false;
    }

    // Check for minimum length
    if (value.length < settings.minQueryLength) {
        input.classList.add('error');
        errorMessage.textContent = `Search query must be at least ${settings.minQueryLength} characters long`;
        errorMessage.style.display = 'block';
        return false;
    }

    // Check for maximum length
    if (value.length > settings.maxQueryLength) {
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
};

// Update search delay based on settings
searchInput.addEventListener('input', function() {
    const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    clearTimeout(searchTimeout);
    if (validateSearchInput(this)) {
        searchTimeout = setTimeout(() => performSearch(1), settings.searchDelay);
    }
});

// Update result display to respect showScores setting
const originalCreateResultHTML = createResultHTML;
createResultHTML = function(result, showScore = true) {
    const settings = JSON.parse(localStorage.getItem('settings')) || defaultSettings;
    return originalCreateResultHTML(result, showScore && settings.showScores);
};

function updateRepository() {
    const updateButton = document.getElementById('updateRepo');
    updateButton.disabled = true;
    updateButton.textContent = 'Updating...';
    
    fetch('/update', {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update repository');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showToast(`Repository updated successfully in ${data.duration}`);
            // Reload stats to show updated information
            loadStats();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update repository', true);
    })
    .finally(() => {
        updateButton.disabled = false;
        updateButton.textContent = 'Update Repository';
    });
}

// Add event listener for update button
document.getElementById('updateRepo').addEventListener('click', updateRepository); 