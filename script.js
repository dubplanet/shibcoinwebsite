// Global constants
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';
const API_CACHE_DURATION = 60000; // 1 minute
const MAX_RETRIES = 3;

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
        await startDataRefresh();
    } catch (error) {
        console.error('Initialization error:', error);
        handleError(error);
    }
});

// Core data fetching
async function fetchShibaData() {
    try {
        const syncIcon = document.querySelector('.fa-sync-alt');
        if (syncIcon) syncIcon.classList.add('updating');

        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`);
        
        if (!response.ok) throw new Error();

        const data = await response.json();
        updatePriceDisplay(data);
        updateDataCache(data);
        
        if (syncIcon) syncIcon.classList.remove('updating');
        return data;
    } catch {
        handleError();
        return null;
    }
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
const formatCryptoPrice = price => {
    if (!price) return '0.00000000';
    const decimals = price < 0.00001 ? 10 : price < 0.0001 ? 8 : price < 0.01 ? 6 : price < 1 ? 4 : 2;
    return price.toFixed(decimals);
};

const formatNumber = num => {
    if (!num) return '$0';
    const tiers = [
        { threshold: 1e9, suffix: 'B' },
        { threshold: 1e6, suffix: 'M' },
        { threshold: 1e3, suffix: 'K' }
    ];
    
    const tier = tiers.find(t => num >= t.threshold);
    return tier ? `$${(num / tier.threshold).toFixed(2)}${tier.suffix}` : `$${num.toFixed(2)}`;
};

// Cleanup
window.addEventListener('beforeunload', () => {
    clearInterval(priceRefreshInterval);
});