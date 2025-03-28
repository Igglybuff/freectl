import { initializeTheme, toggleTheme } from './theme.js';
import { loadSettings, saveSettings, resetSettings, getCurrentSettings } from './settings.js';
import { loadSourceFilter, addSource, loadSourceList, deleteSource, toggleSource, updateSource } from './sources.js';
import { loadSources as loadStatsSources, loadStats } from './stats.js';
import { loadFavorites, updateFavoritesDisplay, toggleFavorite } from './favorites.js';
import { validateSearchInput, performSearch, updateCategoryFilter } from './search.js';

// Initialize theme
initializeTheme();

// Set initial active tab based on URL hash
const initialTab = window.location.hash.slice(1) || 'search';
showTab(initialTab);

// Show tab function
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
        loadStatsSources();
    } else if (tabName === 'favorites') {
        loadFavorites();
    } else if (tabName === 'settings') {
        loadSettings();
        loadSourceList();
    }
}

// Add event listeners for tab buttons
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        showTab(button.dataset.tab);
    });
});

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    // Load settings first
    loadSettings().then(() => {
        loadSourceFilter();
        
        // Add event listener for theme toggle
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        
        // Add event listener for source filter changes
        document.getElementById('sourceFilter').addEventListener('change', function() {
            performSearch(1);
        });

        document.getElementById('favoriteSourceFilter').addEventListener('change', function() {
            updateFavoritesDisplay();
        });

        // Add event listener for search input
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            if (validateSearchInput(this)) {
                searchTimeout = setTimeout(() => performSearch(1), getCurrentSettings() ? getCurrentSettings().searchDelay : 300);
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
        document.getElementById('favoritesSearchInput').addEventListener('input', function() {
            updateFavoritesDisplay();
        });

        // Add event listener for favorite button clicks
        document.addEventListener('click', function(e) {
            const favoriteBtn = e.target.closest('.favorite-btn');
            if (favoriteBtn) {
                const link = favoriteBtn.dataset.link;
                const name = favoriteBtn.dataset.name;
                const description = favoriteBtn.dataset.description;
                const category = favoriteBtn.dataset.category;
                const source = favoriteBtn.dataset.source;
                toggleFavorite(link, description, category, source, name);
            }
        });

        // Load initial data
        loadFavorites();
        
        // Check URL hash for initial tab
        const hash = window.location.hash.slice(1);
        if (hash) {
            showTab(hash);
        }

        // Add event listeners for settings buttons
        document.getElementById('saveSettings').addEventListener('click', saveSettings);
        document.getElementById('resetSettings').addEventListener('click', resetSettings);

        // Add event listeners for search behavior settings
        const searchBehaviorSettings = [
            'minQueryLength',
            'maxQueryLength',
            'searchDelay',
            'resultsPerPage'
        ];

        searchBehaviorSettings.forEach(settingId => {
            const input = document.getElementById(settingId);
            if (input) {
                input.addEventListener('change', function() {
                    const settings = getCurrentSettings();
                    if (settings) {
                        settings[settingId] = parseInt(this.value);
                        // Re-render current results if there's an active search
                        if (document.getElementById('searchInput').value.trim()) {
                            performSearch(1);
                        }
                    }
                });
            }
        });

        // Add event listener for truncate titles checkbox
        const truncateTitlesCheckbox = document.getElementById('truncateTitles');
        const maxTitleLengthInput = document.getElementById('maxTitleLength');
        
        truncateTitlesCheckbox.addEventListener('change', function() {
            maxTitleLengthInput.disabled = !this.checked;
            // Immediately apply the setting change
            const settings = getCurrentSettings();
            if (settings) {
                settings.truncateTitles = this.checked;
                // Re-render current results with new setting
                if (document.getElementById('searchInput').value.trim()) {
                    performSearch(1);
                }
            }
        });

        // Add event listener for max title length changes
        maxTitleLengthInput.addEventListener('change', function() {
            const settings = getCurrentSettings();
            if (settings) {
                settings.maxTitleLength = parseInt(this.value);
                // Re-render current results with new setting
                if (document.getElementById('searchInput').value.trim()) {
                    performSearch(1);
                }
            }
        });

        // Add event listener for category filter changes
        document.getElementById('categoryFilter').addEventListener('change', function() {
            performSearch(1);
        });

        document.getElementById('favoriteCategoryFilter').addEventListener('change', function() {
            updateFavoritesDisplay();
        });

        // Add event listener for add data source button
        document.getElementById('addSource').addEventListener('click', addSource);

        // Add event listener for update button
        document.getElementById('updateSource').addEventListener('click', updateSource);

        // Add event listener for data source selection in stats
        document.getElementById('statsSource').addEventListener('change', loadStats);
    });
}); 