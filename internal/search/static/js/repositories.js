import { showToast } from './ui.js';

// Load repositories into the filter dropdown
export function loadRepositoryFilter() {
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

// Add repository
export function addRepository() {
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
            loadRepositoryFilter(); // Refresh repository filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to add repository: ${error.message}`, true);
        });
}

// Load repository list
export function loadRepositoryList() {
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
                        <button class="repo-button toggle ${repo.enabled ? '' : 'disabled'}" data-action="toggle" data-name="${repo.name}">
                            ${repo.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button class="repo-button delete" data-action="delete" data-name="${repo.name}">Delete</button>
                    </div>
                </div>
            `).join('');

            // Add event listeners to the buttons
            repoList.querySelectorAll('.repo-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const action = e.target.dataset.action;
                    const name = e.target.dataset.name;
                    if (action === 'toggle') {
                        toggleRepository(name);
                    } else if (action === 'delete') {
                        deleteRepository(name);
                    }
                });
            });
        })
        .catch(error => {
            console.error('Error:', error);
            repoList.innerHTML = `<div class="error-message">Failed to load repositories: ${error.message}</div>`;
        });
}

// Delete repository
export function deleteRepository(name) {
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
            loadRepositoryFilter(); // Refresh repository filters
        })
        .catch(error => {
            console.error('Error:', error);
            showToast(`Failed to delete repository: ${error.message}`, true);
        });
}

// Toggle repository
export function toggleRepository(name) {
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
        loadRepositoryFilter(); // Refresh repository filters
    })
    .catch(error => {
        console.error('Error:', error);
        showToast(`Failed to toggle repository: ${error.message}`, true);
    });
}

// Update repository
export function updateRepository() {
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
            if (typeof loadStats === 'function') {
                loadStats();
            }
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