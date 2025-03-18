// Replace the multiple script tags at the end of your HTML with this single consolidated script

    // Global variables
    const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';
    const COIN_ID = 'shiba-inu';
    let priceAlerts = [];
    let dataCache = null;
    
    // Initialize everything on page load
    document.addEventListener('DOMContentLoaded', () => {
        // Set up all event listeners
        initializeEventListeners();
        
        // Initial data fetch
        fetchShibaData();
        
        // Set refresh interval
        setInterval(fetchShibaData, 60000); // Refresh every minute
        
        // Initialize chart if it exists
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
            // Show loading indicator
            const syncIcon = document.querySelector('.fa-sync-alt');
            if (syncIcon) syncIcon.classList.add('updating');
            
            // Make API request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(`${COINGECKO_API_URL}/coins/${COIN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`API returned status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Update the display
            updatePriceDisplay(data);
            
            // Cache the data
            dataCache = data;
            
            // Check price alerts
            if (data.market_data?.current_price?.usd) {
                checkPriceAlerts(data.market_data.current_price.usd);
            }
            
            // Hide loading indicator
            if (syncIcon) syncIcon.classList.remove('updating');
            
            return data;
        } catch (error) {
            console.error('Error fetching data:', error);
            
            // Hide loading indicator
            const syncIcon = document.querySelector('.fa-sync-alt');
            if (syncIcon) syncIcon.classList.remove('updating');
            
            showNotification('Could not load SHIB price data. Please try again later.', 'error');
        }
    }
    
    // Update the UI with coin data
    function updatePriceDisplay(data) {
        try {
            // Validate data
            if (!data || !data.market_data || !data.market_data.current_price) {
                throw new Error('Invalid data structure from API');
            }
            
            // Extract values
            const price = data.market_data.current_price.usd;
            const formattedPrice = formatCryptoPrice(price);
            const change24h = data.market_data.price_change_percentage_24h || 0;
            const changeClass = change24h >= 0 ? 'up' : 'down';
            const changeSymbol = change24h >= 0 ? '+' : '';
            const priceChangeUSD = data.market_data.price_change_24h_in_currency?.usd || 0;
            
            // Update main price
            const priceElement = document.getElementById('price');
            if (priceElement) {
                priceElement.textContent = `$${formattedPrice}`;
                priceElement.classList.add('price-updated');
                setTimeout(() => priceElement.classList.remove('price-updated'), 1000);
            }
            
            // Update mini price in header
            const miniPriceElement = document.getElementById('price-mini');
            if (miniPriceElement) {
                miniPriceElement.textContent = `$${formattedPrice}`;
            }
            
            // Update 24h change percentage
            const changePercentElement = document.getElementById('changePercent');
            if (changePercentElement) {
                changePercentElement.textContent = `(${changeSymbol}${change24h.toFixed(2)}%)`;
                changePercentElement.className = changeClass;
            }
            
            // Update mini change in header
            const miniChangeElement = document.getElementById('change-mini');
            if (miniChangeElement) {
                miniChangeElement.textContent = `${changeSymbol}${change24h.toFixed(2)}%`;
                miniChangeElement.className = changeClass;
            }
            
            // Update price change in USD
            const priceChangeElement = document.getElementById('priceChange');
            if (priceChangeElement) {
                priceChangeElement.textContent = `${changeSymbol}$${Math.abs(priceChangeUSD).toFixed(8)}`;
                priceChangeElement.className = changeClass;
            }
            
            // Update market stats
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
            
            // Update last updated time
            const lastUpdateElement = document.getElementById('lastUpdate');
            if (lastUpdateElement) {
                lastUpdateElement.textContent = `Last updated: ${formatLastUpdated(data.last_updated)}`;
            }
        } catch (error) {
            console.error('Error updating price display:', error);
        }
    }
    
    // Helper formatting functions
    function formatCryptoPrice(price) {
        if (price === undefined || price === null) return "0.00000000";
        
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
    
    function formatNumber(value) {
        if (!value && value !== 0) return "$0";
        
        if (value >= 1e9) {
            return `$${(value / 1e9).toFixed(2)}B`;
        } else if (value >= 1e6) {
            return `$${(value / 1e6).toFixed(2)}M`;
        } else if (value >= 1e3) {
            return `$${(value / 1e3).toFixed(2)}K`;
        } else {
            return `$${value.toFixed(2)}`;
        }
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
    
    // Chart functionality will be loaded from script.js
