// Blog page functionality - Fetch cryptocurrency news

document.addEventListener('DOMContentLoaded', () => {
    // Configuration
    const articlesPerPage = 6;
    let currentPage = 1;
    let currentFilter = 'all';
    let allArticles = [];
    let filteredArticles = [];
    
    // Elements
    const blogContent = document.getElementById('blogContent');
    const pagination = document.getElementById('pagination');
    const searchInput = document.getElementById('searchInput');
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    // Fetch articles from cryptocurrency news API
    async function fetchArticles() {
        try {
            // Show loader
            blogContent.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
            
            // Use CryptoCompare News API (free and reliable)
            const response = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&api_key=YOUR_API_KEY_HERE');
            const data = await response.json();
            
            if (data.Response === 'Success' || data.Message === 'News list successfully returned') {
                // Filter for SHIB related news
                allArticles = data.Data.filter(article => {
                    const lowerCaseTitle = article.title.toLowerCase();
                    const lowerCaseBody = article.body ? article.body.toLowerCase() : '';
                    const lowerCaseCategories = article.categories ? article.categories.toLowerCase() : '';
                    
                    return lowerCaseTitle.includes('shib') || 
                           lowerCaseTitle.includes('shiba') || 
                           lowerCaseBody.includes('shiba inu') || 
                           lowerCaseCategories.includes('shiba');
                });
                
                // If not enough SHIB specific news, add some general crypto news
                if (allArticles.length < 12) {
                    const generalCryptoNews = data.Data.filter(article => {
                        return !allArticles.includes(article);
                    }).slice(0, 12 - allArticles.length);
                    
                    allArticles = [...allArticles, ...generalCryptoNews];
                }
                
                // Assign categories for filtering
                allArticles = allArticles.map(article => {
                    // Determine article type based on content
                    let articleType = 'news';
                    if (article.title.toLowerCase().includes('analysis') || 
                        article.title.toLowerCase().includes('price prediction')) {
                        articleType = 'analysis';
                    } else if (article.title.toLowerCase().includes('update') || 
                               article.title.toLowerCase().includes('development')) {
                        articleType = 'updates';
                    }
                    
                    return {
                        ...article,
                        articleType
                    };
                });
                
                filteredArticles = [...allArticles];
                displayArticles();
            } else {
                showNoArticlesMessage('Failed to load articles. Please try again later.');
            }
        } catch (error) {
            console.error('Error fetching articles:', error);
            showNoArticlesMessage('Failed to load articles. Please try again later.');
        }
    }
    
    // Display articles based on current page and filters
    function displayArticles() {
        if (filteredArticles.length === 0) {
            showNoArticlesMessage();
            return;
        }
        
        const startIndex = (currentPage - 1) * articlesPerPage;
        const endIndex = startIndex + articlesPerPage;
        const articlesToDisplay = filteredArticles.slice(startIndex, endIndex);
        
        let html = '';
        
        // Featured article (first article)
        if (currentPage === 1) {
            const featuredArticle = articlesToDisplay[0];
            html += `
                <div class="featured-article">
                    <div class="featured-image">
                        <img src="${featuredArticle.imageurl || 'images/default-news.jpg'}" alt="${featuredArticle.title}">
                        <div class="featured-tag">${featuredArticle.articleType.toUpperCase()}</div>
                    </div>
                    <div class="featured-content">
                        <div class="featured-meta">
                            <span><i class="far fa-calendar"></i> ${formatDate(featuredArticle.published_on)}</span>
                            <span><i class="far fa-newspaper"></i> ${featuredArticle.source}</span>
                        </div>
                        <h2 class="featured-title">${featuredArticle.title}</h2>
                        <p class="featured-excerpt">${truncateText(featuredArticle.body, 200)}</p>
                        <a href="${featuredArticle.url}" target="_blank" class="read-more">Read Full Article</a>
                    </div>
                </div>
            `;
            
            // Remove the first article so it's not repeated in the grid
            articlesToDisplay.shift();
        }
        
        // Rest of the articles in grid
        html += '<div class="article-grid">';
        
        articlesToDisplay.forEach(article => {
            html += `
                <div class="article-card">
                    <div class="article-image">
                        <img src="${article.imageurl || 'images/default-news.jpg'}" alt="${article.title}">
                    </div>
                    <div class="article-content">
                        <div class="article-meta">
                            <span><i class="far fa-calendar"></i> ${formatDate(article.published_on)}</span>
                        </div>
                        <h3 class="article-title">${article.title}</h3>
                        <p class="article-excerpt">${truncateText(article.body, 100)}</p>
                        <div class="article-footer">
                            <div class="article-tag">${article.articleType}</div>
                            <a href="${article.url}" target="_blank" class="article-link">Read more <i class="fas fa-chevron-right"></i></a>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        blogContent.innerHTML = html;
        
        // Update pagination
        createPagination();
    }
    
    // Create pagination controls
    function createPagination() {
        const totalPages = Math.ceil(filteredArticles.length / articlesPerPage);
        let paginationHtml = '';
        
        // Previous button
        paginationHtml += `
            <a href="#" class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="prev">
                <i class="fas fa-chevron-left"></i>
            </a>
        `;
        
        // Page numbers
        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                paginationHtml += `
                    <a href="#" class="pagination-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</a>
                `;
            } else if (i === currentPage - 2 || i === currentPage + 2) {
                paginationHtml += `<span class="pagination-ellipsis">...</span>`;
            }
        }
        
        // Next button
        paginationHtml += `
            <a href="#" class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="next">
                <i class="fas fa-chevron-right"></i>
            </a>
        `;
        
        pagination.innerHTML = paginationHtml;
        
        // Add event listeners to pagination buttons
        document.querySelectorAll('.pagination-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                const pageAction = button.dataset.page;
                
                if (pageAction === 'prev' && currentPage > 1) {
                    currentPage--;
                } else if (pageAction === 'next' && currentPage < totalPages) {
                    currentPage++;
                } else if (!isNaN(parseInt(pageAction))) {
                    currentPage = parseInt(pageAction);
                }
                
                displayArticles();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });
    }
    
    // Show message when no articles are found
    function showNoArticlesMessage(message = 'No articles found matching your criteria.') {
        blogContent.innerHTML = `
            <div class="no-articles">
                <i class="fas fa-newspaper"></i>
                <h3>No Articles Found</h3>
                <p>${message}</p>
            </div>
        `;
        pagination.innerHTML = '';
    }
    
    // Format unix timestamp to readable date
    function formatDate(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    // Truncate text to specified length
    function truncateText(text, maxLength) {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    }
    
    // Filter articles by search term
    function filterBySearch(searchTerm) {
        if (!searchTerm) {
            // If search is cleared, reset to current filter only
            filterArticles(currentFilter);
            return;
        }
        
        searchTerm = searchTerm.toLowerCase();
        
        // Filter based on both search term and current category filter
        filteredArticles = allArticles.filter(article => {
            const matchesSearch = article.title.toLowerCase().includes(searchTerm) || 
                               (article.body && article.body.toLowerCase().includes(searchTerm));
                               
            const matchesFilter = currentFilter === 'all' || article.articleType === currentFilter;
            
            return matchesSearch && matchesFilter;
        });
        
        currentPage = 1;
        displayArticles();
    }
    
    // Filter articles by category
    function filterArticles(filter) {
        currentFilter = filter;
        
        // Get current search term if any
        const searchTerm = searchInput.value.trim().toLowerCase();
        
        if (filter === 'all' && !searchTerm) {
            filteredArticles = [...allArticles];
        } else {
            filteredArticles = allArticles.filter(article => {
                const matchesFilter = filter === 'all' || article.articleType === filter;
                const matchesSearch = !searchTerm || 
                                  article.title.toLowerCase().includes(searchTerm) || 
                                  (article.body && article.body.toLowerCase().includes(searchTerm));
                
                return matchesFilter && matchesSearch;
            });
        }
        
        currentPage = 1;
        displayArticles();
    }
    
    // Initialize
    fetchArticles();
    
    // Event listeners for search
    searchInput.addEventListener('input', debounce(function() {
        filterBySearch(this.value.trim());
    }, 300));
    
    // Event listeners for filter buttons
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            filterArticles(this.dataset.filter);
        });
    });
    
    // Debounce function to limit how often a function can run
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
});