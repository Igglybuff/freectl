import { showToast } from './ui.js';
import { loadStats } from './stats.js';

// Load sources into the filter dropdown
export function loadSourceFilter() {
    fetch('/sources/list')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load sources');
            }
            return response.json();
        })
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to load sources');
            }

            const searchFilter = document.getElementById('sourceFilter');
            const favoritesFilter = document.getElementById('favoriteSourceFilter');
            const options = '<option value="">All data sources</option>' +
                data.sources
                    .filter(source => source.enabled)
                    .map(source => `<option value="${source.name}">${source.name}</option>`)
                    .join('');
            
            searchFilter.innerHTML = options;
            favoritesFilter.innerHTML = options;
        })
        .catch(error => {
            console.error('Error:', error);
            const errorOption = '<option value="">Error loading data sources</option>';
            document.getElementById('sourceFilter').innerHTML = errorOption;
            document.getElementById('favoriteSourceFilter').innerHTML = errorOption;
        });
}

// Add source
export function addSource() {
    const urlInput = document.getElementById('sourceUrl');
    const nameInput = document.getElementById('sourceName');
    const typeInput = document.getElementById('sourceType');
    const addButton = document.getElementById('addSource');
    const url = urlInput.value.trim();
    const name = nameInput.value.trim();
    const type = typeInput ? typeInput.value.trim() : 'git';

    if (!url) {
        showToast('Source URL is required', true);
        return;
    }

    // Disable button and show loading state
    addButton.disabled = true;
    addButton.textContent = 'Adding source...';

    fetch('/sources/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, name, type }),
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to add source');
            }
            showToast('Source added successfully');
            urlInput.value = '';
            nameInput.value = '';
            if (typeInput) typeInput.value = 'git';
            loadSourceList();
            loadSourceFilter(); // Refresh source filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to add source: ${error.message}`, true);
        })
        .finally(() => {
            // Re-enable button and restore text
            addButton.disabled = false;
            addButton.textContent = 'Add';
        });
}

// Load source list
export function loadSourceList() {
    const sourceList = document.getElementById('sourceList');
    sourceList.innerHTML = 'Loading sources...';

    fetch('/sources/list')
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to load sources');
            }

            if (data.sources.length === 0) {
                sourceList.innerHTML = '<div class="no-results">No sources found</div>';
                return;
            }

            sourceList.innerHTML = data.sources.map(source => `
                <div class="source-item">
                    <div class="source-info">
                        <a href="${source.url}" class="source-name" target="_blank" rel="noopener noreferrer">${source.name}</a>
                        <div class="source-type">${formatSourceType(source.type)}</div>
                    </div>
                    <div class="source-actions">
                        <button class="source-button toggle ${source.enabled ? '' : 'disabled'}" data-action="toggle" data-name="${source.name}">
                            ${source.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="source-button edit" data-action="edit" data-name="${source.name}">Edit</button>
                        <button class="source-button delete" data-action="delete" data-name="${source.name}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners to the buttons
            sourceList.querySelectorAll('.source-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    const name = e.target.dataset.name;
                    if (action === 'toggle') {
                        toggleSource(name);
                    } else if (action === 'delete') {
                        deleteSource(name);
                    } else if (action === 'edit') {
                        editSource(name);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
            sourceList.innerHTML = `<div class="error">Failed to load sources: ${error.message}</div>`;
        });
}

// Delete source
export function deleteSource(name) {
    if (!confirm(`Are you sure you want to delete source '${name}'? This cannot be undone.`)) {
        return;
    }

    fetch('/sources/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to delete source');
            }
            showToast('Source deleted successfully');
            loadSourceList();
            loadSourceFilter(); // Refresh source filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to delete source: ${error.message}`, true);
        });
}

// Toggle source
export function toggleSource(name) {
    fetch('/sources/toggle', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            throw new Error(data.error || 'Failed to toggle source');
        }
        showToast(data.message);
        loadSourceList();
        loadSourceFilter(); // Refresh source filters
    })
    .catch(error => {
        console.error('Error:', error);
        showToast(`Failed to toggle source: ${error.message}`, true);
    });
}

// Update source
export function updateSource() {
    const updateButton = document.getElementById('updateSource');
    updateButton.disabled = true;
    updateButton.textContent = 'Updating sources...';
    
    fetch('/update', {
        method: 'POST',
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to update sources');
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showToast(`Sources updated successfully in ${data.duration}`);
            // Reload stats to show updated information
            if (typeof loadStats === 'function') {
                loadStats();
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('Failed to update sources', true);
    })
    .finally(() => {
        updateButton.disabled = false;
        updateButton.textContent = 'Update sources';
    });
}

// Edit source
export function editSource(name) {
    const newName = prompt(`Enter new name for source '${name}':`);
    if (!newName) {
        return; // User cancelled or entered empty string
    }

    if (newName === name) {
        return; // No change
    }

    fetch('/sources/edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            oldName: name,
            newName: newName 
        }),
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to edit source');
            }
            showToast('Source renamed successfully');
            loadSourceList();
            loadSourceFilter(); // Refresh source filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to rename source: ${error.message}`, true);
        });
}

// Helper function to format source type for display
function formatSourceType(type) {
    const typeMap = {
        'git': 'Git repository',
        'reddit_wiki': 'Reddit wiki',
        'opml': 'OPML feed',
        'bookmarks': 'Browser bookmarks',
        'hn500': 'HackerNews top 500',
        'obsidian': 'Obsidian vault'
    };
    return typeMap[type] || type;
} 