const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';
const WS_ENDPOINT = 'wss://stream.binance.us:9443/ws';
const SYMBOL_LOWER = 'shibusdt';

let ws;

async function fetchShibaData() {
    try {
        console.log('Fetching data from CoinGecko...');
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}/tickers`);

        if (!response.ok) {
            throw new Error(`API response error: ${response.status}`);
        }

        const data = await response.json();
        
        // Get the first USDT pair for price data
        const usdPair = data.tickers.find(t => t.target === 'USD' || t.target === 'USDT');
        
        if (!usdPair) {
            throw new Error('No USD trading pair found');
        }

        // Update price
        const price = usdPair.last;
        document.getElementById('price').textContent = `$${price.toFixed(8)}`;

        // Update price change
        const changePercent = usdPair.percentage_change;
        const isPositive = changePercent >= 0;
        const priceChange = (price * changePercent / 100);

        document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
        document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        document.getElementById('priceChange').style.color = isPositive ? '#00ff00' : '#ff0000';
        document.getElementById('changePercent').style.color = isPositive ? '#00ff00' : '#ff0000';

        // Update market stats
        const volume = usdPair.volume;
        document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
        document.getElementById('marketCap').textContent = `$${formatNumber(data.market_data?.market_cap?.usd || 'N/A')}`;
        
        // Update last updated time
        const lastUpdated = new Date();
        document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;

    } catch (error) {
        console.error('Fetch Error Details:', error);
        handleError();
    }
}

function handleError() {
    document.getElementById('price').textContent = 'Error loading data';
    document.getElementById('priceChange').textContent = '...';
    document.getElementById('changePercent').textContent = '...';
    document.getElementById('volume').textContent = '...';
    document.getElementById('marketCap').textContent = '...';
}

function connectWebSocket() {
    ws = new WebSocket(WS_ENDPOINT);
    
    ws.onopen = () => {
        console.log('WebSocket Connected');
        ws.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params: [
                `${SYMBOL_LOWER}@ticker`
            ],
            id: 1
        }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.e === '24hrTicker') {
            updateUI(data);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };

    ws.onclose = () => {
        console.log('WebSocket Closed. Reconnecting...');
        setTimeout(connectWebSocket, 5000);
    };
}

function updateUI(data) {
    const price = parseFloat(data.c);
    const priceChange = parseFloat(data.p);
    const changePercent = parseFloat(data.P);
    const volume = parseFloat(data.v) * price;
    const isPositive = priceChange >= 0;

    document.getElementById('price').textContent = `$${price.toFixed(8)}`;
    document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
    document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
    document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
    document.getElementById('lastUpdate').textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
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

// Fetch data immediately and then every 30 seconds (CoinGecko has rate limits)
fetchShibaData();
setInterval(fetchShibaData, 30000);

// Start WebSocket connection
connectWebSocket();