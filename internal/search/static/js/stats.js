import { showToast } from './ui.js';
import { formatBytes } from './ui.js';

// Load repositories into stats dropdown
export function loadRepositories() {
    fetch('/list')
        .then(response => response.json())
        .then(repos => {
            const select = document.getElementById('statsRepo');
            select.innerHTML = repos.map(repo => 
                `<option value="${repo.name}">${repo.name}</option>`
            ).join('');
            
            // If we have repositories, select the first one and load its stats
            if (repos.length > 0) {
                select.value = repos[0].name;
                loadStats();
            }
        })
        .catch(error => {
            console.error('Error loading repositories:', error);
            const select = document.getElementById('statsRepo');
            select.innerHTML = '<option value="">Error loading repositories</option>';
        });
}

// Load stats for selected repository
export function loadStats() {
    const repoName = document.getElementById('statsRepo').value;
    if (!repoName) {
        document.getElementById('totalFiles').textContent = '-';
        document.getElementById('totalLinks').textContent = '-';
        document.getElementById('repoSize').textContent = '-';
        document.getElementById('https-count').textContent = '-';
        document.getElementById('http-count').textContent = '-';
        document.getElementById('topCategories').innerHTML = 'Please select a repository';
        document.getElementById('topDomains').innerHTML = 'Please select a repository';
        return;
    }

    fetch(`/stats?repo=${encodeURIComponent(repoName)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load stats');
            }
            return response.json();
        })
        .then(data => {
            document.getElementById('totalFiles').textContent = data.TotalFiles;
            document.getElementById('totalLinks').textContent = data.TotalLinks;
            document.getElementById('repoSize').textContent = formatBytes(data.TotalSize);
            document.getElementById('https-count').textContent = data.ProtocolStats.https || 0;
            document.getElementById('http-count').textContent = data.ProtocolStats.http || 0;
            
            document.getElementById('topCategories').innerHTML = data.Categories
                .slice(0, 10)
                .map(cat => `
                    <div class="stats-list-item">
                        <span class="stats-list-label">${cat.Name}</span>
                        <span class="stats-list-value">${cat.LinkCount}</span>
                    </div>
                `).join('');
            
            const sortedDomains = Object.entries(data.DomainsCount)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10);
            
            document.getElementById('topDomains').innerHTML = sortedDomains
                .map(([domain, count]) => `
                    <div class="stats-list-item">
                        <span class="stats-list-label">${domain}</span>
                        <span class="stats-list-value">${count}</span>
                    </div>
                `).join('');
        })
        .catch(error => {
            console.error('Error loading stats:', error);
            document.getElementById('totalFiles').textContent = '-';
            document.getElementById('totalLinks').textContent = '-';
            document.getElementById('repoSize').textContent = '-';
            document.getElementById('https-count').textContent = '-';
            document.getElementById('http-count').textContent = '-';
            document.getElementById('topCategories').innerHTML = 'Error loading stats';
            document.getElementById('topDomains').innerHTML = 'Error loading stats';
        });
} 