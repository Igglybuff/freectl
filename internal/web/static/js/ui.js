// Show toast message
export function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? 'var(--error-color)' : 'var(--bg-secondary)';
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Format bytes to human readable format
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get display text from URL
export function getDisplayText(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

// Update header text
export function updateHeaderText(text) {
    document.getElementById('mainHeader').textContent = text;
    document.getElementById('pageTitle').textContent = text;
}

// Generate a consistent color for a source name
export function getSourceColor(sourceName, sourceColors) {
    if (sourceColors.has(sourceName)) {
        return sourceColors.get(sourceName);
    }

    // Generate a color based on the source name
    // We'll use HSL to ensure good contrast and saturation
    const hash = sourceName.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash % 360);
    const color = `hsl(${hue}, 70%, 40%)`;
    sourceColors.set(sourceName, color);
    return color;
}

// Add kebab menu functionality
export function addKebabMenuListeners() {
    // Remove existing event listeners first
    document.querySelectorAll('.kebab-menu-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    document.querySelectorAll('.kebab-menu-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const menu = this.closest('.kebab-menu');
            const content = menu.querySelector('.kebab-menu-content');
            
            // Close all other open menus
            document.querySelectorAll('.kebab-menu-content').forEach(otherContent => {
                if (otherContent !== content) {
                    otherContent.classList.remove('show');
                }
            });
            
            content.classList.toggle('show');
        });
    });

    // Remove existing click outside listener if it exists
    const existingListener = document._kebabMenuOutsideListener;
    if (existingListener) {
        document.removeEventListener('click', existingListener);
    }

    // Add new click outside listener
    const clickOutsideListener = function(e) {
        if (!e.target.closest('.kebab-menu')) {
            document.querySelectorAll('.kebab-menu-content').forEach(content => {
                content.classList.remove('show');
            });
        }
    };
    document._kebabMenuOutsideListener = clickOutsideListener;
    document.addEventListener('click', clickOutsideListener);

    // Remove existing source button listeners
    document.querySelectorAll('.add-source-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Handle add source action
    document.querySelectorAll('.add-source-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const url = this.dataset.url;
            
            // Clean the URL by removing fragments, query params, and trailing slashes
            const cleanUrl = url.split('#')[0].split('?')[0].replace(/\/$/, '');
            
            // Add loading state
            this.classList.add('loading');
            
            // Make POST request to add source
            fetch('/sources/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url: cleanUrl }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to add source');
                }
                showToast('Source added successfully');
                // Close the kebab menu
                this.closest('.kebab-menu-content').classList.remove('show');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(`Failed to add source: ${error.message}`, true);
            })
            .finally(() => {
                // Remove loading state
                this.classList.remove('loading');
            });
        });
    });

    // Remove existing VirusTotal button listeners
    document.querySelectorAll('.scan-virustotal-btn').forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });

    // Handle VirusTotal scan action
    document.querySelectorAll('.scan-virustotal-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const url = this.dataset.url;
            
            // Add loading state
            this.classList.add('loading');
            
            // Make POST request to scan URL
            fetch('/scan/virustotal', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to scan URL');
                }
                showToast(data.message);
                // Close the kebab menu
                this.closest('.kebab-menu-content').classList.remove('show');
            })
            .catch(error => {
                console.error('Error:', error);
                showToast(`Failed to scan URL: ${error.message}`, true);
            })
            .finally(() => {
                // Remove loading state
                this.classList.remove('loading');
            });
        });
    });
} 