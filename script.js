const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const SHIBA_ID = 'shiba-inu';

async function fetchShibaData() {
    try {
        const response = await fetch(`${COINGECKO_API_URL}/coins/${SHIBA_ID}`);
        const data = await response.json();

        // Update price
        const price = data.market_data.current_price.usd;
        document.getElementById('price').textContent = `$${price.toFixed(8)}`;

        // Update price change
        const priceChange = data.market_data.price_change_24h;
        const changePercent = data.market_data.price_change_percentage_24h;
        const isPositive = priceChange >= 0;

        document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
        document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        document.getElementById('priceChange').style.color = isPositive ? 'green' : 'red';
        document.getElementById('changePercent').style.color = isPositive ? 'green' : 'red';

        // Update market stats
        document.getElementById('marketCap').textContent = `$${formatNumber(data.market_data.market_cap.usd)}`;
        document.getElementById('volume').textContent = `$${formatNumber(data.market_data.total_volume.usd)}`;
        document.getElementById('rank').textContent = `#${data.market_cap_rank}`;

        // Update last updated time
        const lastUpdated = new Date(data.last_updated);
        document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('price').textContent = 'Error loading data';
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

// Fetch data immediately and then every 30 seconds
fetchShibaData();
setInterval(fetchShibaData, 30000);