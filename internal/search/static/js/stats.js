import { showToast } from './ui.js';
import { formatBytes } from './ui.js';
import { getRepositoryColor } from './ui.js';

let selectedRepos = new Set();
let allStats = new Map();

// Load repositories into stats dropdown
export function loadRepositories() {
    fetch('/list')
        .then(response => response.json())
        .then(repos => {
            const select = document.getElementById('statsRepo');
            if (!select) return;
            
            // Add "All repositories" as the first option
            select.innerHTML = '<option value="">All repositories</option>' + 
                repos.map(repo => 
                    `<option value="${repo.name}">${repo.name}</option>`
                ).join('');
            
            // Load combined stats by default
            loadStats();
        })
        .catch(error => {
            console.error('Error loading repositories:', error);
            showToast('Failed to load repositories', true);
            const select = document.getElementById('statsRepo');
            if (select) {
                select.innerHTML = '<option value="">Error loading repositories</option>';
            }
        });
}

// Load stats for selected repository or all repositories
export function loadStats() {
    const repoName = document.getElementById('statsRepo')?.value;
    
    // Show loading state
    const elements = {
        totalLinks: document.getElementById('totalLinks'),
        repoSize: document.getElementById('repoSize'),
        httpsCount: document.getElementById('https-count'),
        httpCount: document.getElementById('http-count'),
        topCategories: document.getElementById('topCategories'),
        topDomains: document.getElementById('topDomains')
    };

    // Check if we're on the stats tab
    if (!elements.totalLinks) return;

    // Set loading states
    elements.totalLinks.textContent = '...';
    elements.repoSize.textContent = '...';
    elements.httpsCount.textContent = '...';
    elements.httpCount.textContent = '...';
    elements.topCategories.innerHTML = 'Loading...';
    elements.topDomains.innerHTML = 'Loading...';

    // If no repository is selected, load combined stats
    if (!repoName) {
        fetch('/list')
            .then(response => response.json())
            .then(repos => {
                const combinedStats = {
                    TotalLinks: 0,
                    TotalSize: 0,
                    Categories: [],
                    DomainsCount: {},
                    ProtocolStats: { https: 0, http: 0 }
                };

                // Load stats for each repository
                const promises = repos.map(repo => 
                    fetch(`/stats?repo=${encodeURIComponent(repo.name)}`)
                        .then(response => response.json())
                        .then(data => {
                            // Safely add total links and size
                            combinedStats.TotalLinks += data.TotalLinks || 0;
                            combinedStats.TotalSize += data.TotalSize || 0;
                            
                            // Safely combine categories
                            if (data.Categories && Array.isArray(data.Categories)) {
                                data.Categories.forEach(cat => {
                                    if (!cat || !cat.Name) return;
                                    
                                    let found = false;
                                    for (let i = 0; i < combinedStats.Categories.length; i++) {
                                        if (combinedStats.Categories[i].Name === cat.Name) {
                                            combinedStats.Categories[i].LinkCount += cat.LinkCount || 0;
                                            found = true;
                                            break;
                                        }
                                    }
                                    if (!found) {
                                        combinedStats.Categories.push({
                                            Name: cat.Name,
                                            LinkCount: cat.LinkCount || 0
                                        });
                                    }
                                });
                            }

                            // Safely combine domains
                            if (data.DomainsCount && typeof data.DomainsCount === 'object') {
                                Object.entries(data.DomainsCount).forEach(([domain, count]) => {
                                    if (!domain) return;
                                    combinedStats.DomainsCount[domain] = (combinedStats.DomainsCount[domain] || 0) + (count || 0);
                                });
                            }

                            // Safely combine protocols
                            if (data.ProtocolStats && typeof data.ProtocolStats === 'object') {
                                combinedStats.ProtocolStats.https += data.ProtocolStats.https || 0;
                                combinedStats.ProtocolStats.http += data.ProtocolStats.http || 0;
                            }
                        })
                        .catch(error => {
                            console.error(`Error loading stats for ${repo.name}:`, error);
                            // Continue with other repositories even if one fails
                            return null;
                        })
                );

                Promise.all(promises)
                    .then(() => {
                        // Sort categories before displaying
                        combinedStats.Categories.sort((a, b) => b.LinkCount - a.LinkCount);
                        updateStatsDisplay(combinedStats);
                    })
                    .catch(error => {
                        console.error('Error loading combined stats:', error);
                        showToast('Failed to load combined stats', true);
                        clearStats();
                    });
            })
            .catch(error => {
                console.error('Error loading repositories:', error);
                showToast('Failed to load repositories', true);
                clearStats();
            });
        return;
    }

    // Load stats for specific repository
    fetch(`/stats?repo=${encodeURIComponent(repoName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            return response.json();
        })
        .then(data => {
            // Store stats for this repository
            allStats.set(repoName, data);
            
            // Update UI with stats
            updateStatsDisplay(data);
        })
        .catch(error => {
            console.error('Error loading stats:', error);
            showToast('Failed to load repository stats', true);
            clearStats();
        });
}

function updateStatsDisplay(data) {
    // Update general stats
    const totalLinks = document.getElementById('totalLinks');
    const repoSize = document.getElementById('repoSize');
    if (totalLinks) totalLinks.textContent = (data.TotalLinks || 0).toLocaleString();
    if (repoSize) repoSize.textContent = formatBytes(data.TotalSize || 0);
    
    // Update protocol stats
    const httpsCount = data.ProtocolStats?.https || 0;
    const httpCount = data.ProtocolStats?.http || 0;
    const totalProtocols = httpsCount + httpCount;
    
    const httpsCountEl = document.getElementById('https-count');
    const httpCountEl = document.getElementById('http-count');
    if (httpsCountEl) httpsCountEl.textContent = `${httpsCount.toLocaleString()} (${((httpsCount / totalProtocols) * 100).toFixed(1)}%)`;
    if (httpCountEl) httpCountEl.textContent = `${httpCount.toLocaleString()} (${((httpCount / totalProtocols) * 100).toFixed(1)}%)`;
    
    // Update categories
    const topCategories = document.getElementById('topCategories');
    if (topCategories) {
        const categories = data.Categories || [];
        topCategories.innerHTML = categories
            .sort((a, b) => b.LinkCount - a.LinkCount)
            .slice(0, 12)
            .map(cat => `
                <div class="stats-list-item">
                    <span class="stats-list-label">${cat.Name}</span>
                    <span class="stats-list-value">${cat.LinkCount.toLocaleString()}</span>
                </div>
            `).join('');
    }
    
    // Update domains
    const topDomains = document.getElementById('topDomains');
    if (topDomains) {
        let domains;
        if (data.Domains && Array.isArray(data.Domains)) {
            // Handle array format with Name and LinkCount
            domains = data.Domains;
        } else if (data.DomainsCount && typeof data.DomainsCount === 'object') {
            // Handle object format with domain names as keys
            domains = Object.entries(data.DomainsCount)
                .map(([name, linkCount]) => ({ Name: name, LinkCount: linkCount }));
        } else {
            domains = [];
        }

        topDomains.innerHTML = domains
            .sort((a, b) => b.LinkCount - a.LinkCount)
            .slice(0, 12)
            .map(domain => `
                <div class="stats-list-item">
                    <span class="stats-list-label">${domain.Name}</span>
                    <span class="stats-list-value">${domain.LinkCount.toLocaleString()}</span>
                </div>
            `).join('');
    }
}

function clearStats() {
    const elements = {
        totalLinks: document.getElementById('totalLinks'),
        repoSize: document.getElementById('repoSize'),
        httpsCount: document.getElementById('https-count'),
        httpCount: document.getElementById('http-count'),
        topCategories: document.getElementById('topCategories'),
        topDomains: document.getElementById('topDomains')
    };

    if (elements.totalLinks) elements.totalLinks.textContent = '-';
    if (elements.repoSize) elements.repoSize.textContent = '-';
    if (elements.httpsCount) elements.httpsCount.textContent = '-';
    if (elements.httpCount) elements.httpCount.textContent = '-';
    if (elements.topCategories) elements.topCategories.innerHTML = 'Please select a repository';
    if (elements.topDomains) elements.topDomains.innerHTML = 'Please select a repository';
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', () => {
    const repoSelect = document.getElementById('statsRepo');
    if (repoSelect) {
        repoSelect.addEventListener('change', loadStats);
    }
}); 