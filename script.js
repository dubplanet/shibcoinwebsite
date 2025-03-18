// Global constants
const DIA_API_URL = 'https://api.diadata.org/v1';
const QUOTE_ENDPOINT = '/assetQuotation';
const CHART_ENDPOINT = '/chart';
const BLOCKCHAIN = 'Ethereum';
const SHIB_ADDRESS = '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE';
const API_TIMEOUT = 10000;
const API_HEADERS = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
};

// Add missing constants
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
        chartContainer: document.querySelector('.chart-container'),
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
        // Check API availability first
        const apiAvailable = await checkAPIStatus();
        if (!apiAvailable) {
            throw new Error('API is not available');
        }

        initializeContainers();
        initializeEventListeners();
        loadSavedAlerts();

        // Initial data fetch with retry logic
        let attempts = 0;
        let data = null;

        while (!data && attempts < MAX_RETRIES) {
            data = await fetchShibaData();
            if (!data) {
                attempts++;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between retries
            }
        }

        if (data) {
            // Start refresh interval
            priceRefreshInterval = setInterval(fetchShibaData, API_CACHE_DURATION);
            
            // Load initial chart
            await fetchChartData('7d');
            
            // Initialize chart controls
            initializeChartControls();
        } else {
            throw new Error('Failed to fetch initial data');
        }
    } catch (error) {
        handleInitializationError(error);
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

// Add chart controls initialization
function initializeChartControls() {
    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.timeframe-btn').forEach(btn => 
                btn.classList.remove('active')
            );
            this.classList.add('active');
            fetchChartData(this.getAttribute('data-period'));
        });
    });
}

// Core data fetching
// Update fetchShibaData function
async function fetchShibaData() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.add('updating');

    try {
        const response = await fetch(`${DIA_API_URL}/quotation/${BLOCKCHAIN}/${SHIB_ADDRESS}`, {
            headers: API_HEADERS
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Validate data structure
        if (!data || typeof data.Price === 'undefined') {
            throw new Error('Invalid data structure received');
        }

        dataCache = {
            price: parseFloat(data.Price) || 0,
            marketCap: data.MarketCap || 0,
            volume: data.Volume24 || 0,
            lastUpdated: data.Time || new Date().toISOString(),
            change24h: calculatePriceChange(data.Price, data.PriceYesterday)
        };

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

// Add the chart data fetching function
// Update fetchChartData function
async function fetchChartData(period = '7d') {
    try {
        const endDate = new Date().toISOString();
        const startDate = getTimeStart(period);

        const response = await fetch(
            `${DIA_API_URL}/chart/${BLOCKCHAIN}/${SHIB_ADDRESS}?starttime=${startDate}&endtime=${endDate}`, {
                headers: API_HEADERS
            }
        );

        if (!response.ok) {
            throw new Error(`Chart data fetch failed: ${response.status}`);
        }

        const result = await response.json();
        console.log('Chart Data Response:', result); // Debug log

        if (!result || !result.Data) {
            throw new Error('Invalid chart data structure');
        }

        const chartData = result.Data
            .filter(point => point && point.Price > 0)
            .map(point => ({
                x: new Date(point.Time).getTime(),
                y: point.Price
            }))
            .sort((a, b) => a.x - b.x);

        console.log(`Processed ${chartData.length} chart points`); // Debug log
        updateChart(chartData, period);
        return chartData;

    } catch (error) {
        console.error('Chart Error:', error);
        showChartError(`Unable to load SHIB price history: ${error.message}`);
        return null;
    }
}

// Helper function for chart timeframes
// Update getTimeStart function to use proper format
function getTimeStart(period) {
    const now = new Date();
    const timestamp = now.getTime();
    
    switch (period) {
        case '24h':
            return new Date(timestamp - (24 * 60 * 60 * 1000)).toISOString();
        case '7d':
            return new Date(timestamp - (7 * 24 * 60 * 60 * 1000)).toISOString();
        case '30d':
            return new Date(timestamp - (30 * 24 * 60 * 60 * 1000)).toISOString();
        case '90d':
            return new Date(timestamp - (90 * 24 * 60 * 60 * 1000)).toISOString();
        default:
            return new Date(timestamp - (7 * 24 * 60 * 60 * 1000)).toISOString();
    }
}

// Add chart update function
// Add debug logging to help troubleshoot
function updateChart(priceData, period) {
    console.log(`Updating chart with ${priceData.length} data points for period: ${period}`);
    
    const ctx = document.getElementById('priceChart');
    if (!ctx) {
        console.error('Chart canvas not found');
        return;
    }

    // Destroy existing chart if it exists
    if (window.priceChart instanceof Chart) {
        window.priceChart.destroy();
    }

    window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'SHIB Price (USD)',
                data: priceData,
                borderColor: '#ffd700',
                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHitRadius: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: getPeriodUnit(period),
                        displayFormats: {
                            minute: 'HH:mm',
                            hour: 'HH:mm',
                            day: 'MMM d',
                            week: 'MMM d',
                            month: 'MMM yyyy'
                        }
                    },
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        maxRotation: 0
                    }
                },
                y: {
                    position: 'right',
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)',
                        callback: function(value) {
                            return '$' + formatCryptoPrice(value);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffd700',
                    bodyColor: '#ffffff',
                    callbacks: {
                        label: function(context) {
                            return 'SHIB: $' + formatCryptoPrice(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

function showChartError(message = 'Unable to load chart data') {
    const container = document.querySelector('.chart-container');
    if (container) {
        container.innerHTML = `
            <div class="chart-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>${message}</p>
                <button onclick="retryChartLoad()" class="retry-btn">
                    Try Again
                </button>
            </div>
        `;
    }
}

function retryChartLoad() {
    const activeButton = document.querySelector('.timeframe-btn.active');
    const period = activeButton ? activeButton.getAttribute('data-period') : '7d';
    fetchChartData(period);
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
        marketCap: { id: 'marketCap', value: '--' },
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
function updatePriceDisplay(data) {
    const elements = {
        price: { id: 'price', value: formatCryptoPrice(data.price) },
        priceMini: { id: 'price-mini', value: formatCryptoPrice(data.price) },
        marketCap: { id: 'marketCap', value: formatNumber(data.marketCap) },
        volume: { id: 'volume', value: formatNumber(data.volume) },
        change: { 
            id: 'changePercent', 
            value: `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%`,
            className: data.change24h >= 0 ? 'up' : 'down'
        }
    };

    Object.entries(elements).forEach(([key, { id, value, className }]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (className) {
                element.className = className;
            }
        }
    });

    // Also update mini price change indicator if it exists
    const changeMini = document.getElementById('change-mini');
    if (changeMini) {
        changeMini.textContent = `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%`;
        changeMini.className = data.change24h >= 0 ? 'up' : 'down';
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
function formatCryptoPrice(price) {
    if (!price && price !== 0) return '0.00000000';
    
    if (price < 0.00001) {
        return price.toFixed(10);
    } else if (price < 0.0001) {
        return price.toFixed(8);
    } else if (price < 0.01) {
        return price.toFixed(6);
    } else if (price < 1) {
        return price.toFixed(4);
    }
    return price.toFixed(2); // Add missing return statement
}

function formatNumber(num) {
    if (!num) return '$0';
    
    if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
        return `$${(num / 1e3).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
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

// Add helper function for chart time units
function getPeriodUnit(period) {
    switch (period) {
        case '24h': return 'hour';
        case '7d': return 'day';
        case '30d': return 'week';
        case '90d': return 'month';
        default: return 'day';
    }
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

