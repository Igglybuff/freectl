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

// Track pending source additions
let pendingSourceAdditions = new Set();

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
                if (!source.enabled) {
                    sourceItem.classList.add('disabled');
                }
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
                editInput.className = 'source-name-input';
                editInput.style.display = 'none';

                const sourceInfo = document.createElement('div');
                sourceInfo.className = 'source-info';
                sourceInfo.appendChild(sourceLink);
                sourceInfo.appendChild(sourceType);

                const sourceMetadata = document.createElement('div');
                sourceMetadata.className = 'source-metadata';

                if (source.size) {
                    const sizeSpan = document.createElement('span');
                    sizeSpan.className = 'source-size';
                    sizeSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M4 20h16a2 2 0 0 0 2-2V8l-6-6H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z"/>
                        <path d="M14 2v6h6"/>
                    </svg>${source.size}`;
                    sourceMetadata.appendChild(sizeSpan);
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
                    updateSpan.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 8v4l3 3"/>
                        <circle cx="12" cy="12" r="10"/>
                    </svg>Updated ${formattedDate}`;
                    sourceMetadata.appendChild(updateSpan);
                }

                sourceInfo.appendChild(sourceMetadata);
                nameContainer.appendChild(sourceInfo);
                nameContainer.appendChild(editInput);
                sourceItem.appendChild(nameContainer);
                sourceItem.appendChild(createSourceButtons(source));
                sourceList.appendChild(sourceItem);
            });
        })
        .catch(error => {
            console.error('Error:', error);
            sourceList.innerHTML = '<div class="error">Failed to load sources</div>';
        });
}

function startEditing(sourceItem) {
    sourceItem.classList.add('editing');
    const input = sourceItem.querySelector('.source-name-input');
    const sourceLink = sourceItem.querySelector('.source-name');
    const sourceName = sourceItem.dataset.source;
    
    // Store original buttons for later restoration
    const buttonsContainer = sourceItem.querySelector('.source-buttons');
    sourceItem.dataset.originalButtons = buttonsContainer.innerHTML;
    
    // Set input value and show it
    input.value = sourceName;
    input.style.display = 'block';
    sourceLink.style.display = 'none';

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

    // Show save/cancel buttons with placeholder
    buttonsContainer.innerHTML = `
        <div class="source-button placeholder"></div>
        <button class="source-button save" title="Save changes">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </button>
        <button class="source-button cancel" title="Cancel">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;

    // Add event listeners for save/cancel
    const saveButton = buttonsContainer.querySelector('.save');
    const cancelButton = buttonsContainer.querySelector('.cancel');
    
    saveButton.onclick = () => saveSourceName(sourceName, input.value);
    cancelButton.onclick = () => cancelEdit({ name: sourceName });

    // Add keyboard event listeners
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveSourceName(sourceName, input.value);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit({ name: sourceName });
        }
    });

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

function saveSourceName(oldName, newName) {
    if (newName === '') {
        showToast('Source name cannot be empty', true);
        return;
    }

    if (newName === oldName) {
        cancelEdit({ name: oldName });
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
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            throw new Error(data.error || 'Failed to rename source');
        }
        loadSourceList();
        showToast('Source renamed successfully');
    })
    .catch(error => {
        console.error('Error renaming source:', error);
        showToast('Failed to rename source', true);
        cancelEdit({ name: oldName });
    });
}

function cancelEdit(source) {
    const sourceItem = document.querySelector(`[data-source="${source.name}"]`);
    if (!sourceItem) return;

    // Remove editing class
    sourceItem.classList.remove('editing');

    const input = sourceItem.querySelector('.source-name-input');
    const sourceLink = sourceItem.querySelector('.source-name');
    
    // Hide input, show source name
    input.style.display = 'none';
    sourceLink.style.display = 'block';
    
    // Restore original buttons
    const buttonsContainer = sourceItem.querySelector('.source-buttons');
    if (sourceItem.dataset.originalButtons) {
        buttonsContainer.innerHTML = sourceItem.dataset.originalButtons;
        delete sourceItem.dataset.originalButtons;
        
        // Reattach event listeners
        const toggleButton = buttonsContainer.querySelector('.toggle');
        const editButton = buttonsContainer.querySelector('.edit');
        const deleteButton = buttonsContainer.querySelector('.delete');
        
        if (toggleButton) {
            toggleButton.onclick = () => toggleSource(source.name);
        }
        if (editButton) {
            editButton.onclick = () => startEditing(sourceItem);
        }
        if (deleteButton) {
            deleteButton.onclick = () => showDeleteConfirmation(source);
        }
    } else {
        // Fallback: recreate buttons if original state was lost
        buttonsContainer.innerHTML = createSourceButtons(source).innerHTML;
    }
}

// Delete source
export function deleteSource(name) {
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
            loadSourceFilter();
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to delete source: ${error.message}`, true);
            // Restore original buttons in case of error
            const sourceItem = document.querySelector(`[data-source="${name}"]`);
            if (sourceItem && sourceItem.dataset.originalButtons) {
                sourceItem.querySelector('.source-buttons').innerHTML = sourceItem.dataset.originalButtons;
                delete sourceItem.dataset.originalButtons;
            }
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
                        <path d="M9 12l2 2 4-4"/>
                    </svg>`;
            }
            sourceItem.classList.toggle('disabled');
        }
        
        // Only reload the source filter dropdown
        loadSourceFilter();
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
export function formatSourceType(type) {
    const typeMap = {
        'git': 'Git repository',
        'reddit_wiki': 'Reddit wiki',
        'opml': 'OPML feed',
        'bookmarks': 'Browser bookmarks',
        'hn5000': 'HackerNews top 5000',
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

// Add recommended source
async function addRecommendedSource(name, url, type, button) {
    // Prevent duplicate additions
    if (pendingSourceAdditions.has(name)) {
        return;
    }

    // Save original button content and disable button
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<svg class="spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>`;

    pendingSourceAdditions.add(name);

    try {
        const response = await fetch('/sources/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                url: url,
                type: type
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to add source');
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to add source');
        }

        showToast('Source added successfully');
        
        // Update button to show success state
        button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"/>
        </svg>`;
        button.classList.add('added');

        // Refresh the lists after a short delay to allow server processing
        setTimeout(async () => {
            await loadSourceList();
            await loadSourceFilter();
        }, 500);

    } catch (error) {
        console.error('Error adding source:', error);
        showToast(`Failed to add source: ${error.message}`, true);
        // Restore button on error
        button.disabled = false;
        button.innerHTML = originalContent;
    } finally {
        pendingSourceAdditions.delete(name);
    }
}

// Set up event listeners for recommended source buttons
document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="add-recommended"]');
    if (button && !button.disabled) {
        const name = button.dataset.name;
        const url = button.dataset.url;
        const type = button.dataset.type;
        addRecommendedSource(name, url, type, button);
    }
});

function createSourceButtons(source) {
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'source-buttons';

    // Toggle button
    const toggleButton = document.createElement('button');
    toggleButton.className = `source-button toggle ${source.enabled ? 'enabled' : 'disabled'}`;
    toggleButton.title = source.enabled ? 'Disable source' : 'Enable source';
    toggleButton.innerHTML = source.enabled ? 
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <path d="M9 12l2 2 4-4"/>
        </svg>` :
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>`;
    toggleButton.onclick = () => toggleSource(source.name);

    // Edit button
    const editButton = document.createElement('button');
    editButton.className = 'source-button edit';
    editButton.title = 'Edit source name';
    editButton.innerHTML = `<svg viewBox="0 0 24 24">
        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="transparent" stroke="currentColor" stroke-width="2"/>
    </svg>`;
    editButton.onclick = () => {
        const sourceItem = document.querySelector(`[data-source="${source.name}"]`);
        startEditing(sourceItem);
    };

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.className = 'source-button delete';
    deleteButton.title = 'Delete source';
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24">
        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="transparent" stroke="currentColor" stroke-width="2"/>
    </svg>`;
    deleteButton.onclick = () => showDeleteConfirmation(source);

    buttonsContainer.appendChild(toggleButton);
    buttonsContainer.appendChild(editButton);
    buttonsContainer.appendChild(deleteButton);
    return buttonsContainer;
}

// Show delete confirmation buttons
function showDeleteConfirmation(source) {
    const sourceItem = document.querySelector(`[data-source="${source.name}"]`);
    const buttonsContainer = sourceItem.querySelector('.source-buttons');
    
    // Store original buttons HTML for restoration
    sourceItem.dataset.originalButtons = buttonsContainer.innerHTML;
    
    // Show confirm/cancel buttons, maintaining the three-button layout
    buttonsContainer.innerHTML = `
        <div class="source-button placeholder"></div>
        <button class="source-button confirm-delete" title="Confirm delete">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
        </button>
        <button class="source-button cancel-delete" title="Cancel">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>
    `;
    
    // Add event listeners for confirm/cancel
    const confirmButton = sourceItem.querySelector('.confirm-delete');
    const cancelButton = sourceItem.querySelector('.cancel-delete');
    
    confirmButton.onclick = () => deleteSource(source.name);
    cancelButton.onclick = () => cancelEdit(source);
} 