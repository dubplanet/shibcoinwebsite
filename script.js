const BINANCE_US_API_URL = 'https://api.binance.us/api/v3';
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const SYMBOL = 'SHIBUSDT';

async function fetchShibaData() {
    try {
        console.log('Fetching data...');
        const [tickerResponse, priceResponse] = await Promise.all([
            fetch(`${CORS_PROXY}${BINANCE_US_API_URL}/ticker/24hr?symbol=${SYMBOL}`, {
                headers: {
                    'Origin': 'https://dubplanet.github.io'
                }
            }),
            fetch(`${CORS_PROXY}${BINANCE_US_API_URL}/ticker/price?symbol=${SYMBOL}`, {
                headers: {
                    'Origin': 'https://dubplanet.github.io'
                }
            })
        ]);

        if (!tickerResponse.ok || !priceResponse.ok) {
            throw new Error('API response was not ok');
        }

        const tickerData = await tickerResponse.json();
        const priceData = await priceResponse.json();

        // Update price
        const price = parseFloat(priceData.price);
        document.getElementById('price').textContent = `$${price.toFixed(8)}`;

        // Update price change
        const priceChange = parseFloat(tickerData.priceChange);
        const changePercent = parseFloat(tickerData.priceChangePercent);
        const isPositive = priceChange >= 0;

        document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
        document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        document.getElementById('priceChange').style.color = isPositive ? '#00ff00' : '#ff0000';
        document.getElementById('changePercent').style.color = isPositive ? '#00ff00' : '#ff0000';

        // Update market stats
        const volume = parseFloat(tickerData.volume) * price;
        document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
        
        // Update last updated time
        const lastUpdated = new Date();
        document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;
        document.getElementById('marketCap').textContent = 'N/A';

    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('price').textContent = 'Error loading data';
        document.getElementById('priceChange').textContent = '...';
        document.getElementById('changePercent').textContent = '...';
        document.getElementById('volume').textContent = '...';
        document.getElementById('marketCap').textContent = '...';
    }
}

function formatNumber(num) {
    if (num >= 1e9) {
        return (num / 1e9).toFixed(2) + 'B';
    }
    if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'M';
    }
    if (num >= 1e3) {
        return (num / 1e3).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

// Fetch data immediately and then every 10 seconds
fetchShibaData();
setInterval(fetchShibaData, 10000);