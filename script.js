const DIADATA_API_URL = 'https://api.diadata.org/v1';
const COIN_SYMBOL = 'SHIB'; // Update to the correct symbol

async function fetchShibaData() {
    try {
        console.log('Fetching data from DIAdata...');
        
        // Fetch SHIB price data from DIAdata
        const response = await fetch(`${DIADATA_API_URL}/assetPrices/${COIN_SYMBOL}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('API endpoint not found (404). Check the symbol or endpoint.');
            }
            throw new Error(`API response error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data.price === 'undefined') {
            throw new Error('Invalid data structure received from API');
        }
        
        // Update price
        const price = data.price || 0;
        if (document.getElementById('price')) {
            document.getElementById('price').textContent = `$${price.toFixed(8)}`;
        }
        
        if (document.getElementById('price-mini')) {
            document.getElementById('price-mini').textContent = `$${price.toFixed(8)}`;
        }
        
        // Update last updated time
        if (document.getElementById('lastUpdate')) {
            const lastUpdated = new Date();
            document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;
        }
    } catch (error) {
        console.error('Fetch Error Details:', error);
        handleError();
    }
}

function handleError() {
    const elementsToUpdate = [
        'price', 'priceChange', 'changePercent', 'volume', 'marketCap', 'rank', 'price-mini', 'change-mini'
    ];
    elementsToUpdate.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = 'Error';
    });
}

function formatNumber(num) {
    if (!num || isNaN(num)) return '0.00';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

document.addEventListener('DOMContentLoaded', () => {
    fetchShibaData();
    setInterval(fetchShibaData, 60000); // Update price data every minute
});