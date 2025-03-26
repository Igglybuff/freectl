import { showToast } from './ui.js';
import { getDisplayText } from './ui.js';
import { getRepositoryColor } from './ui.js';
import { getCurrentSettings } from './settings.js';
import { toggleFavorite } from './favorites.js';

let currentPage = 1;
let totalPages = 1;
let totalResults = 0;
let currentQuery = '';
let currentResults = [];
let currentCategories = new Set();
let allSearchCategories = new Set();

// Validate search input
export function validateSearchInput(input) {
    const value = input.value.trim();
    const errorMessage = document.getElementById('errorMessage');
    const settings = getCurrentSettings();
    
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
}

// Update category filter
export function updateCategoryFilter(results, selectedCategory = '') {
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Only update the full category list if this is a new search (not a filter)
    if (!selectedCategory) {
        allSearchCategories.clear();
        // Add only valid categories from results
        results.forEach(result => {
            // Skip invalid categories (longer than 80 characters)
            if (result.category && result.category.length <= 80) {
                allSearchCategories.add(result.category || 'n/a');
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

// Update pagination
export function updatePagination() {
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

// Create result HTML
function createResultHTML(result, showScore = true) {
    const isFavorite = document.querySelector(`.favorite-btn[data-link="${result.url}"]`)?.classList.contains('active');
    const repoColor = getRepositoryColor(result.repository, new Map());
    const currentSettings = getCurrentSettings();
    
    // Truncate description if enabled
    let description = result.description;
    if (currentSettings && currentSettings.truncateTitles && description.length > currentSettings.maxTitleLength) {
        description = description.substring(0, currentSettings.maxTitleLength) + '...';
    }
    
    // Check if category is invalid
    const isInvalid = result.category.length > 80;
    
    return `<div class="result-item ${isInvalid ? 'invalid-result' : ''}">
            <div class="result-content">
                <a href="${result.url}" class="result-link" target="_blank" title="${result.description}">
                    ${result.name || description}
                </a>
                <span class="result-domain">${getDisplayText(result.url)}</span>
                ${showScore && currentSettings.showScores ? `<div class="result-score">Score: ${result.score}</div>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${isInvalid ? 
                    `<div class="warning-tag">⚠️ Invalid category</div>` :
                    `<div class="category-tag">${result.category || 'n/a'}</div>`
                }
                <div class="repo-tag" style="background-color: ${repoColor}">${result.repository}</div>
                <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                        data-link="${result.url}"
                        data-name="${result.name}"
                        data-description="${result.description}"
                        data-category="${result.category || 'n/a'}"
                        data-repository="${result.repository}">
                    <svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                </button>
            </div>
        </div>`;
}

// Perform search
export function performSearch(page = 1) {
    const query = document.getElementById('searchInput').value.trim();
    if (!validateSearchInput(document.getElementById('searchInput'))) {
        return;
    }

    const resultsPerPage = getCurrentSettings() ? getCurrentSettings().resultsPerPage : 10;
    const selectedRepo = document.getElementById('repoFilter').value;
    const selectedCategory = document.getElementById('categoryFilter').value;
    currentQuery = query;
    currentPage = page;
    
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
    document.getElementById('pagination').innerHTML = '';
    
    let url = `/search?q=${encodeURIComponent(query)}&page=${page}&per_page=${resultsPerPage}`;
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
