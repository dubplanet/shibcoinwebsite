// Global constants
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';
const API_CACHE_DURATION = 60000; // 1 minute
const MAX_RETRIES = 3;
const API_HEADERS = {
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
};

// State management
let priceAlerts = [];
let dataCache = null;
let retryCount = 0;
let priceRefreshInterval;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeContainers();
        initializeEventListeners();
        loadSavedAlerts();
        const data = await fetchShibaData();
        if (data) {
            // Start refresh interval
            priceRefreshInterval = setInterval(fetchShibaData, API_CACHE_DURATION);
            
            // Load initial chart
            await fetchChartData('7d');
            
            // Initialize chart controls
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
    } catch (error) {
        console.error('Initialization error:', error);
        handleError(error);
    }
});

// Core data fetching
async function fetchShibaData() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    if (syncIcon) syncIcon.classList.add('updating');

    try {
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`);
        
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
        if (syncIcon) syncIcon.classList.remove('updating');
        document.getElementById('price').textContent = 'Error loading price';
        document.getElementById('price-mini').textContent = 'Error';
        return null;
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

        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}/market_chart?vs_currency=usd&days=${days}&interval=hourly`, {
            headers: API_HEADERS
        });

        if (!response.ok) throw new Error(`Chart API Error: ${response.status}`);

        const data = await response.json();
        
        if (!data?.prices || !Array.isArray(data.prices)) {
            throw new Error('Invalid chart data structure');
        }

        updateChart(data.prices, period);
        return data;
    } catch (error) {
        console.error('Chart fetch error:', error);
        showChartError();
    }
}

// Add chart update function
function updateChart(priceData, period) {
    const ctx = document.getElementById('priceChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (window.priceChart) {
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
                tension: 0.4
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
                        unit: period === '24h' ? 'hour' : 'day'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Error handling
function handleFetchError(error) {
    console.error('Fetch error:', error);
    
    if (retryCount < MAX_RETRIES) {
        retryCount++;
        setTimeout(fetchShibaData, 2000);
        return null;
    }
    
    if (dataCache?.price) {
        updatePriceFromCache();
        showNotification('Using cached data', 'warning');
    } else {
        displayErrorState();
        showNotification('Unable to load SHIB data', 'error');
    }
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