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
    sourceList.innerHTML = 'Loading data sources...';

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

            if (data.sources.length === 0) {
                sourceList.innerHTML = '<div class="no-results">No sources found</div>';
                return;
            }

            sourceList.innerHTML = '';
            data.sources.forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.dataset.source = source.name;

                const nameContainer = document.createElement('div');
                nameContainer.className = 'source-name-container';

                const sourceLink = document.createElement('a');
                sourceLink.href = source.url || '#';
                sourceLink.className = 'source-name';
                sourceLink.textContent = source.name;
                sourceLink.onclick = (e) => {
                    if (source.url) {
                        e.preventDefault();
                        window.open(source.url, '_blank', 'noopener,noreferrer');
                    }
                };

                const editInput = document.createElement('input');
                editInput.type = 'text';
                editInput.className = 'source-name-edit';
                editInput.value = source.name;
                editInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        saveEditing(sourceItem);
                    } else if (e.key === 'Escape') {
                        cancelEditing(sourceItem);
                    }
                });

                nameContainer.appendChild(sourceLink);
                nameContainer.appendChild(editInput);

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'source-buttons';

                const editButton = document.createElement('button');
                editButton.className = 'source-button edit';
                editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>`;
                editButton.title = 'Edit source name';
                editButton.onclick = () => startEditing(sourceItem);

                const saveButton = document.createElement('button');
                saveButton.className = 'source-button save';
                saveButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6L9 17l-5-5"/>
                </svg>`;
                saveButton.title = 'Save changes';
                saveButton.style.display = 'none';
                saveButton.onclick = () => saveEditing(sourceItem);

                const cancelButton = document.createElement('button');
                cancelButton.className = 'source-button cancel';
                cancelButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 6L6 18"/>
                    <path d="M6 6l12 12"/>
                </svg>`;
                cancelButton.title = 'Cancel editing';
                cancelButton.style.display = 'none';
                cancelButton.onclick = () => cancelEditing(sourceItem);

                const deleteButton = document.createElement('button');
                deleteButton.className = 'source-button delete';
                deleteButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>`;
                deleteButton.title = 'Delete source';
                deleteButton.onclick = () => deleteSource(source.name);

                buttonContainer.appendChild(editButton);
                buttonContainer.appendChild(saveButton);
                buttonContainer.appendChild(cancelButton);
                buttonContainer.appendChild(deleteButton);

                sourceItem.appendChild(nameContainer);
                sourceItem.appendChild(buttonContainer);
                sourceList.appendChild(sourceItem);
            });
        })
        .catch(error => {
            console.error('Error loading sources:', error);
            sourceList.innerHTML = `<div class="error">Failed to load sources: ${error.message}</div>`;
        });
}

function startEditing(sourceItem) {
    sourceItem.classList.add('editing');
    const input = sourceItem.querySelector('.source-name-edit');
    const editButton = sourceItem.querySelector('.edit');
    const saveButton = sourceItem.querySelector('.save');
    const cancelButton = sourceItem.querySelector('.cancel');
    
    editButton.style.display = 'none';
    saveButton.style.display = 'inline-block';
    cancelButton.style.display = 'inline-block';
    
    input.focus();
    input.select();
}

function cancelEditing(sourceItem) {
    sourceItem.classList.remove('editing');
    const input = sourceItem.querySelector('.source-name-edit');
    const sourceLink = sourceItem.querySelector('.source-name');
    const editButton = sourceItem.querySelector('.edit');
    const saveButton = sourceItem.querySelector('.save');
    const cancelButton = sourceItem.querySelector('.cancel');
    
    input.value = sourceLink.textContent;
    editButton.style.display = 'inline-block';
    saveButton.style.display = 'none';
    cancelButton.style.display = 'none';
}

function saveEditing(sourceItem) {
    const input = sourceItem.querySelector('.source-name-edit');
    const oldName = sourceItem.dataset.source;
    const newName = input.value.trim();

    if (newName === '') {
        showError('Source name cannot be empty');
        return;
    }

    if (newName === oldName) {
        cancelEditing(sourceItem);
        return;
    }

    fetch('/sources/edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            oldName: oldName,
            newName: newName
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to rename source');
        }
        loadSourceList();
        showSuccess('Source renamed successfully');
    })
    .catch(error => {
        console.error('Error renaming source:', error);
        showError('Failed to rename source');
        cancelEditing(sourceItem);
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