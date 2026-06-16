/**
 * BigQuery Release Notes Explorer - Client Logic
 */

// Global State
let allUpdates = [];
let filteredUpdates = [];
let currentFilter = 'all';
let currentSort = 'desc'; // 'desc' (newest) or 'asc' (oldest)
let selectedUpdateId = null;

// DOM Elements
const btnRefresh = document.getElementById('btn-refresh');
const refreshIcon = btnRefresh.querySelector('.refresh-icon');
const btnExportCsv = document.getElementById('btn-export-csv');
const syncStatus = document.getElementById('sync-status');
const searchInput = document.getElementById('search-input');
const btnClearSearch = document.getElementById('btn-clear-search');
const filterChips = document.getElementById('filter-chips');
const sortDesc = document.getElementById('sort-desc');
const sortAsc = document.getElementById('sort-asc');
const statsRow = document.getElementById('stats-row');
const statTotal = document.getElementById('stat-count-total');
const statFiltered = document.getElementById('stat-count-filtered');
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const btnRetry = document.getElementById('btn-retry');
const emptyState = document.getElementById('empty-state');
const btnResetFilters = document.getElementById('btn-reset-filters');
const notesFeed = document.getElementById('notes-feed');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const composerBadge = document.getElementById('composer-badge');
const composerDate = document.getElementById('composer-date');
const composerSourceText = document.getElementById('composer-source-text');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCountSpan = document.getElementById('char-count');
const charProgressBar = document.getElementById('char-progress-bar');
const btnCopyTweet = document.getElementById('btn-copy-tweet');
const btnSendTweet = document.getElementById('btn-send-tweet');

// Toast Element
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

/* ==========================================================================
   INITIALIZATION & EVENT LISTENERS
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Fetch initial data
    fetchReleaseNotes(false);

    // Event Listeners
    btnRefresh.addEventListener('click', () => fetchReleaseNotes(true));
    btnRetry.addEventListener('click', () => fetchReleaseNotes(true));
    btnExportCsv.addEventListener('click', exportToCsv);
    
    // Search
    searchInput.addEventListener('input', handleSearchInput);
    btnClearSearch.addEventListener('click', clearSearch);
    
    // Filters
    filterChips.addEventListener('click', handleFilterClick);
    btnResetFilters.addEventListener('click', resetFilters);
    
    // Sort
    sortDesc.addEventListener('click', () => setSortOrder('desc'));
    sortAsc.addEventListener('click', () => setSortOrder('asc'));
    
    // Modal Close
    btnCloseModal.addEventListener('click', closeModal);
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.style.display !== 'none') {
            closeModal();
        }
    });
    
    // Modal Actions
    tweetTextarea.addEventListener('input', updateCharCount);
    btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    btnSendTweet.addEventListener('click', postTweet);
});

/* ==========================================================================
   FEED FETCHING & STATE MANAGEMENT
   ========================================================================== */
async function fetchReleaseNotes(force = false) {
    showLoading(true);
    showError(false);
    showEmpty(false);
    btnExportCsv.style.display = 'none';
    
    // Animate refresh icon
    refreshIcon.classList.add('spin');
    btnRefresh.disabled = true;
    syncStatus.textContent = force ? "Fetching fresh updates..." : "Loading feed...";
    
    try {
        const url = `/api/release-notes${force ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            allUpdates = result.updates;
            
            // Format and display the last updated timestamp
            const updateTime = new Date(result.last_updated * 1000);
            const formattedTime = updateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            syncStatus.textContent = `Synced: ${formattedTime}`;
            
            // Show export button if there are updates
            btnExportCsv.style.display = allUpdates.length > 0 ? 'inline-flex' : 'none';
            
            // Apply filtering and sorting
            applyFiltersAndSort();
        } else {
            throw new Error(result.error || "Failed to retrieve release notes.");
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        errorMessage.textContent = err.message || "Could not load release notes from the server.";
        showError(true);
        syncStatus.textContent = "Sync failed";
    } finally {
        refreshIcon.classList.remove('spin');
        btnRefresh.disabled = false;
        showLoading(false);
    }
}

/* ==========================================================================
   FILTERING, SORTING & RENDERING
   ========================================================================== */
function handleSearchInput() {
    const value = searchInput.value.trim();
    btnClearSearch.style.display = value ? 'block' : 'none';
    applyFiltersAndSort();
}

function clearSearch() {
    searchInput.value = '';
    btnClearSearch.style.display = 'none';
    searchInput.focus();
    applyFiltersAndSort();
}

function handleFilterClick(e) {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    
    // Toggle active classes
    filterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    
    currentFilter = chip.dataset.filter;
    applyFiltersAndSort();
}

function setSortOrder(order) {
    if (currentSort === order) return;
    currentSort = order;
    
    if (order === 'desc') {
        sortDesc.classList.add('active');
        sortAsc.classList.remove('active');
    } else {
        sortAsc.classList.add('active');
        sortDesc.classList.remove('active');
    }
    
    applyFiltersAndSort();
}

function resetFilters() {
    searchInput.value = '';
    btnClearSearch.style.display = 'none';
    currentFilter = 'all';
    
    filterChips.querySelectorAll('.chip').forEach(c => {
        if (c.dataset.filter === 'all') {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });
    
    applyFiltersAndSort();
}

function applyFiltersAndSort() {
    const query = searchInput.value.toLowerCase().trim();
    
    // 1. Filter
    filteredUpdates = allUpdates.filter(update => {
        // Filter by Chip Type
        if (currentFilter !== 'all') {
            // Map chip filter type code to backend type string
            const filterType = filterChips.querySelector(`[data-filter="${currentFilter}"]`).dataset.type;
            if (update.type.toLowerCase() !== filterType.toLowerCase()) {
                return false;
            }
        }
        
        // Filter by Search text (Date, Type or Content)
        if (query) {
            const matchesContent = update.content_text.toLowerCase().includes(query);
            const matchesType = update.type.toLowerCase().includes(query);
            const matchesDate = update.date_formatted.toLowerCase().includes(query) || update.date.includes(query);
            return matchesContent || matchesType || matchesDate;
        }
        
        return true;
    });
    
    // 2. Sort
    filteredUpdates.sort((a, b) => {
        // Compare dates (YYYY-MM-DD)
        let comp = a.date.localeCompare(b.date);
        
        // If dates are identical, use sub-update index (from ID e.g., YYYY-MM-DD_index)
        if (comp === 0) {
            const indexA = parseInt(a.id.split('_')[1]) || 0;
            const indexB = parseInt(b.id.split('_')[1]) || 0;
            comp = indexA - indexB;
        }
        
        return currentSort === 'desc' ? -comp : comp;
    });
    
    // 3. Render
    renderFeed();
}

function renderFeed() {
    notesFeed.innerHTML = '';
    
    // Update Stats
    statTotal.textContent = allUpdates.length;
    statFiltered.textContent = filteredUpdates.length;
    statsRow.style.display = allUpdates.length > 0 ? 'flex' : 'none';
    
    if (filteredUpdates.length === 0) {
        showEmpty(true);
        notesFeed.style.display = 'none';
        return;
    }
    
    showEmpty(false);
    notesFeed.style.display = 'flex';
    
    // Group updates by date for display
    const groups = {};
    filteredUpdates.forEach(update => {
        if (!groups[update.date_formatted]) {
            groups[update.date_formatted] = [];
        }
        groups[update.date_formatted].push(update);
    });
    
    // Render group layouts
    Object.keys(groups).forEach(dateStr => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        const header = document.createElement('div');
        header.className = 'date-group-header';
        
        const title = document.createElement('h2');
        title.className = 'date-group-title';
        title.textContent = dateStr;
        
        const line = document.createElement('div');
        line.className = 'date-group-line';
        
        header.appendChild(title);
        header.appendChild(line);
        dateGroup.appendChild(header);
        
        // Render updates within this date
        groups[dateStr].forEach(update => {
            const card = document.createElement('div');
            card.className = 'update-card';
            card.dataset.id = update.id;
            card.dataset.type = update.type; // Sets css theme variables
            
            // Mark selected if active
            if (selectedUpdateId === update.id) {
                card.classList.add('selected');
            }
            
            // Allow card selection by clicking
            card.addEventListener('click', (e) => {
                // If they clicked on interactive elements like links or buttons, don't trigger select
                if (e.target.closest('a') || e.target.closest('button')) {
                    return;
                }
                selectCard(update.id);
            });
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="badge-wrapper">
                        <span class="type-badge">
                            ${getBadgeIcon(update.type)}
                            <span>${update.type}</span>
                        </span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-card-copy" title="Copy update to clipboard">
                            <i class="fa-regular fa-copy"></i>
                            <span>Copy</span>
                        </button>
                        <button class="btn-card-tweet" title="Tweet about this update">
                            <svg viewBox="0 0 24 24" width="14" height="14">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                            </svg>
                            <span>Tweet</span>
                        </button>
                        <button class="card-select-btn" title="Select update">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    ${update.content_html}
                </div>
                <div class="card-footer">
                    <span>ID: ${update.id}</span>
                    ${update.link ? `
                        <a href="${update.link}" target="_blank" rel="noopener noreferrer" class="original-link">
                            <span>View Source</span>
                            <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    ` : ''}
                </div>
            `;
            
            // Copy button click handler
            const btnCopy = card.querySelector('.btn-card-copy');
            btnCopy.addEventListener('click', () => {
                copyCardToClipboard(update);
            });

            // Tweet button click handler
            const btnTweet = card.querySelector('.btn-card-tweet');
            btnTweet.addEventListener('click', () => {
                openTweetComposer(update);
            });
            
            dateGroup.appendChild(card);
        });
        
        notesFeed.appendChild(dateGroup);
    });
}

function selectCard(id) {
    const previouslySelected = document.querySelector('.update-card.selected');
    if (previouslySelected) {
        previouslySelected.classList.remove('selected');
    }
    
    if (selectedUpdateId === id) {
        // Deselect if clicking the already selected card
        selectedUpdateId = null;
    } else {
        selectedUpdateId = id;
        const card = document.querySelector(`.update-card[data-id="${id}"]`);
        if (card) {
            card.classList.add('selected');
        }
    }
}

function getBadgeIcon(type) {
    switch(type) {
        case 'Feature': return '<i class="fa-solid fa-wand-magic-sparkles"></i>';
        case 'Change': return '<i class="fa-solid fa-clock-rotate-left"></i>';
        case 'Issue': return '<i class="fa-solid fa-bug"></i>';
        case 'Breaking': return '<i class="fa-solid fa-skull-crossbones"></i>';
        case 'Announcement': return '<i class="fa-solid fa-bullhorn"></i>';
        default: return '<i class="fa-solid fa-circle-info"></i>';
    }
}

/* ==========================================================================
   TWEET COMPOSER MODAL & TWITTER WEB INTENT
   ========================================================================== */
function openTweetComposer(update) {
    // Prep original preview metadata
    composerBadge.className = `type-badge`;
    // Explicitly styled by type variables
    const typeVar = document.createElement('div');
    typeVar.dataset.type = update.type;
    composerBadge.style.color = `var(--card-accent)`;
    
    // Apply styling to modal badge
    const badgeColors = {
        'Feature': { text: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.2)' },
        'Change': { text: '#60a5fa', bg: 'rgba(96, 165, 250, 0.1)', border: 'rgba(96, 165, 250, 0.2)' },
        'Issue': { text: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.2)' },
        'Breaking': { text: '#f87171', bg: 'rgba(248, 113, 113, 0.1)', border: 'rgba(248, 113, 113, 0.2)' },
        'Announcement': { text: '#c084fc', bg: 'rgba(192, 132, 252, 0.1)', border: 'rgba(192, 132, 252, 0.2)' }
    };
    
    const colors = badgeColors[update.type] || { text: '#38bdf8', bg: 'rgba(56, 189, 248, 0.1)', border: 'rgba(56, 189, 248, 0.2)' };
    composerBadge.style.color = colors.text;
    composerBadge.style.backgroundColor = colors.bg;
    composerBadge.style.borderColor = colors.border;
    composerBadge.innerHTML = `${getBadgeIcon(update.type)} <span>${update.type}</span>`;
    
    composerDate.textContent = update.date_formatted;
    composerSourceText.textContent = update.content_text;
    
    // Generate default tweet text
    const draftText = draftTweet(update);
    tweetTextarea.value = draftText;
    
    // Reset selections and show modal
    tweetModal.style.display = 'flex';
    tweetTextarea.focus();
    
    // Select the main text description for easy editing
    const selectStart = draftText.indexOf('"') + 1;
    const selectEnd = draftText.lastIndexOf('"');
    if (selectStart > 0 && selectEnd > selectStart) {
        tweetTextarea.setSelectionRange(selectStart, selectEnd);
    }
    
    updateCharCount();
}

function draftTweet(update) {
    const emojiMap = {
        'Feature': '🚀',
        'Change': '🔄',
        'Issue': '⚠️',
        'Breaking': '🚨',
        'Announcement': '📢'
    };
    
    const emoji = emojiMap[update.type] || '📝';
    const cleanType = update.type;
    const date = update.date_formatted;
    
    // X handles links as exactly 23 characters internally, but let's measure text lengths.
    // In our composer, we display actual text lengths. Let's make sure it fits safely.
    const linkSection = update.link ? `\n\nDetails: ${update.link}` : '';
    const hashtags = `\n\n#BigQuery #GoogleCloud`;
    
    // Base formatting:
    // "🚀 BigQuery Feature (June 15, 2026):\n\n"{body}"\n\nDetails: {link}\n\n#BigQuery #GoogleCloud"
    const prefix = `${emoji} BigQuery ${cleanType} (${date}):\n"`;
    const suffix = `"${linkSection}${hashtags}`;
    
    // Calculate space left for the body text.
    // Max characters = 280.
    // If a link is present, X reserves 23 characters for it.
    // Let's account for this in the layout calculations.
    const urlLengthForX = update.link ? 23 : 0;
    const linkTemplateLength = update.link ? '\n\nDetails: '.length : 0;
    const fixedLengthForX = prefix.length + suffix.length - (update.link ? update.link.length : 0) + urlLengthForX;
    
    const maxBodyLen = 280 - fixedLengthForX;
    let bodyText = update.content_text;
    
    if (bodyText.length > maxBodyLen) {
        bodyText = bodyText.substring(0, maxBodyLen - 3) + '...';
    }
    
    return `${prefix}${bodyText}${suffix}`;
}

function updateCharCount() {
    const text = tweetTextarea.value;
    const currentLength = text.length;
    const remaining = 280 - currentLength;
    
    charCountSpan.textContent = remaining;
    
    // Adjust colors and progress indicator based on length
    // Progress circle math: circumference = 2 * PI * r = 2 * 3.14159 * 14 = ~88
    const circumference = 2 * Math.PI * 14;
    const pct = Math.min(currentLength / 280, 1);
    const offset = circumference - (pct * circumference);
    charProgressBar.style.strokeDashoffset = offset;
    
    // Clear styles
    charCountSpan.className = 'char-count';
    btnSendTweet.disabled = currentLength > 280 || currentLength === 0;
    
    if (currentLength >= 280) {
        charCountSpan.classList.add('danger');
        charProgressBar.style.stroke = '#ef4444';
    } else if (currentLength >= 260) {
        charCountSpan.classList.add('warning');
        charProgressBar.style.stroke = '#fbbf24';
    } else {
        charProgressBar.style.stroke = '#1d9bf0';
    }
}

function closeModal() {
    tweetModal.style.display = 'none';
}

function copyTweetToClipboard() {
    const text = tweetTextarea.value;
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast("Copied to clipboard!");
        })
        .catch(err => {
            console.error('Failed to copy: ', err);
            showToast("Copy failed, please select manually.", 4000);
        });
}

function postTweet() {
    const text = tweetTextarea.value;
    if (text.length > 280) return;
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
    
    closeModal();
    showToast("Twitter intent opened!");
}

/* ==========================================================================
   UI UTILITY FUNCTIONS
   ========================================================================== */
function showLoading(show) {
    loadingState.style.display = show ? 'flex' : 'none';
}

function showError(show) {
    errorState.style.display = show ? 'flex' : 'none';
}

function showEmpty(show) {
    emptyState.style.display = show ? 'flex' : 'none';
}

function showToast(message, duration = 3000) {
    toastMessage.textContent = message;
    toast.style.display = 'flex';
    toast.style.animation = 'slideInLeft var(--transition-normal)';
    
    // Clear existing timeout if any
    if (toast.timeoutId) {
        clearTimeout(toast.timeoutId);
    }
    
    toast.timeoutId = setTimeout(() => {
        toast.style.animation = 'fadeIn var(--transition-normal) reverse';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300); // match transition duration
    }, duration);
}

/* ==========================================================================
   COPY TO CLIPBOARD (CARD)
   ========================================================================== */
function copyCardToClipboard(update) {
    const lines = [
        `[${update.type}] BigQuery Release Notes — ${update.date_formatted}`,
        '',
        update.content_text,
    ];
    if (update.link) {
        lines.push('', `Source: ${update.link}`);
    }
    const text = lines.join('\n');

    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('✅ Copied to clipboard!');
        })
        .catch(() => {
            showToast('⚠️ Copy failed — please select manually.', 4000);
        });
}

/* ==========================================================================
   EXPORT TO CSV
   ========================================================================== */
function exportToCsv() {
    if (filteredUpdates.length === 0) {
        showToast('Nothing to export — adjust filters first.', 3500);
        return;
    }

    // CSV columns
    const headers = ['ID', 'Date', 'Type', 'Description', 'Source Link'];

    const escapeCell = (value) => {
        // Wrap in quotes and escape any internal double-quotes
        const str = String(value ?? '').replace(/"/g, '""');
        return `"${str}"`;
    };

    const rows = filteredUpdates.map(u => [
        escapeCell(u.id),
        escapeCell(u.date_formatted),
        escapeCell(u.type),
        escapeCell(u.content_text),
        escapeCell(u.link),
    ].join(','));

    const csvContent = [headers.map(escapeCell).join(','), ...rows].join('\r\n');

    // Trigger browser download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');

    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    a.href     = url;
    a.download = `bigquery-release-notes-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`📥 Exported ${filteredUpdates.length} update(s) to CSV!`);
}
