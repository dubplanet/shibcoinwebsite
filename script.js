// Global variables and API constants
const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
const COIN_ID = 'shiba-inu';

// Properly initialize dataCache
let dataCache = {
    price: null,
    marketCap: null,
    volume: null,
    rank: null,
    change24h: null,
    lastUpdated: null
};

// Define formatCryptoPrice globally to ensure it's available everywhere
function formatCryptoPrice(price) {
    if (!price && price !== 0) return "0.00000000";
    
    // For very small values, show more decimal places
    if (price < 0.00001) {
        return price.toFixed(10).replace(/0+$/, '');
    } else if (price < 0.0001) {
        return price.toFixed(8).replace(/0+$/, '');
    } else if (price < 0.01) {
        return price.toFixed(6).replace(/0+$/, '');
    } else if (price < 1) {
        return price.toFixed(4).replace(/0+$/, '');
    } else {
        return price.toFixed(2);
    }
}

// Add debug logging system for easier troubleshooting
const DEBUG = false; // Set to true for debugging

function log(...args) {
    if (DEBUG) {
        console.log('[SHIB Tracker]', ...args);
    }
}

function logError(...args) {
    console.error('[SHIB Tracker Error]', ...args);
}

// Enhanced error handling
function handleError(error, context = '') {
    logError(`${context}:`, error);
    
    // Update UI with error state
    if (document.getElementById('price')) document.getElementById('price').textContent = 'Error loading data';
    
    // Show user-friendly notification
    showNotification('Unable to load cryptocurrency data. Please try again later.', 'error');
    
    // Add diagnostic info to console
    if (DEBUG) {
        console.group('Error Details');
        console.error(error);
        console.info('Browser:', navigator.userAgent);
        console.info('Page:', window.location.href);
        console.info('Time:', new Date().toISOString());
        console.groupEnd();
    }
}

// Add debounce function to prevent excessive API calls
let lastFetchTime = 0;
const FETCH_COOLDOWN = 15000; // 15 seconds minimum between fetches

async function fetchShibaData() {
    // Rate limiting
    const now = Date.now();
    if (now - lastFetchTime < FETCH_COOLDOWN) {
        console.log('Skipping fetch due to rate limiting');
        return;
    }
    lastFetchTime = now;
    
    try {
        // Show loading indicator
        const syncIcon = document.querySelector('.fa-sync-alt');
        if (syncIcon) syncIcon.classList.add('updating');
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`API response error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update dataCache with proper null checks
        dataCache = {
            price: safelyGetNestedProperty(data, 'market_data.current_price.usd') || null,
            marketCap: safelyGetNestedProperty(data, 'market_data.market_cap.usd') || null,
            volume: safelyGetNestedProperty(data, 'market_data.total_volume.usd') || null,
            rank: data.market_cap_rank || null,
            change24h: safelyGetNestedProperty(data, 'market_data.price_change_percentage_24h') || null,
            lastUpdated: data.last_updated || new Date().toISOString()
        };
        
        // Update UI
        updatePriceDisplay(data);
        
        // Check price alerts
        checkPriceAlerts(dataCache.price);
        
        // Hide loading indicator
        if (syncIcon) syncIcon.classList.remove('updating');
        
        return data;
    } catch (error) {
        console.error('Fetch Error:', error);
        
        // Use cached data if available and not too old
        if (dataCache.price && dataCache.lastUpdated) {
            const cacheTime = new Date(dataCache.lastUpdated).getTime();
            const now = Date.now();
            const cacheAge = now - cacheTime;
            
            // Use cache if less than 1 hour old
            if (cacheAge < 3600000) {
                updateDataDisplayFromCache();
                showNotification('Using cached data. API connection issue.', 'warning');
            } else {
                showNotification('Data may be outdated. Last updated ' + 
                    Math.floor(cacheAge/60000) + ' minutes ago.', 'warning');
                updateDataDisplayFromCache();
            }
        } else {
            showNotification('Could not load SHIB data. Please try again later.', 'error');
            handleError();
        }
        
        // Hide loading indicator
        const syncIcon = document.querySelector('.fa-sync-alt');
        if (syncIcon) syncIcon.classList.remove('updating');
    }
}

// Chart data global variable
let priceHistoryData = [];

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

// At the beginning of script.js
// Determine which page we're on
const isMainPage = Boolean(document.getElementById('price'));
const isBlogPage = window.location.pathname.includes('blog');

// Consolidated initialization with page-specific handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Common initialization for all pages
        setupPriceAlertWidgetControls();
        
        // Main page specific initialization
        if (isMainPage) {
            createParticles();
            initializeFAQ();
            initializeChartControls();
            
            // Initial data fetch and set interval
            startDataRefresh();
            
            // Initial chart data
            if (document.getElementById('priceChart')) {
                fetchChartData('7d');
            }
            
            // Load price alerts
            const savedAlerts = localStorage.getItem('shibPriceAlerts');
            if (savedAlerts) {
                priceAlerts = JSON.parse(savedAlerts);
                updateAlertsList();
                updateAlertCount();
            }
        }
        
        // Blog page specific initialization
        if (isBlogPage) {
            // Add any blog-specific initialization here
        }
        
    } catch (error) {
        console.error('Initialization error:', error);
        handleError();
    }
});

// Separate alert widget controls setup
function setupPriceAlertWidgetControls() {
    const openAlertWidget = document.getElementById('openAlertWidget');
    const closeAlertWidget = document.getElementById('closeAlertWidget');
    const priceAlertWidget = document.getElementById('priceAlertWidget');
    const setAlertButton = document.getElementById('setAlert');
    const alertPriceInput = document.getElementById('alertPrice');
    
    if (openAlertWidget && priceAlertWidget) {
        openAlertWidget.addEventListener('click', () => {
            priceAlertWidget.classList.add('active');
        });
    }
    
    if (closeAlertWidget && priceAlertWidget) {
        closeAlertWidget.addEventListener('click', () => {
            priceAlertWidget.classList.remove('active');
        });
    }
    
    if (setAlertButton) {
        setAlertButton.addEventListener('click', addNewAlert);
    }
    
    if (alertPriceInput) {
        alertPriceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addNewAlert();
        });
    }
}

// Replace formatCurrency function call with formatNumber since that's what you actually defined
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
    
    // Update other elements from cache using formatNumber instead of formatCurrency
    const marketCapElement = document.getElementById('marketCap');
    if (marketCapElement && dataCache.marketCap) {
        marketCapElement.textContent = formatNumber(dataCache.marketCap);
    }
    
    const volumeElement = document.getElementById('volume');
    if (volumeElement && dataCache.volume) {
        volumeElement.textContent = formatNumber(dataCache.volume);
    }
    
    const rankElement = document.getElementById('rank');
    if (rankElement && dataCache.rank) {
        rankElement.textContent = `#${dataCache.rank}`;
    }
    
    // Add warning class to show data might be stale
    document.querySelectorAll('.price-section .stat-card').forEach(element => {
        element.classList.add('cached-data');
    });
}

// Price Alert System
let priceAlerts = [];
let currentPrice = 0;

// Add a new price alert
function addNewAlert() {
    const priceInput = document.getElementById('alertPrice');
    const alertTypeAbove = document.querySelector('input[name="alertType"][value="above"]');
    
    if (!priceInput || !alertTypeAbove) return;
    
    const price = parseFloat(priceInput.value.trim());
    const type = alertTypeAbove.checked ? 'above' : 'below';
    
    if (isNaN(price) || price <= 0) {
        showNotification('Please enter a valid price', 'error');
        return;
    }
    
    // Check if alert already exists
    const alertExists = priceAlerts.some(alert => 
        alert.price === price && alert.type === type
    );
    
    if (alertExists) {
        showNotification('This alert already exists', 'warning');
        return;
    }
    
    // Add new alert
    const newAlert = {
        id: Date.now(),
        price,
        type,
        triggered: false,
        dateCreated: new Date().toISOString()
    };
    
    priceAlerts.push(newAlert);
    
    // Save to localStorage
    localStorage.setItem('shibPriceAlerts', JSON.stringify(priceAlerts));
    
    // Update UI
    updateAlertsList();
    updateAlertCount();
    
    // Reset input
    priceInput.value = '';
    
    // Show confirmation
    showNotification(`Price alert set for ${type} $${formatCryptoPrice(price)}`, 'success');
    
    // Check against current price
    if (currentPrice > 0) {
        checkPriceAlerts(currentPrice);
    }
}

// Update the displayed list of alerts
function updateAlertsList() {
    const alertsList = document.getElementById('alertsList');
    if (!alertsList) return;
    
    if (priceAlerts.length === 0) {
        alertsList.innerHTML = '<div class="empty-alert-message">No alerts set</div>';
        return;
    }
    
    // Sort alerts: above alerts ascending, below alerts descending
    const sortedAlerts = [...priceAlerts].sort((a, b) => {
        if (a.type === b.type) {
            return a.type === 'above' ? a.price - b.price : b.price - a.price;
        }
        return a.type === 'above' ? -1 : 1;
    });
    
    alertsList.innerHTML = sortedAlerts.map(alert => `
        <div class="alert-item" data-id="${alert.id}">
            <div class="alert-condition">
                <span class="direction">${alert.type === 'above' ? '↗' : '↘'}</span>
        });
    });
}

// Delete a price alert
function deleteAlert(id) {
    priceAlerts = priceAlerts.filter(alert => alert.id !== id);
    localStorage.setItem('shibPriceAlerts', JSON.stringify(priceAlerts));
    updateAlertsList();
    updateAlertCount();
    showNotification('Alert removed', 'success');
}

// Update the alert count badge
function updateAlertCount() {
    const alertCount = document.getElementById('alertCount');
    if (alertCount) {
        alertCount.textContent = priceAlerts.length;
    }
}

// Check price against alerts
function checkPriceAlerts(price) {
    if (!price || priceAlerts.length === 0) return;
    
    currentPrice = price;
    let triggered = false;
    
    priceAlerts.forEach(alert => {
        if (alert.triggered) return;
        
        if ((alert.type === 'above' && price >= alert.price) || 
            (alert.type === 'below' && price <= alert.price)) {
            
            // Mark as triggered
            alert.triggered = true;
            triggered = true;
            
            // Show notification
            const notificationTitle = `SHIB ${alert.type === 'above' ? 'above' : 'below'} $${formatCryptoPrice(alert.price)}!`;
            const notificationMessage = `Current price: $${formatCryptoPrice(price)}`;
            
            showNotification(notificationMessage, 'alert', notificationTitle);
        }
    });
    
    if (triggered) {
        // Update localStorage with triggered status
        localStorage.setItem('shibPriceAlerts', JSON.stringify(priceAlerts));
        
        // Play notification sound
        playNotificationSound();
    }
}

// Show notification
function showNotification(message, type = 'success', title = null) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    // Set appropriate title if not provided
    if (!title) {
        if (type === 'success') title = 'Success';
        else if (type === 'error') title = 'Error';
        else if (type === 'warning') title = 'Warning';
        else if (type === 'alert') title = 'Price Alert';
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Add notification content
    notification.innerHTML = `
        <div class="notification-icon">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                          type === 'error' ? 'fa-exclamation-circle' : 
                          type === 'warning' ? 'fa-exclamation-triangle' : 'fa-bell'}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-title">${title}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to container
    container.appendChild(notification);
    
    // Add close handler
    const closeButton = notification.querySelector('.notification-close');
    closeButton.addEventListener('click', () => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => {
            container.removeChild(notification);
        }, 300);
    });
    
    // Auto-remove after 5 seconds (except for price alerts)
    if (type !== 'alert') {
        setTimeout(() => {
            if (container.contains(notification)) {
                notification.style.animation = 'slideOut 0.3s ease forwards';
                setTimeout(() => {
                    if (container.contains(notification)) {
                        container.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }
}

// Play notification sound
function playNotificationSound() {
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => console.error('Error playing sound:', err));
}

// Add this function to properly update the price display
function updatePriceDisplay(data) {
    try {
        // Update main price
        const priceElement = document.getElementById('price');
        if (priceElement) {
            const formattedPrice = formatCryptoPrice(data.market_data.current_price.usd);
            priceElement.textContent = `$${formattedPrice}`;
            priceElement.classList.add('price-updated');
            setTimeout(() => priceElement.classList.remove('price-updated'), 1000);
        }
        
        // Update mini price in header
        const miniPriceElement = document.getElementById('price-mini');
        if (miniPriceElement) {
            miniPriceElement.textContent = `$${formatCryptoPrice(data.market_data.current_price.usd)}`;
        }
        
        // Update 24h change percentage
        const change24h = data.market_data.price_change_percentage_24h || 0;
        const changeClass = change24h >= 0 ? 'up' : 'down';
        const changeSymbol = change24h >= 0 ? '+' : '';
        
        const changePercentElement = document.getElementById('changePercent');
        if (changePercentElement) {
            changePercentElement.textContent = `(${changeSymbol}${change24h.toFixed(2)}%)`;
            changePercentElement.className = changeClass;
        }
        
        // Update mini price change in header
        const miniChangeElement = document.getElementById('change-mini');
        if (miniChangeElement) {
            miniChangeElement.textContent = `${changeSymbol}${change24h.toFixed(2)}%`;
            miniChangeElement.className = changeClass;
        }
        
        // Update price change in USD
        const priceChangeUSD = data.market_data.price_change_24h_in_currency?.usd || 0;
        const priceChangeElement = document.getElementById('priceChange');
        if (priceChangeElement) {
            priceChangeElement.textContent = `${priceChangeUSD >= 0 ? '+' : ''}$${Math.abs(priceChangeUSD).toFixed(8)}`;
            priceChangeElement.className = changeClass;
        }
        
        // Update market statistics
        const marketCapElement = document.getElementById('marketCap');
        if (marketCapElement) {
            marketCapElement.textContent = formatNumber(data.market_data.market_cap.usd);
        }
        
        const volumeElement = document.getElementById('volume');
        if (volumeElement) {
            volumeElement.textContent = formatNumber(data.market_data.total_volume.usd);
        }
        
        const rankElement = document.getElementById('rank');
        if (rankElement) {
            rankElement.textContent = `#${data.market_cap_rank}`;
        }
        
        // Remove any cached-data class
        document.querySelectorAll('.cached-data').forEach(element => {
            element.classList.remove('cached-data');
        });
        
    } catch (error) {
        console.error('Error updating price display:', error);
        handleError();
    }
}

// Define the missing initializeChartControls function
function initializeChartControls() {
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    
    // Only initialize if chart elements exist
    if (timeframeButtons.length === 0 || !document.getElementById('priceChart')) {
        return;
    }
    
    // Clean existing listeners
    timeframeButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
    });
    
    // Add new listeners
    document.querySelectorAll('.timeframe-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.timeframe-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            const period = this.getAttribute('data-period') || '7d';
            fetchChartData(period);
        });
    });
}

// Replace optional chaining with more compatible code
function safelyGetNestedProperty(obj, path) {
    // Handle obj?.prop?.subprop in a way that works in all browsers
    if (!obj) return null;
    
    const props = path.split('.');
    let current = obj;
    
    for (let i = 0; i < props.length; i++) {
        if (current === null || current === undefined) {
            return null;
        }
        current = current[props[i]];
    }
    
    return current;
}

// Clear any existing intervals when page unloads
let dataRefreshInterval;

// Initialize data refresh
function startDataRefresh() {
    // Clear any existing interval first
    if (dataRefreshInterval) {
        clearInterval(dataRefreshInterval);
    }
    
    // Fetch initial data
    fetchShibaData();
    
    // Set up new interval
    dataRefreshInterval = setInterval(fetchShibaData, 60000);
}

window.addEventListener('unload', () => {
    if (dataRefreshInterval) {
        clearInterval(dataRefreshInterval);
    }
});

