// Simplified GitHub profile integration
document.addEventListener("DOMContentLoaded", function() {
    const githubLoginButton = document.getElementById("githubLoginButton");
    const githubProfileCard = document.getElementById("githubProfileCard");
    const profileImage = document.getElementById("profileImage");
    const profileName = document.getElementById("profileName");
    const profileBio = document.getElementById("profileBio");
    const profileFollowers = document.getElementById("profileFollowers");
    const profileFollowing = document.getElementById("profileFollowing");
    const profileRepos = document.getElementById("profileRepos");
    const profileLocation = document.getElementById("profileLocation");
    const profileWebsite = document.getElementById("profileWebsite");
    
    // Check if user already set their profile
    const savedUsername = localStorage.getItem("github_username");
    if (savedUsername) {
        fetchGitHubProfile(savedUsername);
    }
    
    // Modified GitHub login button to prompt for username
    githubLoginButton.addEventListener("click", function() {
        // Create a simple modal to ask for GitHub username
        const modal = document.createElement("div");
        modal.className = "github-username-modal";
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Enter your GitHub username</h3>
                <input type="text" id="githubUsernameInput" placeholder="e.g., octocat" autocomplete="off">
                <div class="modal-buttons">
                    <button id="cancelUsernameButton">Cancel</button>
                    <button id="submitUsernameButton">Submit</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        document.getElementById("githubUsernameInput").focus();
        
        // Handle modal buttons
        document.getElementById("cancelUsernameButton").addEventListener("click", function() {
            modal.remove();
        });
        
        document.getElementById("submitUsernameButton").addEventListener("click", function() {
            const username = document.getElementById("githubUsernameInput").value.trim();
            if (username) {
                fetchGitHubProfile(username);
                modal.remove();
            }
        });
        
        // Also allow pressing Enter to submit
        document.getElementById("githubUsernameInput").addEventListener("keypress", function(e) {
            if (e.key === "Enter") {
                const username = this.value.trim();
                if (username) {
                    fetchGitHubProfile(username);
                    modal.remove();
                }
            }
        });
    });
    
    // Function to fetch GitHub profile without authentication
    function fetchGitHubProfile(username) {
        showLoadingIndicator();
        
        fetch(`https://api.github.com/users/${encodeURIComponent(username)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`GitHub API error: ${response.status}`);
                }
                return response.json();
            })
            .then(user => {
                // Save username to localStorage
                localStorage.setItem("github_username", username);
                
                // Update UI with user data
                updateUIWithUserData(user);
                
                // Hide login button
                githubLoginButton.classList.add("hidden");
                
                // Show success message
                showStatusMessage(`Profile loaded: ${user.login}`, "success");
                hideLoadingIndicator();
            })
            .catch(error => {
                console.error("Error fetching GitHub profile:", error);
                showStatusMessage("Could not load GitHub profile", "error");
                hideLoadingIndicator();
            });
    }
    
    // Update UI with GitHub profile data
    function updateUIWithUserData(user) {
        // Show profile card
        githubProfileCard.classList.remove("hidden");
        
        // Update profile information
        profileImage.src = user.avatar_url || "/api/placeholder/100/100";
        profileName.textContent = user.name || user.login;
        profileBio.textContent = user.bio || "No bio available";
        profileFollowers.textContent = user.followers || 0;
        profileFollowing.textContent = user.following || 0;
        profileRepos.textContent = user.public_repos || 0;
        profileLocation.textContent = user.location || "Not specified";
        
        if (user.blog) {
            profileWebsite.href = user.blog.startsWith("http") ? user.blog : `https://${user.blog}`;
            profileWebsite.textContent = user.blog;
        } else {
            profileWebsite.href = "#";
            profileWebsite.textContent = "No website";
        }
        
        // Add user info to header
        addUserToHeader(user);
    }
    
    // Add user info to header
    function addUserToHeader(user) {
        const headerUserInfo = document.createElement("div");
        headerUserInfo.className = "header-user-info";
        headerUserInfo.innerHTML = `
            <img src="${user.avatar_url}" alt="${user.login}" class="header-avatar">
            <span class="header-username">${user.login}</span>
            <button id="changeProfileButton" class="change-profile-button" title="Change profile">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
            </button>
        `;
        
        // Remove existing user info if present
        const existingUserInfo = document.querySelector(".header-user-info");
        if (existingUserInfo) {
            existingUserInfo.remove();
        }
        
        // Add to header
        const header = document.querySelector(".header");
        header.appendChild(headerUserInfo);
        
        // Add change profile functionality
        document.getElementById("changeProfileButton").addEventListener("click", function() {
            // Reset to initial state
            localStorage.removeItem("github_username");
            githubLoginButton.classList.remove("hidden");
            githubProfileCard.classList.add("hidden");
            headerUserInfo.remove();
            showStatusMessage("Profile removed", "info");
        });
    }
    
    // Show loading indicator
    function showLoadingIndicator() {
        document.getElementById("loadingIndicator").classList.add("visible");
    }
    
    // Hide loading indicator
    function hideLoadingIndicator() {
        document.getElementById("loadingIndicator").classList.remove("visible");
    }
    
    // Show status message
    function showStatusMessage(message, type = "info") {
        const statusMessage = document.getElementById("statusMessage");
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        statusMessage.classList.add("visible");
        
        setTimeout(() => {
            statusMessage.classList.remove("visible");
        }, 3000);
    }
});