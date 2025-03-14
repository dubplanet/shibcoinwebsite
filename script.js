const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';
const NEWS_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes
const NEWS_API_URL = 'https://gnews.io/api/v4/search';
const NEWS_API_KEY = '0a43e914639fc457d1f55e9f8ffb26e1'; // This is a sample key, get your own at gnews.io

// Chart data global variable
let priceHistoryData = [];

async function fetchShibaData() {
    try {
        console.log('Fetching data from CoinGecko...');
        
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`);

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
        document.getElementById('price-mini').textContent = `$${price.toFixed(8)}`;

        // Update price change with null checks
        const changePercent = data.market_data?.price_change_percentage_24h || 0;
        const isPositive = changePercent >= 0;
        const priceChange = data.market_data?.price_change_24h || 0;

        document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
        document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
        document.getElementById('change-mini').textContent = `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
        
        // Update color classes
        document.getElementById('priceChange').className = isPositive ? 'change-positive' : 'change-negative';
        document.getElementById('changePercent').className = isPositive ? 'change-positive' : 'change-negative';
        document.getElementById('change-mini').className = isPositive ? 'change-positive' : 'change-negative';

        // Update market stats with null checks
        const volume = data.market_data?.total_volume?.usd || 0;
        const marketCap = data.market_data?.market_cap?.usd || 0;
        const marketCapRank = data.market_cap_rank || 'N/A';
        
        document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
        document.getElementById('marketCap').textContent = `$${formatNumber(marketCap)}`;
        document.getElementById('rank').textContent = `#${marketCapRank}`;
        
        // Update last updated time
        const lastUpdated = new Date();
        document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;

        // Store sparkline data for chart if available
        if (data.market_data?.sparkline_7d?.price) {
            priceHistoryData = data.market_data.sparkline_7d.price;
            updateChart('7d');
        } else {
            fetchChartData('7d');
        }

    } catch (error) {
        console.error('Fetch Error Details:', error);
        handleError();
    }
}

async function fetchChartData(period = '7d') {
    try {
        const days = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            '1y': 365
        };
        
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}/market_chart?vs_currency=usd&days=${days[period]}`);
        
        if (!response.ok) {
            throw new Error(`Chart data API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.prices) {
            const chartData = data.prices.map(item => ({
                x: item[0],
                y: item[1]
            }));
            
            updateChart(period, chartData);
        }
    } catch (error) {
        console.error('Chart Data Error:', error);
    }
}

function updateChart(period, data = null) {
    const chartElement = document.getElementById('priceChart');
    
    if (!chartElement) return;
    
    let chartData = data;
    
    if (!chartData && period === '7d' && priceHistoryData.length > 0) {
        // Use sparkline data if available for 7d
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        chartData = priceHistoryData.map((price, index) => {
            const timestamp = sevenDaysAgo.getTime() + (index * (7 * 24 * 60 * 60 * 1000) / priceHistoryData.length);
            return {
                x: timestamp,
                y: price
            };
        });
    }
    
    if (!chartData) {
        chartElement.innerHTML = '<p>Chart data not available</p>';
        return;
    }
    
    // Get min and max for better visualization
    const prices = chartData.map(item => item.y);
    const minPrice = Math.min(...prices) * 0.99; // 1% lower than minimum
    const maxPrice = Math.max(...prices) * 1.01; // 1% higher than maximum
    
    const options = {
        series: [{
            name: 'SHIB Price',
            data: chartData
        }],
        chart: {
            type: 'area',
            height: 300,
            foreColor: '#b0b0b0',
            toolbar: {
                show: false
            },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800
            },
            background: 'transparent'
        },
        colors: ['#ffd700'],
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100]
            }
        },
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        grid: {
            borderColor: '#333333',
            strokeDashArray: 3,
            xaxis: {
                lines: {
                    show: false
                }
            }
        },
        markers: {
            size: 0
        },
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false
            }
        },
        yaxis: {
            min: minPrice,
            max: maxPrice,
            labels: {
                formatter: function(value) {
                    return '$' + value.toFixed(8);
                }
            }
        },
        tooltip: {
            theme: 'dark',
            x: {
                format: 'MMM dd, yyyy HH:mm'
            },
            y: {
                formatter: function(value) {
                    return '$' + value.toFixed(8);
                }
            }
        }
    };

    // Clear previous chart if any
    chartElement.innerHTML = '';
    
    // Create new chart
    const chart = new ApexCharts(chartElement, options);
    chart.render();
    
    // Update active button
    document.querySelectorAll('.chart-option').forEach(button => {
        if (button.getAttribute('data-period') === period) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

async function fetchNews() {
    try {
        console.log('Fetching SHIB news...');
        const newsContainer = document.getElementById('newsContent');
        
        if (!newsContainer) {
            console.error('News container element not found');
            return;
        }
        
        // Show loading spinner
        newsContainer.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Loading latest news...</p>
            </div>
        `;
        
        const response = await fetch(
            `${NEWS_API_URL}?q=shiba+inu+cryptocurrency&lang=en&max=5&apikey=${NEWS_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`News API response error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('News data received:', data);
        
        if (data.articles && data.articles.length > 0) {
            const newsHTML = data.articles.map(article => `
                <div class="news-item">
                    <h3>${article.title}</h3>
                    <p>${article.description}</p>
                    <div class="news-meta">
                        <span>${new Date(article.publishedAt).toLocaleString()}</span>
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer">Read more</a>
                    </div>
                </div>
            `).join('');
            
            newsContainer.innerHTML = newsHTML;
        } else {
            newsContainer.innerHTML = '<p>No recent news available about Shiba Inu coin.</p>';
        }
    } catch (error) {
        console.error('News Fetch Error:', error);
        const newsContainer = document.getElementById('newsContent');
        if (newsContainer) {
            newsContainer.innerHTML = '<p>Error loading news. Please try again later.</p>';
        }
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

// Update the initialization at the bottom of the file
document.addEventListener('DOMContentLoaded', () => {
    fetchShibaData();
    fetchNews();
    setInterval(fetchShibaData, 60000);
    setInterval(fetchNews, NEWS_REFRESH_INTERVAL);
});