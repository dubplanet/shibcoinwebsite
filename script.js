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
    
    // Create date formatter based on period
    let dateFormat = 'MMM dd';
    if (period === '1d') {
        dateFormat = 'HH:mm';
    } else if (period === '1y') {
        dateFormat = 'MMM yyyy';
    }
    
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
            background: 'transparent',
            fontFamily: 'Poppins, sans-serif'
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
            },
            padding: {
                bottom: 10
            }
        },
        markers: {
            size: 0,
            hover: {
                size: 5
            }
        },
        xaxis: {
            type: 'datetime',
            labels: {
                datetimeUTC: false,
                format: dateFormat,
                style: {
                    fontSize: '12px',
                    fontFamily: 'Poppins, sans-serif'
                },
                offsetY: 5,
                rotate: 0,
                // Limit the number of labels to prevent overcrowding
                tickAmount: getTickAmount(period)
            },
            axisBorder: {
                show: true,
                color: '#444'
            },
            crosshairs: {
                show: true
            },
            tooltip: {
                enabled: true
            }
        },
        yaxis: {
            min: minPrice,
            max: maxPrice,
            labels: {
                formatter: function(value) {
                    if (value < 0.000001) {
                        return '$' + value.toExponential(2);
                    }
                    return '$' + value.toFixed(8);
                },
                style: {
                    fontSize: '12px'
                }
            },
            axisBorder: {
                show: true,
                color: '#444'
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
            },
            marker: {
                show: true
            }
        },
        responsive: [{
            breakpoint: 768,
            options: {
                chart: {
                    height: 250
                },
                xaxis: {
                    labels: {
                        style: {
                            fontSize: '10px'
                        },
                        tickAmount: Math.min(getTickAmount(period), 5)
                    }
                }
            }
        }, {
            breakpoint: 480,
            options: {
                chart: {
                    height: 200
                },
                xaxis: {
                    labels: {
                        style: {
                            fontSize: '8px'
                        },
                        rotate: -45,
                        offsetY: 10,
                        tickAmount: Math.min(getTickAmount(period), 4)
                    }
                }
            }
        }]
    };

    // Clear previous chart if any
    chartElement.innerHTML = '';
    
    // Create new chart
    const chart = new ApexCharts(chartElement, options);
    chart.render();
}

// Helper function to determine optimal number of date labels
function getTickAmount(period) {
    switch (period) {
        case '1d': return 6;
        case '7d': return 7;
        case '30d': return 10;
        case '1y': return 12;
        default: return 7;
    }
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
        
        // Alternative API options in case one doesn't work
        let newsData = null;
        let error = null;
        
        try {
            // Try GNews API first
            const response = await fetch(
                `${NEWS_API_URL}?q=shiba+inu+cryptocurrency&lang=en&max=6&apikey=${NEWS_API_KEY}`
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.articles && data.articles.length > 0) {
                    newsData = data.articles;
                }
            } else {
                throw new Error(`GNews API response error: ${response.status}`);
            }
        } catch (e) {
            error = e;
            console.warn('GNews API error, trying fallback:', e);
            
            // Fallback to CoinGecko status updates if GNews fails
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/coins/shiba-inu/status_updates');
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.status_updates && data.status_updates.length > 0) {
                        newsData = data.status_updates.map(update => ({
                            title: update.category,
                            description: update.description,
                            url: 'https://www.coingecko.com/en/coins/shiba-inu',
                            publishedAt: update.created_at
                        }));
                    }
                }
            } catch (fallbackError) {
                console.error('Fallback news source also failed:', fallbackError);
            }
        }
        
        if (newsData && newsData.length > 0) {
            const newsHTML = newsData.slice(0, 6).map(article => `
                <div class="news-item">
                    <h3>${article.title || 'SHIB News Update'}</h3>
                    <p>${article.description?.substring(0, 150) || 'No description available'}...</p>
                    <div class="news-meta">
                        <div class="news-date">
                            <i class="fas fa-clock"></i>
                            <span>${new Date(article.publishedAt).toLocaleDateString()}</span>
                        </div>
                        <a href="${article.url}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-external-link-alt"></i> Read more
                        </a>
                    </div>
                </div>
            `).join('');
            
            newsContainer.innerHTML = newsHTML;
        } else {
            // If both APIs fail or return no data, show mock news as a fallback
            const mockNews = [
                {
                    title: "Shiba Inu Continues to Gain Momentum in Crypto Market",
                    description: "The popular meme coin has shown resilience in the volatile cryptocurrency market, with growing adoption across various platforms.",
                    date: new Date().toLocaleDateString(),
                    url: "https://www.shibatoken.com/"
                },
                {
                    title: "New Developments in SHIB Ecosystem",
                    description: "The SHIB development team has announced plans for new features and integrations that aim to expand the utility of the token.",
                    date: new Date().toLocaleDateString(),
                    url: "https://www.shibatoken.com/"
                },
                {
                    title: "Shiba Inu Community Grows Past 2 Million Holders",
                    description: "The SHIB community continues to expand rapidly as more investors join the ecosystem and contribute to its development.",
                    date: new Date().toLocaleDateString(),
                    url: "https://www.shibatoken.com/"
                },
                {
                    title: "Major Exchange Adds New SHIB Trading Pairs",
                    description: "A leading cryptocurrency exchange has announced the addition of new trading pairs for Shiba Inu, increasing its accessibility.",
                    date: new Date().toLocaleDateString(),
                    url: "https://www.shibatoken.com/"
                }
            ];
            
            const mockNewsHTML = mockNews.map(item => `
                <div class="news-item">
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    <div class="news-meta">
                        <div class="news-date">
                            <i class="fas fa-clock"></i>
                            <span>${item.date}</span>
                        </div>
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer">
                            <i class="fas fa-external-link-alt"></i> Read more
                        </a>
                    </div>
                </div>
            `).join('');
            
            newsContainer.innerHTML = mockNewsHTML;
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