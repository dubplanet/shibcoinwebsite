// Global constants
const COINGECKO_API_URL = '/api/coingecko'; // Use relative path for proxy
const COIN_ID = 'shiba-inu';
const API_CACHE_DURATION = 60000; // 1 minute
const MAX_RETRIES = 3;
const API_HEADERS = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache',
    'mode': 'cors'
};
const API_TIMEOUT = 10000; // 10 seconds timeout

// Add after constants
async function checkAPIStatus() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

        const response = await fetch(`${COINGECKO_API_URL}/ping`, {
            signal: controller.signal,
            headers: API_HEADERS
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('API Status Check Failed:', error);
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
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`, {
            method: 'GET',
            headers: API_HEADERS,
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        
        // Update price displays
        const price = data.market_data.current_price.usd;
        const change24h = data.market_data.price_change_percentage_24h;
        
        // Update main price
        document.getElementById('price').textContent = `$${formatCryptoPrice(price)}`;
        
        // Update mini price
        document.getElementById('price-mini').textContent = `$${formatCryptoPrice(price)}`;
        
        // Update 24h change
        const changePercent = document.getElementById('changePercent');
        const changeMini = document.getElementById('change-mini');
        const changeClass = change24h >= 0 ? 'up' : 'down';
        const changeSymbol = change24h >= 0 ? '+' : '';
        
        if (changePercent) {
            changePercent.textContent = `(${changeSymbol}${change24h.toFixed(2)}%)`;
            changePercent.className = changeClass;
        }
        
        if (changeMini) {
            changeMini.textContent = `${changeSymbol}${change24h.toFixed(2)}%`;
            changeMini.className = changeClass;
        }
        
        // Update market stats
        document.getElementById('marketCap').textContent = formatNumber(data.market_data.market_cap.usd);
        document.getElementById('volume').textContent = formatNumber(data.market_data.total_volume.usd);
        document.getElementById('rank').textContent = `#${data.market_cap_rank}`;
        
        if (syncIcon) syncIcon.classList.remove('updating');
        return data;

    } catch (error) {
        handleFetchError(error);
    }
}

// Add the chart data fetching function
async function fetchChartData(period = '7d') {
    try {
        const days = {
            '24h': 1,
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '1y': 365
        }[period] || 7;

        const response = await fetch(
            `${COINGECKO_API_URL}/coins/${COIN_ID}/market_chart?vs_currency=usd&days=${days}`, {
                method: 'GET',
                headers: API_HEADERS,
                mode: 'cors',
                credentials: 'omit'
            }
        );

        if (!response.ok) throw new Error('Failed to fetch chart data');

        const data = await response.json();
        
        if (!data?.prices || !Array.isArray(data.prices)) {
            throw new Error('Invalid chart data structure');
        }

        updateChart(data.prices, period);
        return data;
    } catch (error) {
        showChartError();
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

    const chartData = priceData.map(([timestamp, price]) => ({
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
    if (!data?.market_data?.current_price?.usd) return;
    
    const elements = {
        price: { id: 'price', value: formatCryptoPrice(data.market_data.current_price.usd) },
        priceMini: { id: 'price-mini', value: formatCryptoPrice(data.market_data.current_price.usd) },
        marketCap: { id: 'marketCap', value: formatNumber(data.market_data.market_cap.usd) },
        volume: { id: 'volume', value: formatNumber(data.market_data.total_volume.usd) },
        rank: { id: 'rank', value: `#${data.market_cap_rank}` },
        change: { id: 'changePercent', value: `${data.market_data.price_change_percentage_24h >= 0 ? '+' : ''}${data.market_data.price_change_percentage_24h.toFixed(2)}%` }
    };

    Object.entries(elements).forEach(([key, { id, value }]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
            if (key === 'change') {
                element.className = data.market_data.price_change_percentage_24h >= 0 ? 'up' : 'down';
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

