// If this declaration exists multiple times, you should remove the extras
const DIA_API_URL = 'https://api.diadata.org/v1';
const SHIB_SYMBOL = 'SHIB';
const API_TIMEOUT = 10000;
const API_HEADERS = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
};

// Cache and state management constants
const MAX_RETRIES = 3;
const API_CACHE_DURATION = 60000; // 1 minute
let dataCache = null;
let priceRefreshInterval = null;

// Add after constants
async function checkAPIStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(`${DIA_API_URL}/quotation/SHIB`, {
            signal: controller.signal,
            headers: API_HEADERS
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('DIA API Status Check Failed:', error);
        return false;
    }
}

// State management
let priceAlerts = [];
let retryCount = 0;

// Initialize containers function
function initializeContainers() {
    const containers = {
        priceContainer: document.getElementById('price'),
        alertsContainer: document.getElementById('alertsList'),
        notificationContainer: document.getElementById('notificationContainer')
    };

    // Validate required containers
    Object.entries(containers).forEach(([key, element]) => {
        if (!element) {
            console.error(`Required container ${key} not found`);
        }
    });
}

// Replace the existing initialization
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize data
        await fetchShibaData();
        
        // Set up refresh interval
        setInterval(fetchShibaData, 60000);

        // Initialize UI components
        initializeMobileMenu();
        initializeFAQ();
        initializeCookieConsent();

        // Initialize alerts if needed
        loadSavedAlerts();

    } catch (error) {
        console.error('Initialization error:', error);
        displayErrorState('Error loading data');
    }
});

// Add initialization error handler
function handleInitializationError(error) {
    console.error('Initialization error:', error);
    
    const elements = {
        price: 'API Unavailable',
        'price-mini': 'Error',
        marketCap: '--',
        volume: '--',
        changePercent: '--'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.add('error');
        }
    });

    // Show error message to user
    const container = document.querySelector('.chart-container');
    if (container) {
        container.innerHTML = `
            <div class="chart-error">
                <i class="fas fa-exclamation-triangle"></i>
                <p>API is currently unavailable</p>
                <p class="error-details">Please try again later</p>
                <button onclick="location.reload()" class="retry-btn">
                    Retry
                </button>
            </div>
        `;
    }
}

// Core data fetching
// Update fetchShibaData function
async function fetchShibaData() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.add('updating');

    try {
        // Get current price data using the correct endpoint
        const response = await fetch(`${DIA_API_URL}/quotation/${SHIB_SYMBOL}`, {
            headers: API_HEADERS
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Raw API Response:', data); // Debug log

        if (!data) {
            throw new Error('Invalid data structure received');
        }

        // Update cache with new data
        dataCache = {
            price: parseFloat(data.Price) || 0,
            marketCap: parseFloat(data.MarketCap) || 0,
            volume: parseFloat(data.VolumeYesterdayUSD) || 0,
            lastUpdated: data.Time,
            change24h: calculatePriceChange(data.Price, data.PriceYesterday)
        };

        console.log('Processed Data:', dataCache); // Debug log
        updatePriceDisplay(dataCache);
        return dataCache;

    } catch (error) {
        console.error('DIA API Error:', error);
        handleFetchError(error);
        return null;
    } finally {
        if (syncIcon) syncIcon.classList.remove('updating');
    }
}

// Error handling
// Remove duplicate error handlers
// Remove handleError() function since it's redundant
// Update handleFetchError
function handleFetchError(error) {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.remove('updating');

    console.error('Fetch error:', error);
    
    if (dataCache?.price) {
        updatePriceFromCache();
        showNotification('Using cached data - Connection issue', 'warning');
    } else {
        displayErrorState('Unable to load price data');
        showNotification('Failed to fetch price data', 'error');
    }
}

function updateUIForError() {
    const elements = {
        price: 'Error',
        'price-mini': 'Error',
        marketCap: '--',
        volume: '--',
        changePercent: '--'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.add('error');
        }
    });
}

// Add missing displayErrorState function
function displayErrorState(message = 'Error loading data') {
    const elements = {
        price: { id: 'price', value: message },
        priceMini: { id: 'price-mini', value: 'Error' },
        volume: { id: 'volume', value: '--' }
    };

    Object.entries(elements).forEach(([key, { id, value }]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            element.classList.add('error');
        }
    });
}

// UI Updates
// Update updatePriceDisplay function to include last updated time
function updatePriceDisplay(data) {
    const elements = {
        price: { id: 'price', value: formatCryptoPrice(data.price) },
        priceMini: { id: 'price-mini', value: formatCryptoPrice(data.price) },
        volume: { id: 'volume', value: formatNumber(data.volume) }
    };

    Object.entries(elements).forEach(([key, { id, value }]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });

    // Update last updated timestamp
    const lastUpdateElement = document.getElementById('lastUpdate');
    if (lastUpdateElement) {
        const timestamp = new Date(data.lastUpdated);
        const timeString = timestamp.toLocaleTimeString();
        lastUpdateElement.textContent = `Last updated: ${timeString}`;
    }

    // Update sync icon
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) {
        syncIcon.classList.remove('updating');
        // Add brief animation
        syncIcon.classList.add('updated');
        setTimeout(() => syncIcon.classList.remove('updated'), 1000);
    }
}

// Alert System
function updateAlertsList() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;

    if (priceAlerts.length === 0) {
        alertsList.innerHTML = '<div class="empty-alert-message">No alerts set</div>';
        return;
    }

    const sortedAlerts = [...priceAlerts].sort((a, b) => 
        a.type === b.type ? (a.type === 'above' ? a.price - b.price : b.price - a.price) : (a.type === 'above' ? -1 : 1)
    );

    alertsList.innerHTML = sortedAlerts.map(alert => `
        <div class="alert-item" data-id="${alert.id}">
            <div class="alert-condition">
                <span class="direction">${alert.type === 'above' ? '↗' : '↘'}</span>
                <span>${alert.type === 'above' ? 'Above' : 'Below'} $${formatCryptoPrice(alert.price)}</span>
            </div>
            <button class="delete-alert" data-id="${alert.id}">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `).join('');

    // Add delete handlers
    alertsList.querySelectorAll('.delete-alert').forEach(button => {
        button.onclick = () => deleteAlert(parseInt(button.dataset.id));
    });
}

// Utility Functions
function formatNumber(num) {
    if (!num || isNaN(num)) return '$0';
    
    // Use absolute value for formatting but keep sign for display
    const absNum = Math.abs(num);
    let formatted;
    
    if (absNum >= 1e9) {
        formatted = `${(absNum / 1e9).toFixed(2)}B`;
    } else if (absNum >= 1e6) {
        formatted = `${(absNum / 1e6).toFixed(2)}M`;
    } else if (absNum >= 1e3) {
        formatted = `${(absNum / 1e3).toFixed(2)}K`;
    } else {
        formatted = absNum.toFixed(2);
    }
    
    // Add dollar sign and handle negative numbers
    return `$${num < 0 ? '-' : ''}${formatted}`;
}

function formatCryptoPrice(price) {
    if (!price || isNaN(price)) return '0.00000000';
    
    const absPrice = Math.abs(price);
    if (absPrice < 0.00001) {
        return price.toFixed(10);
    } else if (absPrice < 0.0001) {
        return price.toFixed(8);
    } else if (absPrice < 0.01) {
        return price.toFixed(6);
    } else if (absPrice < 1) {
        return price.toFixed(4);
    }
    return price.toFixed(2);
}

// Cleanup
window.addEventListener('beforeunload', () => {
    clearInterval(priceRefreshInterval);
});

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
    `;

    container.appendChild(notification);
    setTimeout(() => notification.remove(), 5000);
}

// Helper function to calculate price change
function calculatePriceChange(currentPrice, yesterdayPrice) {
    if (!currentPrice || !yesterdayPrice) return 0;
    return ((currentPrice - yesterdayPrice) / yesterdayPrice) * 100;
}

function updatePriceFromCache() {
    if (!dataCache) return;
    
    updatePriceDisplay({
        ...dataCache,
        isCache: true
    });
    
    // Add cache indicator
    const priceElement = document.getElementById('price');
    if (priceElement) {
        priceElement.classList.add('cached');
    }
}

function initializeEventListeners() {
    // Chart timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.timeframe-btn').forEach(btn => 
                btn.classList.remove('active')
            );
            this.classList.add('active');
            fetchChartData(this.getAttribute('data-period'));
        });
    });

    // Alert form
    const alertForm = document.getElementById('alertForm');
    if (alertForm) {
        alertForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const price = parseFloat(this.querySelector('[name="alertPrice"]').value);
            const type = this.querySelector('[name="alertType"]').value;
            addPriceAlert(price, type);
        });
    }
}

// Add this helper function for formatting dates
function formatLastUpdated(timestamp) {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.floor((now - date) / 1000);

    if (diffSeconds < 60) {
        return 'Just now';
    } else if (diffSeconds < 3600) {
        const minutes = Math.floor(diffSeconds / 60);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleTimeString();
    }
}

