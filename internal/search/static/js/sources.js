import { showToast } from './ui.js';

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
    const url = urlInput.value.trim();
    const name = nameInput.value.trim();
    const type = typeInput ? typeInput.value.trim() : 'git';

    if (!url) {
        showToast('Source URL is required', true);
        return;
    }

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
                        <div class="source-name">${source.name}</div>
                        <div class="source-path">${source.path}</div>
                    </div>
                    <div class="source-actions">
                        <button class="source-button toggle ${source.enabled ? '' : 'disabled'}" data-action="toggle" data-name="${source.name}">
                            ${source.enabled ? 'Disable' : 'Enable'}
                        </button>
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
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
            sourceList.innerHTML = `<div class="error-message">Failed to load sources: ${error.message}</div>`;
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