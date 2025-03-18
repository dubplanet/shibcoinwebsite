// Replace the multiple script tags at the end of your HTML with this single consolidated script

    // Global variables
    const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
    const COIN_ID = 'shiba-inu';
    const API_CACHE_DURATION = 60000; // 1 minute
    const API_HEADERS = {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
    };
    let priceAlerts = [];
    let dataCache = null;
    
    // Replace the DOMContentLoaded event listener
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            // Initialize containers first
            initializeContainers();
            
            // Set up event listeners
            initializeEventListeners();
            
            // Initial data fetch
            await fetchShibaData();
            
            // Start refresh interval
            startDataRefresh();
            
            // Load alerts if they exist
            loadSavedAlerts();
            
        } catch (error) {
            console.error('Initialization error:', error);
            handleFetchError();
        }
    });
    
    function initializeEventListeners() {
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
        
        // FAQ functionality
        document.querySelectorAll('.faq-question').forEach(question => {
            question.addEventListener('click', function() {
                const parent = this.parentElement;
                const answer = this.nextElementSibling;
                parent.classList.toggle('active');
                if (parent.classList.contains('active')) {
                    answer.style.height = answer.scrollHeight + 'px';
                } else {
                    answer.style.height = '0';
                }
            });
        });
        
        // Cookie consent
        const cookieConsent = document.getElementById('cookieConsent');
        const cookieAccept = document.getElementById('cookieAccept');
        
        if (!localStorage.getItem('cookieConsent') && cookieConsent) {
            setTimeout(() => {
                cookieConsent.classList.add('active');
            }, 1000);
        }
        
        if (cookieAccept) {
            cookieAccept.addEventListener('click', () => {
                localStorage.setItem('cookieConsent', 'accepted');
                cookieConsent.classList.remove('active');
                cookieConsent.classList.add('closing');
                
                setTimeout(() => {
                    cookieConsent.style.display = 'none';
                }, 500);
            });
        }
        
        // Alert widget
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
            setAlertButton.addEventListener('click', () => {
                addNewAlert();
            });
        }
        
        if (alertPriceInput) {
            alertPriceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addNewAlert();
                }
            });
        }
    }
    
    // Fetch SHIB data from API
    async function fetchShibaData() {
        try {
            // Show loading state
            const syncIcon = document.querySelector('.fa-sync-alt');
            if (syncIcon) syncIcon.classList.add('updating');

            // Add timeout protection
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, {
                signal: controller.signal,
                headers: API_HEADERS,
                cache: 'no-store'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Validate required data
            if (!data.market_data?.current_price?.usd) {
                throw new Error('Invalid data structure received');
            }

            // Update cache
            dataCache = {
                price: data.market_data.current_price.usd,
                marketCap: data.market_data.market_cap?.usd,
                volume: data.market_data.total_volume?.usd,
                rank: data.market_cap_rank,
                change24h: data.market_data.price_change_percentage_24h,
                lastUpdated: new Date().toISOString()
            };

            // Update UI
            updatePriceDisplay(data);
            
            if (syncIcon) syncIcon.classList.remove('updating');
            
            return data;

        } catch (error) {
            console.error('Fetch error:', error);
            handleFetchError();
            return null;
        }
    }

    // Add this new error handler
    function handleFetchError() {
        const syncIcon = document.querySelector('.fa-sync-alt');
        if (syncIcon) syncIcon.classList.remove('updating');

        // Try to use cached data if available
        if (dataCache?.price) {
            updatePriceFromCache();
            showNotification('Using cached data - Connection issue', 'warning');
        } else {
            showNotification('Unable to load SHIB data', 'error');
            displayErrorState();
        }
    }

    // Add this function to show error state
    function displayErrorState() {
        const elements = {
            price: document.getElementById('price'),
            miniPrice: document.getElementById('price-mini'),
            changePercent: document.getElementById('changePercent'),
            priceChange: document.getElementById('priceChange'),
            marketCap: document.getElementById('marketCap'),
            volume: document.getElementById('volume'),
            rank: document.getElementById('rank')
        };

        Object.values(elements).forEach(el => {
            if (el) {
                el.textContent = '--';
                el.classList.remove('up', 'down');
                el.classList.add('error');
            }
        });
    }

    // Add this function to update from cache
    function updatePriceFromCache() {
        if (!dataCache) return;
        
        const elements = {
            price: { id: 'price', value: formatCryptoPrice(dataCache.price) },
            miniPrice: { id: 'price-mini', value: formatCryptoPrice(dataCache.price) },
            marketCap: { id: 'marketCap', value: formatNumber(dataCache.marketCap) },
            volume: { id: 'volume', value: formatNumber(dataCache.volume) },
            rank: { id: 'rank', value: `#${dataCache.rank}` }
        };

        Object.entries(elements).forEach(([key, { id, value }]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                element.classList.add('cached');
            }
        });
    }
    
    // Update the UI with coin data
    function updatePriceDisplay(data) {
        if (!data?.market_data?.current_price?.usd) {
            throw new Error('Invalid price data');
        }

        const elements = {
            price: {
                id: 'price',
                value: formatCryptoPrice(data.market_data.current_price.usd)
            },
            priceMini: {
                id: 'price-mini',
                value: formatCryptoPrice(data.market_data.current_price.usd)
            },
            marketCap: {
                id: 'marketCap',
                value: formatNumber(data.market_data.market_cap?.usd || 0)
            },
            volume: {
                id: 'volume',
                value: formatNumber(data.market_data.total_volume?.usd || 0)
            },
            rank: {
                id: 'rank',
                value: `#${data.market_cap_rank || '0'}`
            },
            change24h: {
                id: 'changePercent',
                value: `(${data.market_data.price_change_percentage_24h?.toFixed(2) || '0.00'}%)`
            }
        };

        // Update all elements
        Object.values(elements).forEach(({id, value}) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });

        // Update change classes
        const changeValue = data.market_data.price_change_percentage_24h || 0;
        const changeClass = changeValue >= 0 ? 'up' : 'down';
        
        ['changePercent', 'change-mini'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.className = changeClass;
            }
        });
    }
    
    // Helper formatting functions
    function formatCryptoPrice(price) {
        if (typeof price !== 'number') return '0.00000000';
        
        if (price < 0.00001) {
            return price.toFixed(10);
        } else if (price < 0.0001) {
            return price.toFixed(8);
        } else if (price < 0.01) {
            return price.toFixed(6);
        } else if (price < 1) {
            return price.toFixed(4);
        }
        return price.toFixed(2);
    }
    
    function formatNumber(num) {
        if (!num) return '$0';
        
        if (num >= 1e9) {
            return `$${(num / 1e9).toFixed(2)}B`;
        } else if (num >= 1e6) {
            return `$${(num / 1e6).toFixed(2)}M`;
        } else if (num >= 1e3) {
            return `$${(num / 1e3).toFixed(2)}K`;
        }
        return `$${num.toFixed(2)}`;
    }
    
    function formatLastUpdated(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (e) {
            return "Just now";
        }
    }
    
    // Price alert functions
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
    }
    
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
                    <span>${alert.type === 'above' ? 'Above' : 'Below'} $${formatCryptoPrice(alert.price)}</span>
                </div>
                <button class="delete-alert" data-id="${alert.id}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
        
        // Add event listeners for delete buttons
        document.querySelectorAll('.delete-alert').forEach(button => {
            button.addEventListener('click', () => {
                const alertId = parseInt(button.getAttribute('data-id'));
                deleteAlert(alertId);
            });
        });
    }
    
    function deleteAlert(id) {
        priceAlerts = priceAlerts.filter(alert => alert.id !== id);
        localStorage.setItem('shibPriceAlerts', JSON.stringify(priceAlerts));
        updateAlertsList();
        updateAlertCount();
        showNotification('Alert removed', 'success');
    }
    
    function updateAlertCount() {
        const alertCount = document.getElementById('alertCount');
        if (alertCount) {
            alertCount.textContent = priceAlerts.length;
        }
    }
    
    function checkPriceAlerts(price) {
        if (!price || priceAlerts.length === 0) return;
        
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
    
    // Notification system
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
    
    // Add this new function
    function initializeContainers() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notificationContainer')) {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
    }

    // Add this new function
    function startDataRefresh() {
        // Clear any existing intervals
        if (window.priceRefreshInterval) {
            clearInterval(window.priceRefreshInterval);
        }
        
        // Set new interval
        window.priceRefreshInterval = setInterval(fetchShibaData, API_CACHE_DURATION);
    }

    // Chart functionality will be loaded from script.js

    function handleError() {
        // Hide loading state
        const syncIcon = document.querySelector('.fa-sync-alt');
        if (syncIcon) syncIcon.classList.remove('updating');
        
        // Show error state in UI
        const elements = ['price', 'price-mini', 'marketCap', 'volume', 'rank'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = 'Error loading';
                element.classList.add('error');
            }
        });
        
        // Show error notification
        const container = document.getElementById('notificationContainer');
        if (container) {
            const notification = document.createElement('div');
            notification.className = 'notification error';
            notification.innerHTML = `
                <div class="notification-content">
                    <div class="notification-title">Error</div>
                    <div class="notification-message">Could not load SHIB price data. Please try again later.</div>
                </div>
            `;
            container.appendChild(notification);
            
            // Remove notification after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    }
