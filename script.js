const DIADATA_API_URL = 'https://api.diadata.org/v1';
const COIN_SYMBOL = 'SHIB-USD'; // Symbol for Shiba Inu in DIAdata

// Chart data global variable
let priceHistoryData = [];

async function fetchShibaData() {
    try {
        console.log('Fetching data from DIAdata...');
        
        // Fetch SHIB price data from DIAdata
        const response = await fetch(`${DIADATA_API_URL}/assetPrices/${COIN_SYMBOL}`);
        
        if (!response.ok) {
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

async function fetchChartData(period = '7d') {
    try {
        const days = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            '1y': 365
        };
        
        const response = await fetch(`${_URL}/coins/${COIN_ID}/market_chart?vs_currency=usd&days=${days[period]}`);
        
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

