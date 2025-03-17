const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';

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
        if(document.getElementById('price')) {
            document.getElementById('price').textContent = `$${price.toFixed(8)}`;
        }
        
        if(document.getElementById('price-mini')) {
            document.getElementById('price-mini').textContent = `$${price.toFixed(8)}`;
        }
        
        // Update price change with null checks
        const changePercent = data.market_data?.price_change_percentage_24h || 0;
        const isPositive = changePercent >= 0;
        const priceChange = data.market_data?.price_change_24h || 0;

        if(document.getElementById('priceChange')) {
            document.getElementById('priceChange').textContent = `${isPositive ? '+' : ''}$${priceChange.toFixed(8)}`;
            document.getElementById('priceChange').className = isPositive ? 'positive' : 'negative';
        }
        
        if(document.getElementById('changePercent')) {
            document.getElementById('changePercent').textContent = `(${isPositive ? '+' : ''}${changePercent.toFixed(2)}%)`;
            document.getElementById('changePercent').className = isPositive ? 'positive' : 'negative';
        }
        
        if(document.getElementById('change-mini')) {
            document.getElementById('change-mini').textContent = `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`;
            document.getElementById('change-mini').className = isPositive ? 'positive' : 'negative';
            document.getElementById('change-mini').innerHTML = `<i class="fas fa-caret-${isPositive ? 'up' : 'down'}"></i> ${document.getElementById('change-mini').textContent}`;
        }

        // Update market stats with null checks
        const volume = data.market_data?.total_volume?.usd || 0;
        const marketCap = data.market_data?.market_cap?.usd || 0;
        const marketCapRank = data.market_cap_rank || 'N/A';
        
        if(document.getElementById('volume')) {
            document.getElementById('volume').textContent = `$${formatNumber(volume)}`;
        }
        
        if(document.getElementById('marketCap')) {
            document.getElementById('marketCap').textContent = `$${formatNumber(marketCap)}`;
        }
        
        if(document.getElementById('rank')) {
            document.getElementById('rank').textContent = `#${marketCapRank}`;
        }
        
        // Update last updated time
        if(document.getElementById('lastUpdate')) {
            const lastUpdated = new Date();
            document.getElementById('lastUpdate').textContent = `Last updated: ${lastUpdated.toLocaleTimeString()}`;
        }
        
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

let currentChart = null;

function updateChart(period, data = null) {
    const chartElement = document.getElementById('priceChart');
    
    if (!chartElement) return;
    
    // Destroy existing chart
    if (currentChart) {
        currentChart.destroy();
    }
    
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
    
    // Store reference to new chart
    currentChart = chart;
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

function handleError() {
    if (document.getElementById('price')) document.getElementById('price').textContent = 'Error loading data';
    if (document.getElementById('priceChange')) document.getElementById('priceChange').textContent = '...';
    if (document.getElementById('changePercent')) document.getElementById('changePercent').textContent = '...';
    if (document.getElementById('volume')) document.getElementById('volume').textContent = '...';
    if (document.getElementById('marketCap')) document.getElementById('marketCap').textContent = '...';
    if (document.getElementById('rank')) document.getElementById('rank').textContent = '...';
    if (document.getElementById('price-mini')) document.getElementById('price-mini').textContent = 'Error';
    if (document.getElementById('change-mini')) document.getElementById('change-mini').textContent = '...';
}

function formatNumber(num) {
    if (!num || isNaN(num)) return '0.00';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
}

// Create particle background
function createParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles-container';
    document.querySelector('.hero-section').appendChild(particlesContainer);
    
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random properties
        const size = Math.random() * 10 + 5;
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        const opacity = Math.random() * 0.5 + 0.1;
        const duration = Math.random() * 20 + 10;
        const delay = Math.random() * 5;
        
        // Set styles
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.top = `${posY}%`;
        particle.style.opacity = opacity;
        particle.style.animation = `float ${duration}s ease-in-out ${delay}s infinite`;
        
        particlesContainer.appendChild(particle);
    }
}

// Animate sync icon during updates
function animateSyncIcon() {
    const syncIcon = document.querySelector('.fa-sync-alt');
    syncIcon.classList.add('updating');
    
    setTimeout(() => {
        syncIcon.classList.remove('updating');
    }, 2000);
}

// Number counter animation
function animateNumberCounter(element, start, end, duration) {
    const range = end - start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        element.textContent = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}

// Replace the animatePriceUpdate function with this version
function animatePriceUpdate(newPrice) {
    const priceElement = document.getElementById('price');
    
    // Add class for color change only (no movement)
    priceElement.classList.add('price-updated');
    
    // Update the text immediately
    priceElement.textContent = newPrice;
    
    // Remove highlight effect after a brief period
    setTimeout(() => {
        priceElement.classList.remove('price-updated');
    }, 1000);
}

// Single FAQ functionality implementation
function initializeFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    // Remove existing listeners if any
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const clone = question.cloneNode(true);
        question.parentNode.replaceChild(clone, question);
    });
    
    // Add new listeners
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        const answer = item.querySelector('.faq-answer');
        const icon = item.querySelector('.fa-chevron-down');
        
        if (answer) answer.style.height = '0px';
        
        question.addEventListener('click', handleFAQClick.bind(null, item, answer, icon));
    });
}

function handleFAQClick(currentItem, answer, icon) {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        if (item !== currentItem) {
            item.classList.remove('active');
            const otherAnswer = item.querySelector('.faq-answer');
            const otherIcon = item.querySelector('.fa-chevron-down');
            if (otherAnswer) otherAnswer.style.height = '0px';
            if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
        }
    });
    
    const isExpanding = !currentItem.classList.contains('active');
    currentItem.classList.toggle('active');
    
    if (answer) {
        answer.style.height = isExpanding ? `${answer.scrollHeight}px` : '0px';
    }
    if (icon) {
        icon.style.transform = isExpanding ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

window.addEventListener('error', function(event) {
    console.error('Global error caught:', event.error);
    handleError();
    return false;
});

// Update initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        createParticles();
        initializeFAQ();
        initializeChartControls();
        
        fetchShibaData();
        setInterval(fetchShibaData, 60000);
    } catch (error) {
        console.error('Initialization error:', error);
        handleError();
    }
});

// Initialize animations
document.addEventListener('DOMContentLoaded', () => {
    // Create floating particles in hero section
    createParticles();
    
    // Original fetchShibaData with animation
    const originalFetchShibaData = window.fetchShibaData;
    window.fetchShibaData = function() {
        animateSyncIcon();
        return originalFetchShibaData.apply(this, arguments);
    };

    fetchShibaData();
    setInterval(fetchShibaData, 60000);

    // Chart timeframe functionality
    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.timeframe-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            const period = this.getAttribute('data-period');
            fetchChartData(period);
        });
    });

    // Single FAQ functionality implementation
    initializeFAQ();
});

function updateDataDisplayFromCache() {
    // Similar to updateDataDisplay but uses dataCache instead
    if (!dataCache.price) return;
    
    const priceElement = document.getElementById('price');
    if (priceElement) {
        priceElement.textContent = `$${formatCryptoPrice(dataCache.price)}`;
    }
    
    const miniPriceElement = document.getElementById('price-mini');
    if (miniPriceElement) {
        miniPriceElement.textContent = `$${formatCryptoPrice(dataCache.price)}`;
    }
    
    // Update other elements from cache...
    const marketCapElement = document.getElementById('marketCap');
    if (marketCapElement && dataCache.marketCap) {
        marketCapElement.textContent = formatCurrency(dataCache.marketCap);
    }
    
    const volumeElement = document.getElementById('volume');
    if (volumeElement && dataCache.volume) {
        volumeElement.textContent = formatCurrency(dataCache.volume);
    }
    
    const rankElement = document.getElementById('rank');
    if (rankElement && dataCache.rank) {
        rankElement.textContent = `#${dataCache.rank}`;
    }
    
    // Add warning class to show data might be stale
    document.querySelectorAll('.price-section .stat-card').forEach(card => {
        card.classList.add('cached-data');
    });
}

