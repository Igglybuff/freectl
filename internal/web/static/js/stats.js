import { showToast } from "./ui.js";
import { formatBytes } from "./ui.js";
import { getSourceColor } from "./ui.js";

// State management
let loadingStats = false;
let currentSource = null;

// Load sources into the source selector
export function loadSources() {
  fetch("/sources/list")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        throw new Error(data.error || "Failed to load sources");
      }

      const sourceSelect = document.getElementById("statsSource");
      if (!sourceSelect) return;

      // Add "All sources" as the first option
      sourceSelect.innerHTML =
        '<option value="">All sources</option>' +
        data.sources
          .filter((source) => source.enabled)
          .map(
            (source) =>
              `<option value="${source.name}">${escapeHtml(source.name)}</option>`,
          )
          .join("");

      // Load combined stats by default
      loadStats("");
    })
    .catch((error) => {
      console.error("Error loading sources:", error);
      const sourceSelect = document.getElementById("statsSource");
      if (sourceSelect) {
        sourceSelect.innerHTML =
          '<option value="">Error loading sources</option>';
      }
      showToast("Failed to load sources", true);
    });
}

// Load stats for selected source or all sources
export function loadStats(sourceName = "") {
  // Prevent multiple concurrent requests
  if (loadingStats) {
    return;
  }

  loadingStats = true;
  currentSource = sourceName;

  const elements = getStatsElements();

  // Check if we're on the stats tab
  if (!elements.totalLinks) {
    loadingStats = false;
    return;
  }

  // Set loading states
  setLoadingState(elements, true);

  if (!sourceName) {
    loadCombinedStats(elements);
  } else {
    loadSingleSourceStats(sourceName, elements);
  }
}

// Get all stats elements with null checks
function getStatsElements() {
  return {
    totalLinks: document.getElementById("totalLinks"),
    sourceSize: document.getElementById("sourceSize"),
    httpsCount: document.getElementById("https-count"),
    httpCount: document.getElementById("http-count"),
    topCategories: document.getElementById("topCategories"),
    topDomains: document.getElementById("topDomains"),
  };
}

// Set loading state for all elements
function setLoadingState(elements, isLoading) {
  const loadingText = isLoading ? "Loading..." : "-";

  if (elements.totalLinks) elements.totalLinks.textContent = loadingText;
  if (elements.sourceSize) elements.sourceSize.textContent = loadingText;
  if (elements.httpsCount) elements.httpsCount.textContent = loadingText;
  if (elements.httpCount) elements.httpCount.textContent = loadingText;

  if (isLoading) {
    if (elements.topCategories)
      elements.topCategories.innerHTML = "Loading categories...";
    if (elements.topDomains)
      elements.topDomains.innerHTML = "Loading domains...";
  }
}

// Load combined stats from all enabled sources
function loadCombinedStats(elements) {
  fetch("/sources/list")
    .then((response) => response.json())
    .then((data) => {
      if (!data.success) {
        throw new Error(data.error || "Failed to load sources");
      }

      const enabledSources = data.sources.filter((source) => source.enabled);

      if (enabledSources.length === 0) {
        throw new Error("No enabled sources found");
      }

      const combinedStats = {
        TotalLinks: 0,
        TotalSize: 0,
        Categories: [],
        DomainsCount: {},
        ProtocolStats: { https: 0, http: 0 },
      };

      // Track which sources have data and which don't
      let sourcesWithData = [];
      let sourcesWithoutData = [];

      // Load stats for each enabled source
      const promises = enabledSources.map((source) =>
        fetch(`/stats?source=${encodeURIComponent(source.name)}`)
          .then((response) => {
            if (!response.ok) {
              if (response.status === 404) {
                console.info(`No cached data for source: ${source.name}`);
                sourcesWithoutData.push(source.name);
              } else {
                console.warn(
                  `Failed to load stats for ${source.name}: ${response.status}`,
                );
                sourcesWithoutData.push(source.name);
              }
              return null; // Return null for failed requests
            }
            return response.json();
          })
          .then((data) => {
            if (!data) return null;

            sourcesWithData.push(source.name);

            // Safely add total links and size
            combinedStats.TotalLinks += safeNumber(data.TotalLinks);
            combinedStats.TotalSize += safeNumber(data.TotalSize);

            // Safely combine categories
            combineCategories(combinedStats.Categories, data.Categories);

            // Safely combine domains
            combineDomains(combinedStats.DomainsCount, data.DomainsCount);

            // Safely combine protocols
            combineProtocols(combinedStats.ProtocolStats, data.ProtocolStats);

            return data;
          })
          .catch((error) => {
            console.error(
              `Network error loading stats for ${source.name}:`,
              error,
            );
            sourcesWithoutData.push(source.name);
            return null; // Continue with other sources
          }),
      );

      Promise.all(promises)
        .then((results) => {
          // Check if we got at least some results
          const successfulResults = results.filter((r) => r !== null);

          if (successfulResults.length === 0) {
            if (sourcesWithoutData.length > 0) {
              showToast(
                `No cached data found for sources: ${sourcesWithoutData.join(", ")}. Try updating sources first.`,
                true,
              );
            } else {
              showToast("Failed to load stats from any source", true);
            }
            clearStats(elements);
            return;
          }

          // Sort categories by link count
          combinedStats.Categories.sort(
            (a, b) => (b.LinkCount || 0) - (a.LinkCount || 0),
          );

          updateStatsDisplay(combinedStats, elements);

          // Show info about sources without data, if any
          if (sourcesWithoutData.length > 0 && sourcesWithData.length > 0) {
            showToast(
              `Stats shown for ${sourcesWithData.length} of ${enabledSources.length} sources. ${sourcesWithoutData.length} sources need updating.`,
              false,
            );
          }
        })
        .catch((error) => {
          console.error("Error combining stats:", error);
          showToast("Failed to load combined stats", true);
          clearStats(elements);
        })
        .finally(() => {
          loadingStats = false;
        });
    })
    .catch((error) => {
      console.error("Error loading sources for combined stats:", error);
      showToast("Failed to load sources", true);
      clearStats(elements);
      loadingStats = false;
    });
}

// Load stats for a single source
function loadSingleSourceStats(sourceName, elements) {
  fetch(`/stats?source=${encodeURIComponent(sourceName)}`)
    .then((response) => {
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `No cached data found for "${sourceName}". Try updating this source first.`,
          );
        } else {
          throw new Error(`Failed to load stats (${response.status})`);
        }
      }
      return response.json();
    })
    .then((data) => {
      updateStatsDisplay(data, elements);
    })
    .catch((error) => {
      console.error(`Error loading stats for ${sourceName}:`, error);
      showToast(error.message, true);
      clearStats(elements);
    })
    .finally(() => {
      loadingStats = false;
    });
}

// Combine categories from multiple sources
function combineCategories(targetCategories, sourceCategories) {
  if (!Array.isArray(sourceCategories)) return;

  sourceCategories.forEach((cat) => {
    if (!cat || !cat.Name) return;

    const existingIndex = targetCategories.findIndex(
      (c) => c.Name === cat.Name,
    );
    if (existingIndex >= 0) {
      targetCategories[existingIndex].LinkCount += safeNumber(cat.LinkCount);
    } else {
      targetCategories.push({
        Name: cat.Name,
        LinkCount: safeNumber(cat.LinkCount),
      });
    }
  });
}

// Combine domains from multiple sources
function combineDomains(targetDomains, sourceDomains) {
  if (!sourceDomains || typeof sourceDomains !== "object") return;

  Object.entries(sourceDomains).forEach(([domain, count]) => {
    if (!domain) return;
    targetDomains[domain] = (targetDomains[domain] || 0) + safeNumber(count);
  });
}

// Combine protocol stats from multiple sources
function combineProtocols(targetProtocols, sourceProtocols) {
  if (!sourceProtocols || typeof sourceProtocols !== "object") return;

  targetProtocols.https += safeNumber(sourceProtocols.https);
  targetProtocols.http += safeNumber(sourceProtocols.http);
}

// Update the stats display with new data
function updateStatsDisplay(data, elements) {
  // Update general stats
  if (elements.totalLinks) {
    elements.totalLinks.textContent = safeNumber(
      data.TotalLinks,
    ).toLocaleString();
  }
  if (elements.sourceSize) {
    elements.sourceSize.textContent = formatBytes(safeNumber(data.TotalSize));
  }

  // Update protocol stats with safe division
  const httpsCount = safeNumber(data.ProtocolStats?.https);
  const httpCount = safeNumber(data.ProtocolStats?.http);
  const totalProtocols = httpsCount + httpCount;

  if (elements.httpsCount) {
    const httpsPercentage =
      totalProtocols > 0
        ? ((httpsCount / totalProtocols) * 100).toFixed(1)
        : "0.0";
    elements.httpsCount.textContent = `${httpsCount.toLocaleString()} (${httpsPercentage}%)`;
  }
  if (elements.httpCount) {
    const httpPercentage =
      totalProtocols > 0
        ? ((httpCount / totalProtocols) * 100).toFixed(1)
        : "0.0";
    elements.httpCount.textContent = `${httpCount.toLocaleString()} (${httpPercentage}%)`;
  }

  // Update categories
  if (elements.topCategories) {
    const categories = Array.isArray(data.Categories) ? data.Categories : [];
    elements.topCategories.innerHTML =
      categories
        .slice(0, 12)
        .map((cat) => createStatsListItem(cat.Name, safeNumber(cat.LinkCount)))
        .join("") || '<div class="no-data">No categories found</div>';
  }

  // Update domains
  if (elements.topDomains) {
    let domains = [];

    // Handle different domain data formats
    if (Array.isArray(data.Domains)) {
      domains = data.Domains;
    } else if (data.DomainsCount && typeof data.DomainsCount === "object") {
      domains = Object.entries(data.DomainsCount).map(([name, linkCount]) => ({
        Name: name,
        LinkCount: safeNumber(linkCount),
      }));
    }

    elements.topDomains.innerHTML =
      domains
        .sort((a, b) => safeNumber(b.LinkCount) - safeNumber(a.LinkCount))
        .slice(0, 12)
        .map((domain) =>
          createStatsListItem(domain.Name, safeNumber(domain.LinkCount)),
        )
        .join("") || '<div class="no-data">No domains found</div>';
  }
}

// Create a stats list item with proper escaping
function createStatsListItem(name, count) {
  return `
        <div class="stats-list-item">
            <span class="stats-list-label" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
            <span class="stats-list-value">${safeNumber(count).toLocaleString()}</span>
        </div>
    `;
}

// Clear all stats displays
function clearStats(elements) {
  if (elements.totalLinks) elements.totalLinks.textContent = "-";
  if (elements.sourceSize) elements.sourceSize.textContent = "-";
  if (elements.httpsCount) elements.httpsCount.textContent = "-";
  if (elements.httpCount) elements.httpCount.textContent = "-";
  if (elements.topCategories)
    elements.topCategories.innerHTML =
      '<div class="no-data">No data available</div>';
  if (elements.topDomains)
    elements.topDomains.innerHTML =
      '<div class="no-data">No data available</div>';
}

// Utility function to safely convert to number
function safeNumber(value) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

// Utility function to escape HTML
function escapeHtml(text) {
  if (typeof text !== "string") return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Initialize event listeners
document.addEventListener("DOMContentLoaded", () => {
  const sourceSelect = document.getElementById("statsSource");
  if (sourceSelect) {
    sourceSelect.addEventListener("change", function () {
      // Only load if we're not already loading
      if (!loadingStats) {
        loadStats(this.value);
      }
    });
  }
});
