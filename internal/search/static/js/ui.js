// Show toast message
export function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? '#dc3545' : '#333';
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

// Generate a consistent color for a repository name
export function getRepositoryColor(repoName, repositoryColors) {
    if (repositoryColors.has(repoName)) {
        return repositoryColors.get(repoName);
    }

    // Generate a color based on the repository name
    // We'll use HSL to ensure good contrast and saturation
    const hash = repoName.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    const hue = Math.abs(hash % 360);
    const color = `hsl(${hue}, 70%, 40%)`;
    repositoryColors.set(repoName, color);
    return color;
} 