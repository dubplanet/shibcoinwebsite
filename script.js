const BINANCE_US_API_URL = 'https://api.binance.us/api/v3';
const SYMBOL = 'SHIBUSDT';
const WS_ENDPOINT = 'wss://stream.binance.us:9443/ws';
const SYMBOL_LOWER = 'shibusdt';

let ws;

async function fetchShibaData() {
    try {
        console.log('Fetching data...');
        const [tickerResponse, priceResponse] = await Promise.all([
            fetch(`${BINANCE_US_API_URL}/ticker/24hr?symbol=${SYMBOL}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            }),
            fetch(`${BINANCE_US_API_URL}/ticker/price?symbol=${SYMBOL}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                }
            })
        ]);

        // Add detailed error logging
        if (!tickerResponse.ok || !priceResponse.ok) {
            console.error('Ticker Status:', tickerResponse.status);
            console.error('Price Status:', priceResponse.status);
            throw new Error(`API response error: ${tickerResponse.status}, ${priceResponse.status}`);
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
        console.error('Fetch Error Details:', {
            message: error.message,
            type: error.name,
            stack: error.stack
        });
        document.getElementById('price').textContent = 'Error loading data';
        document.getElementById('priceChange').textContent = '...';
        document.getElementById('changePercent').textContent = '...';
        document.getElementById('volume').textContent = '...';
        document.getElementById('marketCap').textContent = '...';
    }
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

// Fetch data immediately and then every 10 seconds
fetchShibaData();
setInterval(fetchShibaData, 10000);

// Start WebSocket connection
connectWebSocket();