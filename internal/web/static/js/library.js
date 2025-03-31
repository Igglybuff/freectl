import { showToast } from './ui.js';
import { loadSourceList, formatSourceType } from './sources.js';

// Load recommended sources data
export async function loadRecommendedSources() {
    try {
        const response = await fetch('/library');
        if (!response.ok) {
            throw new Error('Failed to load library tab');
        }
        return await response.json();
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load library tab', true);
        return null;
    }
}

// Create HTML for a recommended source
function createRecommendedSourceHTML(source, category, isAdded) {
    return `
        <div class="source-item">
            <div class="source-name-container">
                <div class="source-info">
                    <a href="${source.url}" class="source-name" target="_blank">${source.name}</a>
                    <span class="source-type">${formatSourceType(source.type)}</span>
                    <span class="category-tag">${category}</span>
                    <div class="source-metadata">
                        <span class="source-description">${source.description}</span>
                    </div>
                </div>
            </div>
            <div class="source-buttons">
                <button class="source-button add" 
                        data-action="add-recommended"
                        data-name="${source.name}"
                        data-url="${source.url}"
                        data-type="${source.type}"
                        ${isAdded ? 'disabled' : ''}>
                    <svg viewBox="0 0 24 24">
                        <path d="M12 4v16m8-8H4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// Update the recommended sources display
export function updateRecommendedSourcesDisplay(data) {
    const recommendedSources = document.getElementById('recommendedSources');
    recommendedSources.innerHTML = '';
    
    // Create a flat list of all sources with their categories
    const allSourcesHTML = Object.entries(data.recommendedSources)
        .flatMap(([category, sources]) => 
            sources.map(source => createRecommendedSourceHTML(source, category, data.existingSources.includes(source.name)))
        )
        .join('');
    
    recommendedSources.innerHTML = allSourcesHTML;
}

// Initialize library tab
export async function loadLibrary() {
    const data = await loadRecommendedSources();
    if (data) {
        updateRecommendedSourcesDisplay(data);
        loadSourceList();
    }
} 