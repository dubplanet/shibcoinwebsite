const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';

const CRYPTOCOMPARE_API_KEY = 'YOUR_API_KEY'; // Get free API key from cryptocompare.com
const NEWS_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

async function fetchShibaData() {
    try {
        console.log('Fetching data from CoinGecko...');
        // Updated API endpoint to get more detailed coin data including market cap rank
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`);

        if (!response.ok) {
            throw new Error(`API response error: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data) {
            throw new Error('Invalid data structure received from API');
        }

        // Update price with null check
        const price = data.market_data?.current_price?.usd || 0;
        document.getElementById('price').textContent = `$${price.toFixed(8)}`;

        // Update price change with null checks
        const changePercent = data.market_data?.price_change_percentage_24h || 0;
        const isPositive = changePercent >= 0;
        const priceChange = data.market_data?.price_change_24h || 0;

        document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
        document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        document.getElementById('priceChange').style.color = isPositive ? '#00ff00' : '#ff0000';
        document.getElementById('changePercent').style.color = isPositive ? '#00ff00' : '#ff0000';

        // Update market stats with null checks
        const volume = data.market_data?.total_volume?.usd || 0;
        const marketCap = data.market_data?.market_cap?.usd || 0;
        const marketCapRank = data.market_cap_rank || 'N/A';
        
        document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
        document.getElementById('marketCap').textContent = `$${formatNumber(marketCap)}`;
        document.getElementById('rank').textContent = `#${marketCapRank}`; // Make sure you have this element in your HTML
        
        // Update last updated time
        const lastUpdated = new Date();
        document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;

    } catch (error) {
        console.error('Fetch Error Details:', error);
        handleError();
    }
}

async function fetchNews() {
    try {
        const response = await fetch(
            `https://min-api.cryptocompare.com/data/v2/news/?categories=Shiba%20Inu,SHIB&excludeCategories=Sponsored&api_key=${CRYPTOCOMPARE_API_KEY}`
        );

        if (!response.ok) {
            throw new Error(`News API response error: ${response.status}`);
        }

        const data = await response.json();
        const newsContainer = document.getElementById('newsContent');
        
        if (data.Data && data.Data.length > 0) {
            const newsHTML = data.Data.slice(0, 5).map(article => `
                <div class="news-item">
                    <h3>${article.title}</h3>
                    <p>${article.body.substring(0, 150)}...</p>
                    <div class="news-meta">
                        <span>${new Date(article.published_on * 1000).toLocaleString()}</span>
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer">Read more</a>
                    </div>
                </div>
            `).join('');
            
            newsContainer.innerHTML = newsHTML;
        } else {
            newsContainer.innerHTML = '<p>No recent news available</p>';
        }
    } catch (error) {
        console.error('News Fetch Error:', error);
        document.getElementById('newsContent').innerHTML = 
            '<p>Error loading news. Please try again later.</p>';
    }
}

function handleError() {
    document.getElementById('price').textContent = 'Error loading data';
    document.getElementById('priceChange').textContent = '...';
    document.getElementById('changePercent').textContent = '...';
    document.getElementById('volume').textContent = '...';
    document.getElementById('marketCap').textContent = '...';
    document.getElementById('rank').textContent = '...';
}

function formatNumber(num) {
    if (!num || isNaN(num)) return '0.00';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Fetch data immediately and then every minute
fetchShibaData();
setInterval(fetchShibaData, 60000); // Updated to 1 minute

fetchNews();
setInterval(fetchNews, NEWS_REFRESH_INTERVAL);