// Global constants
const CMC_API_URL = 'https://pro-api.coinmarketcap.com/v2';
const COIN_ID = '5994'; // SHIB ID on CoinMarketCap
const API_CACHE_DURATION = 60000; // 1 minute
const MAX_RETRIES = 3;
const API_HEADERS = {
    'X-CMC_PRO_API_KEY': '39f838a8-b264-4fdc-87d9-97d8fadc5361',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
};
const API_TIMEOUT = 10000; // 10 seconds timeout

// Add after constants
async function checkAPIStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(`${CMC_API_URL}/cryptocurrency/info?id=${COIN_ID}`, {
            signal: controller.signal,
            headers: API_HEADERS
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('CMC API Status Check Failed:', error);
        return false;
    }
}

// State management
let priceAlerts = [];
let dataCache = null;
let retryCount = 0;
let priceRefreshInterval;

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
    
    // Update UI to show error state
    const elements = {
        price: 'API Unavailable',
        'price-mini': 'Error',
        marketCap: '--',
        volume: '--',
        rank: '--',
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
                <p>CoinGecko API is currently unavailable</p>
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
async function fetchShibaData() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.add('updating');

    try {
        const response = await fetch(`${CMC_API_URL}/cryptocurrency/quotes/latest?id=${COIN_ID}&convert=USD`, {
            method: 'GET',
            headers: API_HEADERS
        });
        
        if (!response.ok) {
            throw new Error(`CMC API Error: ${response.status}`);
        }

        const result = await response.json();
        
        if (!result.data || !result.data[COIN_ID]) {
            throw new Error('Invalid CMC API response structure');
        }

        const data = result.data[COIN_ID];
        
        // Cache the data
        dataCache = {
            price: data.quote.USD.price,
            marketCap: data.quote.USD.market_cap,
            volume: data.quote.USD.volume_24h,
            rank: data.cmc_rank,
            change24h: data.quote.USD.percent_change_24h,
            lastUpdated: data.quote.USD.last_updated
        };

        // Update UI
        updatePriceDisplay(dataCache);
        
        if (syncIcon) syncIcon.classList.remove('updating');
        return dataCache;

    } catch (error) {
        handleFetchError(error);
        return null;
    }
}

// Add the chart data fetching function
async function fetchChartData(period = '7d') {
    try {
        const timeStart = getTimeStart(period);
        const count = period === '24h' ? 24 : period === '7d' ? 168 : period === '30d' ? 720 : 2160;

        const response = await fetch(`${CMC_API_URL}/cryptocurrency/quotes/historical?id=${COIN_ID}&count=${count}&interval=hourly&convert=USD`, {
            headers: API_HEADERS
        });

        if (!response.ok) throw new Error('Failed to fetch CMC chart data');

        const result = await response.json();
        
        if (!result.data || !result.data.quotes) {
            throw new Error('Invalid CMC chart data structure');
        }

        const chartData = result.data.quotes.map(quote => ({
            timestamp: new Date(quote.timestamp).getTime(),
            price: quote.quote.USD.price
        }));

        updateChart(chartData, period);
        return chartData;
    } catch (error) {
        console.error('Chart Error:', error);
        showChartError('Unable to load CMC chart data');
    }
}

// Helper function for chart timeframes
function getTimeStart(period) {
    const now = new Date();
    switch (period) {
        case '24h':
            return new Date(now - 24 * 60 * 60 * 1000).toISOString();
        case '7d':
            return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        case '30d':
            return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
        case '90d':
            return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString();
        default:
            return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
}

// Add chart update function
function updateChart(priceData, period) {
    const ctx = document.getElementById('priceChart');
    if (!ctx) return;

    // Destroy existing chart
    if (window.priceChart instanceof Chart) {
        window.priceChart.destroy();
    }

    const chartData = priceData.map(({ timestamp, price }) => ({
        x: new Date(timestamp),
        y: price
    }));

    window.priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'SHIB Price (USD)',
                data: chartData,
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
                        unit: period === '24h' ? 'hour' : 'day',
                        tooltipFormat: period === '24h' ? 'HH:mm' : 'MMM d',
                        displayFormats: {
                            hour: 'HH:mm',
                            day: 'MMM d'
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
                            return '$' + value.toFixed(8);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: '#ffd700',
                    bodyColor: '#ffffff',
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return 'SHIB: $' + context.parsed.y.toFixed(8);
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
function handleFetchError(error) {
    console.error('Fetch error:', error);
    
    // Check if it's a CORS error
    if (error.message.includes('CORS') || error.message.includes('cross-origin')) {
        showNotification('API access restricted. Using cached data if available.', 'warning');
        
        if (dataCache?.price) {
            updatePriceFromCache();
        } else {
            displayErrorState('API access restricted');
        }
        return null;
    }
    
    // Handle other errors
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(fetchShibaData, 2000);
        return null;
    }
    
    displayErrorState('Unable to load data');
    return null;
}

function handleError() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.remove('updating');
    
    if (dataCache?.price) {
        updatePriceFromCache();
    } else {
        updateUIForError();
    }
}

// UI Updates
function updatePriceDisplay(data) {
    const elements = {
        price: { id: 'price', value: formatCryptoPrice(data.price) },
        priceMini: { id: 'price-mini', value: formatCryptoPrice(data.price) },
        marketCap: { id: 'marketCap', value: formatNumber(data.marketCap) },
        volume: { id: 'volume', value: formatNumber(data.volume) },
        rank: { id: 'rank', value: `#${data.rank}` },
        change: { id: 'changePercent', value: `${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%` }
    };

    Object.entries(elements).forEach(([key, { id, value }]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (key === 'change') {
                element.className = data.change24h >= 0 ? 'up' : 'down';
            }
        }
    });
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
    return price.toFixed(2);
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

