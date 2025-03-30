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

            console.log('Sources data:', data.sources); // Debug log

            sourceList.innerHTML = '';
            data.sources.forEach(source => {
                console.log('Source:', source); // Debug log for each source
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

                const sourceType = document.createElement('span');
                sourceType.className = 'source-type';
                sourceType.textContent = formatSourceType(source.type);

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

                const sourceInfo = document.createElement('div');
                sourceInfo.className = 'source-info';
                sourceInfo.appendChild(sourceLink);
                sourceInfo.appendChild(sourceType);

                // Add metadata info
                const metadataInfo = document.createElement('div');
                metadataInfo.className = 'source-metadata';
                if (source.size) {
                    const sizeSpan = document.createElement('span');
                    sizeSpan.className = 'source-size';
                    sizeSpan.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M4 20h16a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"/>
                            <path d="M14 2v6h6"/>
                        </svg>
                        ${source.size}`;
                    metadataInfo.appendChild(sizeSpan);
                }
                if (source.last_updated && source.last_updated !== "0001-01-01T00:00:00Z") {
                    const updateSpan = document.createElement('span');
                    updateSpan.className = 'source-update';
                    const date = new Date(source.last_updated);
                    const formattedDate = date.toLocaleString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    updateSpan.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M12 8v4l3 3"/>
                            <circle cx="12" cy="12" r="10"/>
                        </svg>
                        Updated ${formattedDate}`;
                    metadataInfo.appendChild(updateSpan);
                }
                sourceInfo.appendChild(metadataInfo);

                nameContainer.appendChild(sourceInfo);
                nameContainer.appendChild(editInput);

                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'source-buttons';

                const toggleButton = document.createElement('button');
                toggleButton.className = `source-button toggle ${source.enabled ? 'enabled' : 'disabled'}`;
                toggleButton.innerHTML = source.enabled ? 
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <polyline points="9 12 11 14 15 10"/>
                    </svg>` :
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>`;
                toggleButton.title = source.enabled ? 'Disable source' : 'Enable source';
                toggleButton.onclick = () => toggleSource(source.name);

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

                buttonContainer.appendChild(toggleButton);
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
    const sourceLink = sourceItem.querySelector('.source-name');
    
    // Set initial width based on the source name width
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.style.font = window.getComputedStyle(input).font;
    tempSpan.textContent = input.value;
    document.body.appendChild(tempSpan);
    input.style.width = (tempSpan.offsetWidth + 24) + 'px'; // Add padding
    document.body.removeChild(tempSpan);

    // Show save/cancel buttons
    sourceItem.querySelector('.source-button.save').style.display = 'inline-flex';
    sourceItem.querySelector('.source-button.cancel').style.display = 'inline-flex';
    sourceItem.querySelector('.source-button.edit').style.display = 'none';
    sourceItem.querySelector('.source-button.delete').style.display = 'none';

    // Focus and select the input
    input.focus();
    input.select();

    // Add input event listener to adjust width as user types
    input.addEventListener('input', function() {
        const tempSpan = document.createElement('span');
        tempSpan.style.visibility = 'hidden';
        tempSpan.style.position = 'absolute';
        tempSpan.style.whiteSpace = 'pre';
        tempSpan.style.font = window.getComputedStyle(input).font;
        tempSpan.textContent = input.value;
        document.body.appendChild(tempSpan);
        input.style.width = (tempSpan.offsetWidth + 24) + 'px'; // Add padding
        document.body.removeChild(tempSpan);
    });
}

function cancelEditing(sourceItem) {
    sourceItem.classList.remove('editing');
    const editButton = sourceItem.querySelector('.source-button.edit');
    const saveButton = sourceItem.querySelector('.source-button.save');
    const cancelButton = sourceItem.querySelector('.source-button.cancel');
    const deleteButton = sourceItem.querySelector('.source-button.delete');
    
    editButton.style.display = 'inline-flex';
    saveButton.style.display = 'none';
    cancelButton.style.display = 'none';
    deleteButton.style.display = 'inline-flex';
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
        
        // Update the UI
        const sourceItem = document.querySelector(`.source-item[data-source="${name}"]`);
        if (sourceItem) {
            const toggleButton = sourceItem.querySelector('.source-button.toggle');
            if (toggleButton) {
                const isEnabled = toggleButton.classList.contains('enabled');
                toggleButton.classList.remove('enabled', 'disabled');
                toggleButton.classList.add(isEnabled ? 'disabled' : 'enabled');
                toggleButton.title = isEnabled ? 'Enable source' : 'Disable source';
                // Update the icon
                toggleButton.innerHTML = isEnabled ? 
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    </svg>` :
                    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <polyline points="9 12 11 14 15 10"/>
                    </svg>`;
            }
            sourceItem.classList.toggle('disabled');
        }
        
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

function showError(message) {
    showToast(message, true);
}

function showSuccess(message) {
    showToast(message, false);
} 