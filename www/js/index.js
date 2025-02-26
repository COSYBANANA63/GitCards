document.addEventListener('deviceready', onDeviceReady, false);

let db = null;

function onDeviceReady() {
    console.log('Device is ready');
    
    // Add status bar padding if available
    if (window.StatusBar) {
        StatusBar.styleDefault();
        // document.body.classList.add('has-status-bar');
    }

    // Initialize SQLite database
    db = window.sqlitePlugin.openDatabase({
        name: 'githubcards.db',
        location: 'default'
    });

    // Create table for saved GitHub profiles
    db.transaction((tx) => {
        tx.executeSql(`
            CREATE TABLE IF NOT EXISTS github_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                name TEXT,
                bio TEXT,
                followers INTEGER,
                following INTEGER,
                repos INTEGER,
                location TEXT,
                website TEXT,
                profile_image TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        //table for messages
        tx.executeSql(`
            CREATE TABLE IF NOT EXISTS profile_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id INTEGER,
                sender_username TEXT,
                receiver_username TEXT,
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (profile_id) REFERENCES github_profiles (id)
            )
        `);
    }, (error) => {
        console.log('Error creating table:', error);
        showStatusMessage('Error initializing database');
    }, () => {
        loadSavedProfiles(); // Load saved profiles on startup
    });
    // Check if user is already logged in
    const savedUsername = localStorage.getItem("github_username");
    if (savedUsername) {
        loadOrCreateUserProfile(savedUsername);
    }
    

    // Event listeners
    document.getElementById('searchButton').addEventListener('click', searchGitHubProfile);
    document.getElementById('saveProfile').addEventListener('click', saveGitHubProfile);
    document.getElementById('shareProfile').addEventListener('click', function() {
        shareGitHubProfile(document.getElementById('githubSearch').value.trim());
    });
    document.querySelector('.stat-item:nth-child(1)').addEventListener('click', function() {
        const username = document.getElementById('githubSearch').value.trim();
        showFollowers(username);
    });
    
    document.querySelector('.stat-item:nth-child(2)').addEventListener('click', function() {
        const username = document.getElementById('githubSearch').value.trim();
        showFollowing(username);
    });
    
    document.querySelector('.stat-item:nth-child(3)').addEventListener('click', function() {
        const username = document.getElementById('githubSearch').value.trim();
        showRepositories(username);
    });
    
    // Add keyboard event for search input
    document.getElementById('githubSearch').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            searchGitHubProfile();
        }
    });
    addMessageStyles();
    addRepoDetailsStyling();
    setupNetworkMonitoring();
    // Add touch feedback
    addTouchFeedback();
}

// Add touch feedback for buttons
function addTouchFeedback() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            // Save the original transform if it exists
            const originalTransform = this.style.transform || 'none';
            this.dataset.originalTransform = originalTransform;
            
            // Only apply scale if it's not the search button (to avoid misalignment)
            if (this.id !== 'searchButton') {
                this.style.transform = 'scale(0.98)';
            }
        });
        
        button.addEventListener('touchend', function() {
            // Restore original transform or reset
            if (this.id !== 'searchButton') {
                this.style.transform = this.dataset.originalTransform || 'none';
            }
        });
    });
}

// Show loading indicator
function showLoading() {
    document.getElementById('loadingIndicator').classList.add('active');
}

// Hide loading indicator
function hideLoading() {
    document.getElementById('loadingIndicator').classList.remove('active');
}

// Show status message
function showStatusMessage(message, duration = 2000) {
    const statusElement = document.getElementById('statusMessage');
    statusElement.textContent = message;
    statusElement.classList.add('active');
    
    setTimeout(() => {
        statusElement.classList.remove('active');
    }, duration);
}

// Verify image URL - this function was missing in your original code
async function verifyImageURL(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
            return url;
        } else {
            // Return a default image URL if the original URL is not accessible
            return 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
        }
    } catch (error) {
        console.error('Error verifying image URL:', error);
        return 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
    }
}

// Save GitHub profile to database
function saveGitHubProfile() {
    showLoading();
    
    const profile = {
        username: document.getElementById('githubSearch').value.trim(),
        name: document.getElementById('profileName').textContent,
        bio: document.getElementById('profileBio').textContent,
        followers: document.getElementById('profileFollowers').textContent,
        following: document.getElementById('profileFollowing').textContent,
        repos: document.getElementById('profileRepos').textContent,
        location: document.getElementById('profileLocation').textContent,
        website: document.getElementById('profileWebsite').href,
        profile_image: document.getElementById('profileImage').src
    };

    db.transaction((tx) => {
        tx.executeSql(`
            INSERT INTO github_profiles (username, name, bio, followers, following, repos, location, website, profile_image)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            profile.username,
            profile.name,
            profile.bio,
            profile.followers,
            profile.following,
            profile.repos,
            profile.location,
            profile.website,
            profile.profile_image
        ], (tx, results) => {
            if (results.rowsAffected > 0) {
                hideLoading();
                showStatusMessage('Profile saved successfully');
                loadSavedProfiles(); // Reload saved profiles
            }
        });
    }, (error) => {
        console.error('Error saving profile:', error);
        hideLoading();
        showStatusMessage('Failed to save profile');
    });
}

// Delete a saved profile
function deleteProfile(id) {
    // Show confirmation
    showCustomAlert('Are you sure you want to delete this profile?',
    
        function(){
    showLoading();
    
    db.transaction((tx) => {
        tx.executeSql('DELETE FROM github_profiles WHERE id = ?', [id], (tx, results) => {
            if (results.rowsAffected > 0) {
                hideLoading();
                showStatusMessage('Profile deleted successfully');
                loadSavedProfiles(); // Reload saved profiles
            } else {
                hideLoading();
                showStatusMessage('Failed to delete profile');
            }
        });
    }, (error) => {
        console.error('Error deleting profile:', error);
        hideLoading();
        showStatusMessage('Error deleting profile');
    });
    }
);
}

// Load saved profiles from database
function loadSavedProfiles() {
    const savedCardsContainer = document.getElementById('savedCards');
    savedCardsContainer.innerHTML = ''; // Clear existing cards

    db.transaction((tx) => {
        tx.executeSql('SELECT * FROM github_profiles ORDER BY created_at DESC', [], (tx, results) => {
            if (results.rows.length === 0) {
                savedCardsContainer.innerHTML = '<p style="text-align: center; color: var(--gray); grid-column: 1/-1; padding: 2rem 1rem;">No saved profiles yet. Search for GitHub users and save them to see them here.</p>';
                return;
            }
            
            for (let i = 0; i < results.rows.length; i++) {
                const profile = results.rows.item(i);
                const card = createSavedCard(profile);
                savedCardsContainer.appendChild(card);
            }
        });
    }, (error) => {
        console.error('Error loading saved profiles:', error);
        showStatusMessage('Error loading saved profiles');
    });
}

// Create a saved profile card
function createSavedCard(profile) {
    const card = document.createElement('div');
    card.className = 'saved-card';
    
    // Improved click handler with better transition handling
    card.addEventListener('click', function(event) {
        // Prevent click from triggering if we clicked on a button
        if (event.target.closest('.delete-button') || event.target.closest('.share-button')) {
            return;
        }
        
        // Add visual feedback
        this.classList.add('card-active');
        
        // Get a fresh reference to the search input and profile card
        const searchInput = document.getElementById('githubSearch');
        const profileCard = document.getElementById('githubProfileCard');
        
        // Set the username in the search box
        searchInput.value = profile.username;
        
        // Prepare the profile card
        if (profileCard) {
            // Reset transition properties
            profileCard.style.transition = 'none';
            profileCard.offsetHeight; // Force reflow
            profileCard.style.transition = 'opacity 0.3s ease';
            
            // Start with opacity 0
            profileCard.style.opacity = '0';
            profileCard.classList.remove('hidden');
        }
        
        // Fill in the profile data directly from our saved data to avoid API call
        document.getElementById('profileImage').src = profile.profile_image;
        document.getElementById('profileName').textContent = profile.name;
        document.getElementById('profileBio').textContent = profile.bio;
        document.getElementById('profileFollowers').textContent = profile.followers;
        document.getElementById('profileFollowing').textContent = profile.following;
        document.getElementById('profileRepos').textContent = profile.repos;
        document.getElementById('profileLocation').textContent = profile.location;
        document.getElementById('profileWebsite').href = profile.website;
        document.getElementById('profileWebsite').textContent = profile.website !== '#' ? profile.website : 'No website';
        
        // Use a short timeout to ensure the visual feedback is shown before transitioning
        setTimeout(() => {
            // Remove the active class
            this.classList.remove('card-active');
            
            // Show the profile card with a smooth fade-in
            if (profileCard) {
                profileCard.style.opacity = '1';
                
                // Immediately scroll to the profile card
                profileCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                //or, focus specifically on the bio element
                // document.getElementById('profileBio').scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    });

    card.innerHTML = `
        <img src="${profile.profile_image}" alt="${profile.name}" loading="lazy">
        <h3>${profile.name}</h3>
        <p>${profile.bio}</p>
        <div class="saved-card-stats">
            <span><strong>${profile.followers}</strong> followers</span>
            <span><strong>${profile.repos}</strong> repos</span>
        </div>
        <div class="saved-card-actions">
        <button class="share-button" onclick="event.stopPropagation(); shareGitHubProfile('${profile.username}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="action-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
        </button>
        <button class="delete-button" onclick="event.stopPropagation(); deleteProfile(${profile.id})">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="action-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
        </button>
        <button class="message-button" onclick="event.stopPropagation(); showMessageDialog(${profile.id}, '${profile.name}')">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="action-icon">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Messages
        </button>
    </div>
    `;

    return card;
}
// Share GitHub profile
function shareGitHubProfile(username) {
    const profileUrl = `https://github.com/${username}`;
    if (navigator.share) {
        navigator.share({
            title: `GitHub Profile: ${username}`,
            url: profileUrl
        }).then(() => {
            console.log('Profile shared successfully');
            showStatusMessage('Profile shared successfully');
        }).catch(error => {
            console.error('Error sharing profile:', error);
            showStatusMessage('Error sharing profile');
        });
    } else {
        // Fallback for devices that do not support the Web Share API
        showStatusMessage(`Share this profile: ${profileUrl}`);
    }
}

// Global variables for pagination
let currentPage = 1;
const perPage = 30; // Increased from 10
let currentEndpoint = '';
let totalPages = 1;

// Fetch and display repositories with pagination
function showRepositories(username, page = 1) {
    showLoading();
    currentEndpoint = 'repos';
    currentPage = page;
    
    fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=${perPage}&page=${page}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch repositories');
            // Get total count from header if available
            const linkHeader = response.headers.get('Link');
            if (linkHeader) {
                totalPages = parseLinkHeader(linkHeader);
            }
            return response.json();
        })
        .then(repos => {
            // Create and show the details card
            const detailsContent = createReposList(repos, username);
            showDetailsCard('Repositories', detailsContent);
            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching repositories:', error);
            hideLoading();
            showStatusMessage('Failed to fetch repositories');
        });
}

// Fetch and display followers with pagination
function showFollowers(username, page = 1) {
    showLoading();
    currentEndpoint = 'followers';
    currentPage = page;
    
    fetch(`https://api.github.com/users/${username}/followers?per_page=${perPage}&page=${page}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch followers');
            // Get total count from header if available
            const linkHeader = response.headers.get('Link');
            if (linkHeader) {
                totalPages = parseLinkHeader(linkHeader);
            }
            return response.json();
        })
        .then(followers => {
            // Create and show the details card
            const detailsContent = createUsersList(followers, 'follower', username);
            showDetailsCard('Followers', detailsContent);
            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching followers:', error);
            hideLoading();
            showStatusMessage('Failed to fetch followers');
        });
}

// Fetch and display following with pagination
function showFollowing(username, page = 1) {
    showLoading();
    currentEndpoint = 'following';
    currentPage = page;
    
    fetch(`https://api.github.com/users/${username}/following?per_page=${perPage}&page=${page}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch following');
            // Get total count from header if available
            const linkHeader = response.headers.get('Link');
            if (linkHeader) {
                totalPages = parseLinkHeader(linkHeader);
            }
            return response.json();
        })
        .then(following => {
            // Create and show the details card
            const detailsContent = createUsersList(following, 'following', username);
            showDetailsCard('Following', detailsContent);
            hideLoading();
        })
        .catch(error => {
            console.error('Error fetching following:', error);
            hideLoading();
            showStatusMessage('Failed to fetch following');
        });
}

// Parse Link header to get pagination info
function parseLinkHeader(linkHeader) {
    const links = linkHeader.split(',');
    let lastPage = 1;
    
    // Find the 'last' link which contains the total number of pages
    links.forEach(link => {
        if (link.includes('rel="last"')) {
            // Extract page number from the URL
            const match = link.match(/[&?]page=(\d+)/);
            if (match && match[1]) {
                lastPage = parseInt(match[1]);
            }
        }
    });
    
    return lastPage;
}

// Create pagination controls
function createPaginationControls(currentPage, totalPages, username) {
    if (totalPages <= 1) return '';
    
    let paginationHTML = `<div class="pagination">`;
    
    // Previous button
    if (currentPage > 1) {
        paginationHTML += `<button onclick="loadPage('${username}', ${currentPage - 1})" class="pagination-button">Previous</button>`;
    } else {
        paginationHTML += `<button disabled class="pagination-button disabled">Previous</button>`;
    }
    
    // Page indicator
    paginationHTML += `<span class="page-indicator">Page ${currentPage} of ${totalPages}</span>`;
    
    // Next button
    if (currentPage < totalPages) {
        paginationHTML += `<button onclick="loadPage('${username}', ${currentPage + 1})" class="pagination-button">Next</button>`;
    } else {
        paginationHTML += `<button disabled class="pagination-button disabled">Next</button>`;
    }
    
    paginationHTML += `</div>`;
    return paginationHTML;
}

// Load a specific page based on the current endpoint
function loadPage(username, page) {
    switch (currentEndpoint) {
        case 'repos':
            showRepositories(username, page);
            break;
        case 'followers':
            showFollowers(username, page);
            break;
        case 'following':
            showFollowing(username, page);
            break;
    }
}

// Create HTML for repositories list with pagination
function createReposList(repos, username) {
    if (repos.length === 0) {
        return '<p class="empty-message">No repositories found</p>';
    }
    
    return `
        <div class="details-list">
            ${repos.map(repo => `
                <div class="details-item" onclick="showRepoDetails('${username}', '${repo.name}')">
                    <h3>
                        <a href="#" onclick="event.stopPropagation();">${repo.name}</a>
                        ${repo.fork ? '<span class="badge">Fork</span>' : ''}
                    </h3>
                    <p>${repo.description || 'No description available'}</p>
                    <div class="details-meta">
                        ${repo.language ? `<span class="language"><span class="language-dot" style="background-color: ${getLanguageColor(repo.language)}"></span>${repo.language}</span>` : ''}
                        <span class="stars">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                            </svg>
                            ${repo.stargazers_count}
                        </span>
                        <span class="forks">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                                <line x1="6" y1="3" x2="6" y2="15"></line>
                                <circle cx="18" cy="6" r="3"></circle>
                                <circle cx="6" cy="18" r="3"></circle>
                                <path d="M18 9a9 9 0 0 1-9 9"></path>
                            </svg>
                            ${repo.forks_count}
                        </span>
                        <span class="updated">Updated ${formatDate(repo.updated_at)}</span>
                    </div>
                </div>
            `).join('')}
        </div>
        ${createPaginationControls(currentPage, totalPages, username)}
    `;
}

function showRepoDetails(username, repoName) {
    showLoading();
    
    // Fetch the repository details
    fetch(`https://api.github.com/repos/${username}/${repoName}`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch repository details');
            return response.json();
        })
        .then(repo => {
            // Fetch README content if available
            return fetch(`https://api.github.com/repos/${username}/${repoName}/readme`)
                .then(response => {
                    if (!response.ok) {
                        // If README not found, return null
                        return null;
                    }
                    return response.json();
                })
                .catch(() => null)
                .then(readmeData => {
                    // Create and show detailed repository view
                    const detailsContent = createRepoDetailsView(repo, readmeData, username);
                    showDetailsCard(`Repository: ${repo.name}`, detailsContent);
                    hideLoading();
                });
        })
        .catch(error => {
            console.error('Error fetching repository details:', error);
            hideLoading();
            showStatusMessage('Failed to fetch repository details');
        });
}

function createRepoDetailsView(repo, readmeData, username) {
    // Download ZIP URL
    const downloadUrl = `https://github.com/${repo.owner.login}/${repo.name}/archive/refs/heads/${repo.default_branch}.zip`;
    
    let readmeContent = '<p class="readme-placeholder">No README found for this repository.</p>';
    
    if (readmeData) {
        // GitHub API returns README content as base64 encoded
        try {
            const decodedContent = atob(readmeData.content);
            // Very simple markdown rendering (just for demonstration)
            readmeContent = `<div class="readme-content">${decodedContent.replace(/\n/g, '<br>')}</div>`;
        } catch (e) {
            console.error('Error decoding README content:', e);
            readmeContent = '<p class="readme-placeholder">Error loading README content.</p>';
        }
    }
    
    return `
        <div class="repo-details">
            <div class="repo-header">
                <h2>${repo.full_name}</h2>
                <p>${repo.description || 'No description available'}</p>
            </div>
            
            <div class="repo-stats">
                <div class="stat-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                    </svg>
                    <span>${repo.stargazers_count} stars</span>
                </div>
                
                <div class="stat-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <line x1="6" y1="3" x2="6" y2="15"></line>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                    </svg>
                    <span>${repo.forks_count} forks</span>
                </div>
                
                <div class="stat-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>${repo.open_issues_count} issues</span>
                </div>
                
                ${repo.language ? `
                <div class="stat-badge">
                    <span class="language-dot" style="background-color: ${getLanguageColor(repo.language)}"></span>
                    <span>${repo.language}</span>
                </div>
                ` : ''}
                
                <div class="stat-badge">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>Updated ${formatDate(repo.updated_at)}</span>
                </div>
            </div>
            
            <div class="repo-actions">
                <a href="${repo.html_url}" target="_blank" class="repo-action-button">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                    View on GitHub
                </a>
                
                <a href="${downloadUrl}" target="_blank" class="repo-action-button download-button" onclick="trackDownload('${username}', '${repo.name}')">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Download ZIP
                </a>
            </div>
            
            <div class="repo-tabs">
                <div class="tab-header">
                    <button class="tab-button active" onclick="switchRepoTab(this, 'readme')">README</button>
                    <button class="tab-button" onclick="switchRepoTab(this, 'files')">Files</button>
                    <button class="tab-button" onclick="switchRepoTab(this, 'commits')">Commits</button>
                </div>
                
                <div class="tab-content" id="readme-tab">
                    ${readmeContent}
                </div>
                
                <div class="tab-content hidden" id="files-tab">
                    <div class="loading-files">
                        <p>Loading files...</p>
                    </div>
                </div>
                
                <div class="tab-content hidden" id="commits-tab">
                    <div class="loading-commits">
                        <p>Loading commit history...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function switchRepoTab(button, tabName) {
    // Update active button
    const allTabButtons = document.querySelectorAll('.tab-button');
    allTabButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Hide all tab contents
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(tab => tab.classList.add('hidden'));
    
    // Show selected tab
    const selectedTab = document.getElementById(`${tabName}-tab`);
    if (selectedTab) {
        selectedTab.classList.remove('hidden');
    }
    
    // Load content if needed
    const username = document.getElementById('githubSearch').value.trim();
    const repoName = document.querySelector('.repo-header h2').textContent.split('/')[1];
    
    if (tabName === 'files' && !selectedTab.querySelector('.file-list')) {
        loadRepoFiles(username, repoName);
    } else if (tabName === 'commits' && !selectedTab.querySelector('.commit-list')) {
        loadRepoCommits(username, repoName);
    }
}

// Function to load repository files
function loadRepoFiles(username, repoName) {
    const filesTab = document.getElementById('files-tab');
    
    fetch(`https://api.github.com/repos/${username}/${repoName}/contents`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch repository files');
            return response.json();
        })
        .then(files => {
            let fileListHTML = '<div class="file-list">';
            
            // Sort: directories first, then files
            files.sort((a, b) => {
                if (a.type === 'dir' && b.type !== 'dir') return -1;
                if (a.type !== 'dir' && b.type === 'dir') return 1;
                return a.name.localeCompare(b.name);
            });
            
            files.forEach(file => {
                const isDir = file.type === 'dir';
                fileListHTML += `
                    <div class="file-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" class="file-icon">
                            ${isDir 
                                ? '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>' 
                                : '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>'}
                        </svg>
                        <a href="${file.html_url}" target="_blank" class="file-name">${file.name}</a>
                    </div>
                `;
            });
            
            fileListHTML += '</div>';
            filesTab.innerHTML = fileListHTML;
        })
        .catch(error => {
            console.error('Error loading repository files:', error);
            filesTab.innerHTML = '<p class="error-message">Failed to load repository files. Please try again later.</p>';
        });
}

// Function to load repository commits
function loadRepoCommits(username, repoName) {
    const commitsTab = document.getElementById('commits-tab');
    
    fetch(`https://api.github.com/repos/${username}/${repoName}/commits?per_page=10`)
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch repository commits');
            return response.json();
        })
        .then(commits => {
            let commitListHTML = '<div class="commit-list">';
            
            commits.forEach(commit => {
                const author = commit.author ? commit.author.login : (commit.commit.author ? commit.commit.author.name : 'Unknown');
                const avatarUrl = commit.author ? commit.author.avatar_url : 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png';
                const message = commit.commit.message;
                const date = formatDate(commit.commit.author.date);
                
                commitListHTML += `
                    <div class="commit-item">
                        <img src="${avatarUrl}" alt="${author}" class="commit-avatar">
                        <div class="commit-details">
                            <div class="commit-message">${message.split('\n')[0]}</div>
                            <div class="commit-meta">
                                <span class="commit-author">${author}</span>
                                <span class="commit-date">committed ${date}</span>
                            </div>
                        </div>
                        <a href="${commit.html_url}" target="_blank" class="commit-sha">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                `;
            });
            
            commitListHTML += '</div>';
            commitsTab.innerHTML = commitListHTML;
        })
        .catch(error => {
            console.error('Error loading repository commits:', error);
            commitsTab.innerHTML = '<p class="error-message">Failed to load repository commits. Please try again later.</p>';
        });
}

// Function to track downloads (optional)
function trackDownload(username, repoName) {
    console.log(`Download requested for ${username}/${repoName}`);
    showStatusMessage(`Downloading ${repoName}.zip...`);
    
    // You could track this in analytics or in your SQLite DB if desired
}

// Add these styles to your CSS or add them to the addMessageStyles function
function addRepoDetailsStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Repository Details View */
        .repo-details {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }
        
        .repo-header {
            margin-bottom: 0.5rem;
        }
        
        .repo-stats {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        
        .stat-badge {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.5rem;
            background-color: var(--light-gray);
            border-radius: 1rem;
            font-size: 0.85rem;
        }
        
        .repo-actions {
            display: flex;
            gap: 0.75rem;
            margin-bottom: 1rem;
        }
        
        .repo-action-button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            background-color: var(--primary-color);
            color: white;
            text-decoration: none;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .repo-action-button:hover {
            background-color: var(--primary-dark);
        }
        
        .download-button {
            background-color: var(--success-color);
        }
        
        .download-button:hover {
            background-color: var(--success-dark);
        }
        
        .repo-tabs {
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            overflow: hidden;
        }
        
        .tab-header {
            display: flex;
            background-color: var(--light-gray);
            border-bottom: 1px solid var(--border-color);
        }
        
        .tab-button {
            flex: 1;
            padding: 0.75rem;
            background: none;
            border: none;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .tab-button:not(:last-child) {
            border-right: 1px solid var(--border-color);
        }
        
        .tab-button.active {
            background-color: white;
            border-bottom: 2px solid var(--primary-color);
        }
        
        .tab-content {
            padding: 1rem;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .tab-content.hidden {
            display: none;
        }
        
        .readme-content {
            white-space: pre-wrap;
            line-height: 1.5;
        }
        
        .readme-placeholder {
            color: var(--gray);
            text-align: center;
            padding: 2rem;
        }
        
        /* File list styling */
        .file-list {
            display: flex;
            flex-direction: column;
        }
        
        .file-item {
            display: flex;
            align-items: center;
            padding: 0.5rem;
            border-bottom: 1px solid var(--light-gray);
        }
        
        .file-icon {
            margin-right: 0.5rem;
            color: var(--primary-color);
        }
        
        .file-name {
            text-decoration: none;
            color: var(--text-color);
        }
        
        /* Commit list styling */
        .commit-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .commit-item {
            display: flex;
            padding: 0.75rem;
            border: 1px solid var(--light-gray);
            border-radius: 0.5rem;
            align-items: center;
        }
        
        .commit-avatar {
            width: 2rem;
            height: 2rem;
            border-radius: 50%;
            margin-right: 0.75rem;
        }
        
        .commit-details {
            flex: 1;
        }
        
        .commit-message {
            font-weight: 500;
            margin-bottom: 0.25rem;
        }
        
        .commit-meta {
            display: flex;
            gap: 0.5rem;
            font-size: 0.85rem;
            color: var(--gray);
        }
        
        .commit-sha {
            color: var(--gray);
            padding: 0.25rem;
        }
        
        /* Make repository cards interactive */
        .details-item {
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .details-item:hover {
            background-color: var(--light-gray);
        }
    `;
    
    document.head.appendChild(style);
}


// Create HTML for users list (followers or following) with pagination
function createUsersList(users, type, username) {
    if (users.length === 0) {
        return `<p class="empty-message">No ${type}s found</p>`;
    }
    
    return `
        <div class="users-grid">
            ${users.map(user => `
                <div class="user-item" onclick="document.getElementById('githubSearch').value = '${user.login}'; searchGitHubProfile(); closeDetailsCard();">
                    <img src="${user.avatar_url}" alt="${user.login}" loading="lazy">
                    <div class="user-info">
                        <h3>${user.login}</h3>
                        <a href="${user.html_url}" target="_blank" onclick="event.stopPropagation();">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
        ${createPaginationControls(currentPage, totalPages, username)}
    `;
}

// Show details card with content
function showDetailsCard(title, content) {
    let detailsCard = document.getElementById('detailsCard');
    
    // Create the card if it doesn't exist
    if (!detailsCard) {
        detailsCard = document.createElement('div');
        detailsCard.id = 'detailsCard';
        detailsCard.className = 'details-card';
        document.querySelector('.container').appendChild(detailsCard);
    }
    
    // Populate the card
    detailsCard.innerHTML = `
        <div class="details-header">
            <h2>${title}</h2>
            <button class="close-button" onclick="closeDetailsCard()">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
        <div class="details-content">
            ${content}
        </div>
    `;
    
    // Show with animation
    setTimeout(() => {
        detailsCard.classList.add('active');
    }, 10);
    
    // Scroll to the card
    detailsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Close details card
function closeDetailsCard() {
    const detailsCard = document.getElementById('detailsCard');
    if (detailsCard) {
        detailsCard.classList.remove('active');
        setTimeout(() => {
            detailsCard.remove();
        }, 300);
    }
}

// Helper function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // If less than a day, show hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return hours === 0 ? 'just now' : `${hours} hours ago`;
    }
    
    // If less than a month, show days
    if (diff < 2592000000) {
        const days = Math.floor(diff / 86400000);
        return `${days} days ago`;
    }
    
    // Otherwise show month and day
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
}

// Helper function to get a color for programming languages
function getLanguageColor(language) {
    const colors = {
        'JavaScript': '#f1e05a',
        'Python': '#3572A5',
        'Java': '#b07219',
        'TypeScript': '#2b7489',
        'C#': '#178600',
        'PHP': '#4F5D95',
        'C++': '#f34b7d',
        'C': '#555555',
        'Ruby': '#701516',
        'Go': '#00ADD8',
        'Swift': '#ffac45',
        'Kotlin': '#F18E33',
        'Rust': '#dea584',
        'HTML': '#e34c26',
        'CSS': '#563d7c'
    };
    
    return colors[language] || '#8257e5'; // Default purple color
}

// Global variable to track if an alert is currently showing
let alertIsVisible = false;

// Custom alert/confirmation dialog
function showCustomAlert(message, confirmCallback, cancelCallback) {
    // Prevent multiple alerts
    if (alertIsVisible) return;
    alertIsVisible = true;
    
    // Create the alert elements
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'alert-overlay';
    
    const alertBox = document.createElement('div');
    alertBox.className = 'alert-box';
    
    // Add content to the alert box
    alertBox.innerHTML = `
        <p class="alert-message">${message}</p>
        <div class="alert-buttons">
            <button class="alert-button cancel-button">Cancel</button>
            <button class="alert-button confirm-button">Delete</button>
        </div>
    `;
    
    // Add to DOM
    alertOverlay.appendChild(alertBox);
    document.body.appendChild(alertOverlay);
    
    // Force reflow to enable transitions
    void alertOverlay.offsetWidth;
    
    // Show with animation
    alertOverlay.classList.add('visible');
    
    // Add event listeners for buttons
    const confirmButton = alertBox.querySelector('.confirm-button');
    const cancelButton = alertBox.querySelector('.cancel-button');
    
    confirmButton.addEventListener('click', function() {
        closeCustomAlert();
        if (confirmCallback) confirmCallback();
    });
    
    cancelButton.addEventListener('click', function() {
        closeCustomAlert();
        if (cancelCallback) cancelCallback();
    });
    
    // Also close when clicking the overlay (outside the box)
    alertOverlay.addEventListener('click', function(event) {
        if (event.target === alertOverlay) {
            closeCustomAlert();
            if (cancelCallback) cancelCallback();
        }
    });
}

// Close custom alert
function closeCustomAlert() {
    const alertOverlay = document.querySelector('.alert-overlay');
    if (alertOverlay) {
        alertOverlay.classList.remove('visible');
        
        // Remove from DOM after animation completes
        setTimeout(() => {
            document.body.removeChild(alertOverlay);
            alertIsVisible = false;
        }, 300);
    }
}

// Set a default timeout value (in milliseconds)
const NETWORK_TIMEOUT = 10000; // 10 seconds

// Keep track of loading timeouts
let loadingTimeoutId = null;

// Modified showLoading function with timeout
function showLoading() {
    document.getElementById('loadingIndicator').classList.add('active');
    
    // Clear any existing timeout
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
    }
    
    // Set a new timeout
    loadingTimeoutId = setTimeout(() => {
        hideLoading();
        showConnectionError('Request timed out. Check your connection and try again.');
    }, NETWORK_TIMEOUT);
}

// Modified hideLoading function to clear timeout
function hideLoading() {
    document.getElementById('loadingIndicator').classList.remove('active');
    
    // Clear the timeout if loading completes normally
    if (loadingTimeoutId) {
        clearTimeout(loadingTimeoutId);
        loadingTimeoutId = null;
    }
}

// Function to show connection error message
function showConnectionError(message) {
    const errorBanner = document.getElementById('connectionError');
    
    // Create error banner if it doesn't exist
    if (!errorBanner) {
        const banner = document.createElement('div');
        banner.id = 'connectionError';
        banner.className = 'connection-error';
        document.body.appendChild(banner);
    }
    
    // Update message and show banner
    document.getElementById('connectionError').textContent = message;
    document.getElementById('connectionError').classList.add('active');
    
    // Hide after 5 seconds
    setTimeout(() => {
        if (document.getElementById('connectionError')) {
            document.getElementById('connectionError').classList.remove('active');
        }
    }, 5000);
}

// Check network status on startup and when network status changes
function setupNetworkMonitoring() {
    function updateNetworkStatus() {
        if (!navigator.onLine) {
            showConnectionError('No internet connection');
        }
    }
    
    // Initial check
    updateNetworkStatus();
    
    // Listen for online/offline events
    window.addEventListener('online', function() {
        document.getElementById('connectionError')?.classList.remove('active');
    });
    
    window.addEventListener('offline', function() {
        showConnectionError('No internet connection');
    });
}

// Modify our network operations to handle errors better
function searchGitHubProfile() { 
    const username = document.getElementById('githubSearch').value.trim();
    if (!username) {
        showStatusMessage('Please enter a GitHub username');
        return;
    }
    
    // Check network connection
    if (!navigator.onLine) {
        showConnectionError('No internet connection');
        return;
    }
    
    // Show loading indicator
    showLoading();

    // IMPORTANT: Get a fresh reference to the profile card element each time
    const profileCard = document.getElementById('githubProfileCard');
    
    // Reset any previous animation state - this is critical
    profileCard.style.transition = 'none';
    profileCard.offsetHeight; // Force reflow
    profileCard.style.transition = 'opacity 0.3s ease'; // Re-enable transition
    
    // Start with opacity 0 to ensure smooth fade-in
    profileCard.style.opacity = '0';
    profileCard.classList.remove('hidden');

    fetch(`https://api.github.com/users/${username}`)
        .then(response => {
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('User not found');
                }
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            return verifyImageURL(data.avatar_url)
                .then(verifiedAvatarURL => {
                    // Update UI with data
                    document.getElementById('profileImage').src = verifiedAvatarURL;
                    document.getElementById('profileName').textContent = data.name || data.login;
                    document.getElementById('profileBio').textContent = data.bio || 'No bio available';
                    document.getElementById('profileFollowers').textContent = data.followers;
                    document.getElementById('profileFollowing').textContent = data.following;
                    document.getElementById('profileRepos').textContent = data.public_repos;
                    document.getElementById('profileLocation').textContent = data.location || 'Not specified';
                    document.getElementById('profileWebsite').href = data.blog || '#';
                    document.getElementById('profileWebsite').textContent = data.blog || 'No website';

                    // Use a timeout to ensure the browser has finished updating the DOM
                    // This is critical for consistent transitions
                    setTimeout(() => {
                        profileCard.style.opacity = '1';
                        
                        // Wait for the transition to start before scrolling
                        setTimeout(() => {
                            profileCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 50);
                    }, 20);
                });
        })
        .catch(error => {
            console.error('Error fetching GitHub profile:', error);
            showStatusMessage(error.message || 'Failed to fetch GitHub profile');
            profileCard.classList.add('hidden');
        })
        .finally(() => {
            hideLoading();
        });
}

// Function to show message dialog
function showMessageDialog(profileId, profileName) {
    // Create a messaging dialog
    const messageDialog = document.createElement('div');
    messageDialog.className = 'message-dialog';
    messageDialog.innerHTML = `
        <div class="message-dialog-content">
            <div class="message-dialog-header">
                <h3>Messages for ${profileName}</h3>
                <button class="close-button" onclick="closeMessageDialog()">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="message-list" id="messageList">
                <!-- Messages will be loaded here -->
                <div class="loading-messages">Loading messages...</div>
            </div>
            <div class="message-input-container">
                <textarea id="messageInput" placeholder="Type a message or note..." rows="3"></textarea>
                <button id="sendMessageButton" onclick="sendMessage(${profileId})">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(messageDialog);
    
    // Load messages for this profile
    loadMessages(profileId);
    
    // Listen for Enter key in the textarea
    document.getElementById('messageInput').addEventListener('keydown', function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage(profileId);
        }
    });
    
    // Show dialog with animation
    setTimeout(() => {
        messageDialog.classList.add('active');
        // Focus the input field
        document.getElementById('messageInput').focus();
    }, 10);
}

// Function to close message dialog
function closeMessageDialog() {
    const messageDialog = document.querySelector('.message-dialog');
    if (messageDialog) {
        messageDialog.classList.remove('active');
        setTimeout(() => {
            messageDialog.remove();
        }, 300);
    }
}

// Function to load messages for a profile
function loadMessages(profileId) {
    const messageList = document.getElementById('messageList');
    
    db.transaction((tx) => {
        tx.executeSql(
            'SELECT * FROM profile_messages WHERE profile_id = ? ORDER BY created_at DESC',
            [profileId],
            (tx, results) => {
                // Clear loading indicator
                messageList.innerHTML = '';
                
                if (results.rows.length === 0) {
                    messageList.innerHTML = `
                        <div class="no-messages">
                            <p>No messages yet.</p>
                            <p>Add a note or message about this GitHub profile.</p>
                        </div>
                    `;
                    return;
                }
                
                // Display messages
                for (let i = 0; i < results.rows.length; i++) {
                    const message = results.rows.item(i);
                    const messageElement = createMessageElement(message);
                    messageList.appendChild(messageElement);
                }
            },
            (error) => {
                console.error('Error loading messages:', error);
                messageList.innerHTML = `
                    <div class="error-message">
                        <p>Error loading messages. Please try again.</p>
                    </div>
                `;
            }
        );
    });
}

// Function to create a message element
function createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'message-item';
    
    // Format the date
    const messageDate = new Date(message.created_at);
    const formattedDate = formatMessageDate(messageDate);
    
    messageElement.innerHTML = `
        <div class="message-content">${formatMessageText(message.message)}</div>
        <div class="message-footer">
            <span class="message-time">${formattedDate}</span>
            <button class="delete-message-button" onclick="deleteMessage(${message.id})">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="12" height="12">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
            </button>
        </div>
    `;
    
    return messageElement;
}

// Function to format message text (convert URLs to links, etc.)
function formatMessageText(text) {
    if (!text) return '';
    
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// Function to format message date
function formatMessageDate(date) {
    const now = new Date();
    const diff = now - date;
    
    // If less than a day, show time
    if (diff < 86400000) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If less than a week, show day name
    if (diff < 604800000) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    }
    
    // Otherwise show date
    return date.toLocaleDateString();
}

// Function to send a message
function sendMessage(profileId) {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message) {
        // Animate the input to show it's empty
        messageInput.classList.add('shake');
        setTimeout(() => {
            messageInput.classList.remove('shake');
        }, 500);
        return;
    }
    
    db.transaction((tx) => {
        tx.executeSql(
            'INSERT INTO profile_messages (profile_id, message) VALUES (?, ?)',
            [profileId, message],
            (tx, results) => {
                if (results.rowsAffected > 0) {
                    // Clear the input
                    messageInput.value = '';
                    
                    // Reload messages to show the new one
                    loadMessages(profileId);
                    
                    // Show a brief feedback
                    showStatusMessage('Message saved');
                }
            },
            (error) => {
                console.error('Error saving message:', error);
                showStatusMessage('Error saving message');
            }
        );
    });
}

// Function to delete a message
function deleteMessage(messageId) {
    showCustomAlert('Are you sure you want to delete this message?',
        function() {
            db.transaction((tx) => {
                tx.executeSql(
                    'DELETE FROM profile_messages WHERE id = ?',
                    [messageId],
                    (tx, results) => {
                        if (results.rowsAffected > 0) {
                            // Reload messages to reflect the deletion
                            const messageElement = document.querySelector(`.message-item[data-id="${messageId}"]`);
                            if (messageElement) {
                                // Fade out the message before removing
                                messageElement.style.opacity = '0';
                                setTimeout(() => {
                                    // Find the profile ID from an ancestor element or reload all messages
                                    const messageList = document.getElementById('messageList');
                                    if (messageList) {
                                        messageElement.remove();
                                        
                                        // If no messages left, show the no messages text
                                        if (messageList.children.length === 0) {
                                            messageList.innerHTML = `
                                                <div class="no-messages">
                                                    <p>No messages yet.</p>
                                                    <p>Add a note or message about this GitHub profile.</p>
                                                </div>
                                            `;
                                        }
                                    }
                                }, 300);
                            }
                            
                            showStatusMessage('Message deleted');
                        }
                    },
                    (error) => {
                        console.error('Error deleting message:', error);
                        showStatusMessage('Error deleting message');
                    }
                );
            });
        }
    );
}

function addMessageStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        /* Message Dialog */
        .message-dialog {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s ease, visibility 0.3s ease;
        }
        
        .message-dialog.active {
            opacity: 1;
            visibility: visible;
        }
        
        .message-dialog-content {
            width: 90%;
            max-width: 500px;
            height: 80%;
            max-height: 600px;
            background-color: var(--bg-color);
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            transform: translateY(20px);
            transition: transform 0.3s ease;
        }
        
        .message-dialog.active .message-dialog-content {
            transform: translateY(0);
        }
        
        .message-dialog-header {
            padding: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-color);
        }
        
        .message-dialog-header h3 {
            margin: 0;
            font-size: 18px;
            color: var(--text-color);
        }
        
        .message-list {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
        }
        
        .loading-messages {
            text-align: center;
            padding: 20px;
            color: var(--gray);
        }
        
        .no-messages {
            text-align: center;
            padding: 20px;
            color: var(--gray);
        }
        
        .error-message {
            text-align: center;
            padding: 20px;
            color: var(--error-color);
        }
        
        .message-item {
            margin-bottom: 16px;
            padding: 12px;
            background-color: var(--card-bg);
            border-radius: 8px;
            transition: opacity 0.3s ease;
        }
        
        .message-content {
            margin-bottom: 8px;
            line-height: 1.5;
            word-break: break-word;
        }
        
        .message-content a {
            color: var(--primary-color);
            text-decoration: none;
        }
        
        .message-content a:hover {
            text-decoration: underline;
        }
        
        .message-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: var(--gray);
        }
        
        .delete-message-button {
            background: none;
            border: none;
            color: var(--gray);
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: background-color 0.2s ease;
        }
        
        .delete-message-button:hover {
            background-color: rgba(255, 0, 0, 0.1);
            color: var(--error-color);
        }
        
        .message-input-container {
            padding: 16px;
            border-top: 1px solid var(--border-color);
            display: flex;
            gap: 8px;
        }
        
        #messageInput {
            flex: 1;
            padding: 12px;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            resize: none;
            font-family: inherit;
            font-size: 14px;
            background-color: var(--input-bg);
            color: var(--text-color);
            transition: border-color 0.2s ease;
        }
        
        #messageInput:focus {
            outline: none;
            border-color: var(--primary-color);
        }
        
        #messageInput.shake {
            animation: shake 0.5s;
        }
        
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        #sendMessageButton {
            width: 40px;
            height: 40px;
            border-radius: 20px;
            background-color: var(--primary-color);
            color: white;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s ease, transform 0.2s ease;
        }
        
        #sendMessageButton:hover {
            background-color: var(--primary-hover);
        }
        
        #sendMessageButton:active {
            transform: scale(0.95);
        }
        
        /* Message button for saved cards */
        .message-button {
            background-color: var(--card-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: background-color 0.2s ease;
        }
        
        .message-button:hover {
            background-color: var(--hover-color);
        }
        
        /* For dark/light mode compatibility */
        @media (prefers-color-scheme: dark) {
            .message-dialog-content {
                background-color: #1e1e1e;
            }
            
            .message-item {
                background-color: #262626;
            }
            
            #messageInput {
                background-color: #262626;
                color: #ffffff;
            }
        }
    `;
    
    document.head.appendChild(styleElement);
}

