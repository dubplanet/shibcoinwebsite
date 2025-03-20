const DIADATA_API_URL = 'https://api.diadata.org/v1';
const SHIB_CONTRACT = '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE';
const BLOCKCHAIN = 'Ethereum';

async function fetchShibaData() {
    try {
        console.log('Fetching data from DIAdata...');
        
        // Fetch SHIB price data using contract address
        const response = await fetch(`${DIADATA_API_URL}/assetQuotation/${BLOCKCHAIN}/${SHIB_CONTRACT}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('API endpoint not found (404). Check the contract address or endpoint.');
            }
            throw new Error(`API response error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data.Price === 'undefined') {
            throw new Error('Invalid data structure received from API');
        }
        
        // Update price displays
        const price = data.Price || 0;
        const priceYesterday = data.PriceYesterday || 0;
        const volume = data.VolumeYesterdayUSD || 0;
        
        // Calculate 24h change
        const priceChange = price - priceYesterday;
        const changePercent = ((priceChange / priceYesterday) * 100);
        
        // Update UI elements with price data
        updatePriceElements(price, priceChange, changePercent, volume);
        
        // Update timestamp from API response
        if (document.getElementById('lastUpdate')) {
            const lastUpdated = new Date(data.Time);
            document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;
        }
    } catch (error) {
        console.error('Fetch Error Details:', error);
        handleError();
    }
}

function updatePriceElements(price, priceChange, changePercent, volume) {
    // Main price display
    if (document.getElementById('price')) {
        document.getElementById('price').textContent = `$${price.toFixed(8)}`;
    }
    
    // Mini price display
    if (document.getElementById('price-mini')) {
        document.getElementById('price-mini').textContent = `$${price.toFixed(8)}`;
    }
    
    // Price change amount
    if (document.getElementById('priceChange')) {
        document.getElementById('priceChange').textContent = `$${Math.abs(priceChange).toFixed(8)}`;
    }
    
    // Change percentage with color
    if (document.getElementById('changePercent')) {
        const prefix = changePercent >= 0 ? '+' : '-';
        document.getElementById('changePercent').textContent = `${prefix}${Math.abs(changePercent).toFixed(2)}%`;
        document.getElementById('changePercent').className = changePercent >= 0 ? 'positive' : 'negative';
    }
    
    // Volume display
    if (document.getElementById('volume')) {
        document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
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