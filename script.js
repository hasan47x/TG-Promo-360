(async function () {
    let config = {};
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error(`Failed to load config.json: ${response.statusText}`);
        }
        config = await response.json();
    } catch (e) {
        alert(`Critical Error: Could not load configuration. ${e.message}`);
        return;
    }

    const APPS_SCRIPT_WEB_APP_URL = config.APPS_SCRIPT_WEB_APP_URL;
    const ADMIN_EMAIL_CONFIG = config.ADMIN_CREDENTIALS.email;
    const ADMIN_PASSWORD_CONFIG = config.ADMIN_CREDENTIALS.password;

    // =======================================================
    // ===                  DOM ELEMENTS                     ===
    // =======================================================
    const getEl = (id) => document.getElementById(id);
    const elements = {
        // Loaders & Containers
        loader: getEl('adminLoader'),
        authContainer: getEl('authContainer'),
        loginSection: getEl('adminLoginSection'),
        mainArea: getEl('adminMainArea'),
        
        // Auth
        loginForm: getEl('adminLoginForm'),
        adminEmailInput: getEl('adminEmail'),
        adminPasswordInput: getEl('adminPassword'),
        loginStatus: getEl('adminLoginStatus'),
        logoutBtn: getEl('adminLogoutBtn'),
        adminUserEmail: getEl('adminUserEmail'),

        // Navigation
        sidebarLinks: document.querySelectorAll('#adminSidebar .nav-link'),
        pageTitle: getEl('adminPageTitle'),
        sections: document.querySelectorAll('#adminMainContent .section'),

        // Dashboard Stats
        statTotalUsers: getEl('statTotalUsers'),
        statTotalPosts: getEl('statTotalPosts'),
        statPendingPosts: getEl('statPendingPosts'),
        statPendingPayments: getEl('statPendingPayments'),
        pendingPostsCountBadge: getEl('pendingPostsCountBadge'),
        pendingPaymentsCountBadge: getEl('pendingPaymentsCountBadge'),

        // Post Management
        pendingPostsTableBody: getEl('pendingPostsTableBody'),
        postContentModalBody: getEl('postContentModalBody'),
        scheduledPostsTableBody: getEl('scheduledPostsTableBody'), // New element for scheduled posts
        
        // User Management
        usersTableBody: getEl('usersTableBody'),
        userSearchInput: getEl('userSearchInput'),
        userModalTitle: getEl('userModalTitle'),
        userDetailId: getEl('userDetailId'),
        userDetailName: getEl('userDetailName'),
        userDetailPoints: getEl('userDetailPoints'),
        updatePointsForm: getEl('updatePointsForm'),
        pointsUpdateAmount: getEl('pointsUpdateAmount'),
        pointsUpdateReason: getEl('pointsUpdateReason'),
        userPremiumStatus: getEl('userPremiumStatus'), // New element for premium status
        togglePremiumBtn: getEl('togglePremiumBtn'), // New element for premium toggle
        banUserBtn: getEl('banUserBtn'), // New element for ban user
        warnUserBtn: getEl('warnUserBtn'), // New element for warn user

        // Tags & Channels
        tagsList: getEl('tagsList'),
        addTagForm: getEl('addTagForm'),
        tagNameInput: getEl('tagName'),
        saveTagBtn: getEl('saveTagBtn'),
        linkChannelForm: getEl('linkChannelForm'),
        selectTag: getEl('selectTag'),
        channelUsernameInput: getEl('channelUsername'),
        linkedChannelsContainer: getEl('linkedChannelsContainer'),

        // Payments
        paymentRequestsTableBody: getEl('paymentRequestsTableBody'),

        // Settings
        settingsForm: getEl('settingsForm'),
        settingJoinBonus: getEl('settingJoinBonus'),
        settingDailyBonus: getEl('settingDailyBonus'),
        settingReferralBonus: getEl('settingReferralBonus'),
        settingPostCost: getEl('settingPostCost'),
        settingPaymentNumber: getEl('settingPaymentNumber'),
        toggleCoinPurchaseSwitch: getEl('toggleCoinPurchaseSwitch'), // New element
        toggleNewRegistrationSwitch: getEl('toggleNewRegistrationSwitch'), // New element

        // Bot Statistics
        statTotalUsers: getEl('statTotalUsers'), // Already exists, but ensure it's used for stats
        statTotalPosts: getEl('statTotalPosts'), // Already exists
        statTotalRevenue: getEl('statTotalRevenue'), // New element
    };

    // Bootstrap Instances Cache
    let componentInstances = {};
    const getModalInstance = (element) => {
        if (!element) return null;
        if (!componentInstances[element.id]) {
            componentInstances[element.id] = new bootstrap.Modal(element);
        }
        return componentInstances[element.id];
    };

    // =======================================================
    // ===                 APP STATE & LOGIC               ===
    // =======================================================
    let currentAdminUser = null; // This will be a simple flag or user object from backend
    let currentEditingUserId = null;

    // --- Main Auth Flow ---
    // Simplified auth flow for Apps Script backend. Real auth would involve tokens.
    async function checkAdminSession() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'checkAdminSession',
                    data: { /* potentially a session token from localStorage */ }
                })
            });
            const result = await response.json();
            if (result.success && result.data.isAdmin) {
                currentAdminUser = { email: result.data.email }; // Or a more detailed admin object
                elements.adminUserEmail.textContent = currentAdminUser.email;
                elements.authContainer.style.display = 'none';
                elements.mainArea.style.display = 'block';
                navigateToSection('dashboard-section');
                // No real-time listeners with Apps Script, data will be loaded on section navigation
            } else {
                currentAdminUser = null;
                elements.mainArea.style.display = 'none';
                elements.authContainer.style.display = 'block';
                elements.loginSection.style.display = 'block';
            }
        } catch (error) {
            console.error("Error checking admin session:", error);
            elements.mainArea.style.display = 'none';
            elements.authContainer.style.display = 'block';
            elements.loginSection.style.display = 'block';
        } finally {
            showLoader(false);
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        showLoader(true);
        const email = elements.adminEmailInput.value;
        const password = elements.adminPasswordInput.value;
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'adminLogin',
                    data: { email, password }
                })
            });
            const result = await response.json();
            if (result.success) {
                currentAdminUser = { email: email }; // Store basic admin info
                elements.adminUserEmail.textContent = email;
                elements.authContainer.style.display = 'none';
                elements.mainArea.style.display = 'block';
                navigateToSection('dashboard-section');
                // Optionally save a session token to localStorage here
            } else {
                elements.loginStatus.textContent = `Login Failed: ${result.error}`;
                elements.loginStatus.className = 'alert alert-danger';
                elements.loginStatus.style.display = 'block';
            }
        } catch (error) {
            elements.loginStatus.textContent = `Network error: ${error.message}`;
            elements.loginStatus.className = 'alert alert-danger';
            elements.loginStatus.style.display = 'block';
        } finally {
            showLoader(false);
        }
    }

    async function handleLogout() {
        // In a real app, you'd send a logout command to the backend to invalidate session
        // For now, just clear local state
        currentAdminUser = null;
        elements.mainArea.style.display = 'none';
        elements.authContainer.style.display = 'block';
        elements.loginSection.style.display = 'block';
        elements.adminEmailInput.value = '';
        elements.adminPasswordInput.value = '';
        elements.loginStatus.style.display = 'none';
    }

    // --- Navigation ---
    function navigateToSection(sectionId) {
        elements.sections.forEach(sec => sec.classList.remove('active'));
        getEl(sectionId)?.classList.add('active');

        elements.sidebarLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.section === sectionId);
        });
        
        const activeLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
        elements.pageTitle.textContent = activeLink ? activeLink.textContent.trim() : 'Dashboard';

        // Load data for the activated section
        loadDataForSection(sectionId);
        const offcanvas = bootstrap.Offcanvas.getInstance(getEl('adminSidebar'));
        if(offcanvas) offcanvas.hide();
    }

    // --- Data Loading ---
    function loadDataForSection(sectionId) {
        switch(sectionId) {
            case 'dashboard-section':
                loadDashboardStats();
                loadBotStatistics(); // Load bot statistics on dashboard
                break;
            case 'posts-section':
                loadPendingPosts();
                loadScheduledPosts(); // Load scheduled posts
                break;
            case 'users-section':
                loadUsers();
                break;
            case 'tags-channels-section':
                loadTags();
                loadLinkedChannels();
                break;
            case 'payments-section':
                loadPaymentRequests();
                break;
            case 'settings-section':
                loadSettings();
                break;
        }
    }

    // Dashboard
    async function loadDashboardStats() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getDashboardStats', data: {} })
            });
            const result = await response.json();
            if (result.success) {
                const stats = result.data;
                elements.statTotalUsers.textContent = stats.totalUsers || 0;
                elements.statTotalPosts.textContent = stats.totalPosts || 0;
                elements.statPendingPosts.textContent = stats.pendingPosts || 0;
                elements.pendingPostsCountBadge.textContent = stats.pendingPosts || 0;
                elements.pendingPostsCountBadge.style.display = (stats.pendingPosts || 0) > 0 ? 'inline-block' : 'none';
                elements.statPendingPayments.textContent = stats.pendingPayments || 0;
                elements.pendingPaymentsCountBadge.textContent = stats.pendingPayments || 0;
                elements.pendingPaymentsCountBadge.style.display = (stats.pendingPayments || 0) > 0 ? 'inline-block' : 'none';
            } else {
                alert(`Error loading dashboard stats: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error loading dashboard stats: ${error.message}`);
        } finally {
            showLoader(false);
        }
    }

    // Post Management
    async function loadPendingPosts() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getPendingPosts', data: {} })
            });
            const result = await response.json();
            const tableBody = elements.pendingPostsTableBody;
            tableBody.innerHTML = '';
            if (result.success) {
                const posts = result.data.posts || [];
                if (posts.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">No pending posts.</td></tr>`;
                    return;
                }
                posts.forEach(post => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${post.userName || 'Unknown'} <small class="d-block text-secondary">${post.userId}</small></td>
                        <td class="post-content-preview">${post.content}</td>
                        <td>${post.tags.map(tag => `<span class="badge bg-secondary">#${tag}</span>`).join(' ')}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="window.viewPostContent('${post.id}')"><i class="bi bi-eye"></i></button>
                            <button class="btn btn-sm btn-success" onclick="window.updatePostStatus('${post.id}', 'approved')"><i class="bi bi-check-lg"></i></button>
                            <button class="btn btn-sm btn-danger" onclick="window.updatePostStatus('${post.id}', 'rejected')"><i class="bi bi-x-lg"></i></button>
                        </td>
                    `;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${result.error}</td></tr>`;
            }
        } catch (error) {
            elements.pendingPostsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Network error: ${error.message}</td></tr>`;
        } finally {
            showLoader(false);
        }
    }

    async function loadScheduledPosts() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getScheduledPosts', data: {} })
            });
            const result = await response.json();
            const tableBody = elements.scheduledPostsTableBody;
            tableBody.innerHTML = '';
            if (result.success) {
                const posts = result.data.posts || [];
                if (posts.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">No scheduled posts.</td></tr>`;
                    return;
                }
                posts.forEach(post => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${post.userName || 'Unknown'} <small class="d-block text-secondary">${post.userId}</small></td>
                        <td class="post-content-preview">${post.content}</td>
                        <td>${new Date(post.scheduleTime).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-info" onclick="window.viewPostContent('${post.id}')"><i class="bi bi-eye"></i></button>
                            <button class="btn btn-sm btn-warning" onclick="window.updatePostStatus('${post.id}', 'pending')">Unschedule</button>
                        </td>
                    `;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Error: ${result.error}</td></tr>`;
            }
        } catch (error) {
            elements.scheduledPostsTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Network error: ${error.message}</td></tr>`;
        } finally {
            showLoader(false);
        }
    }

    // User Management
    async function loadUsers() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getUsers', data: { searchTerm: elements.userSearchInput.value } })
            });
            const result = await response.json();
            const tableBody = elements.usersTableBody;
            tableBody.innerHTML = '';
            if (result.success) {
                const users = result.data.users || [];
                if (users.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No users found.</td></tr>`;
                    return;
                }
                users.forEach(user => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${user.id}</td>
                        <td>${user.name || 'N/A'}</td>
                        <td>${user.points || 0}</td>
                        <td>${new Date(user.joinDate).toLocaleDateString()}</td>
                        <td><button class="btn btn-sm btn-primary" onclick="window.openUserModal('${user.id}')">Details</button></td>
                    `;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${result.error}</td></tr>`;
            }
        } catch (error) {
            elements.usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Network error: ${error.message}</td></tr>`;
        } finally {
            showLoader(false);
        }
    }

    // Tags & Channels
    async function loadTags() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getTags', data: {} })
            });
            const result = await response.json();
            elements.tagsList.innerHTML = '';
            elements.selectTag.innerHTML = '<option value="">Select a tag</option>';
            if (result.success) {
                const tags = result.data.tags || [];
                if (tags.length === 0) {
                    elements.tagsList.innerHTML = '<li class="list-group-item text-secondary">No tags created.</li>';
                    return;
                }
                tags.forEach(tagName => {
                    const li = document.createElement('li');
                    li.className = 'list-group-item d-flex justify-content-between align-items-center';
                    li.innerHTML = `<span>#${tagName}</span><button class="btn btn-sm btn-outline-danger" onclick="window.deleteTag('${tagName}')"><i class="bi bi-trash"></i></button>`;
                    elements.tagsList.appendChild(li);
                    elements.selectTag.innerHTML += `<option value="${tagName}">${tagName}</option>`;
                });
            } else {
                elements.tagsList.innerHTML = `<li class="list-group-item text-danger">Error: ${result.error}</li>`;
            }
        } catch (error) {
            elements.tagsList.innerHTML = `<li class="list-group-item text-danger">Network error: ${error.message}</li>`;
        } finally {
            showLoader(false);
        }
    }

    async function loadLinkedChannels() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getLinkedChannels', data: {} })
            });
            const result = await response.json();
            elements.linkedChannelsContainer.innerHTML = '';
            if (result.success) {
                const linkedChannels = result.data.linkedChannels || {};
                if (Object.keys(linkedChannels).length === 0) return;
                Object.entries(linkedChannels).forEach(([tagName, channels]) => {
                    let channelHtml = `<h6>#${tagName}</h6>`;
                    Object.entries(channels).forEach(([channelKey, channelUsername]) => {
                        channelHtml += `<div class="d-flex justify-content-between align-items-center mb-1">
                            <span class="badge bg-info">${channelUsername}</span>
                            <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="window.unlinkChannel('${tagName}', '${channelKey}')">×</button>
                        </div>`;
                    });
                    elements.linkedChannelsContainer.innerHTML += channelHtml;
                });
            } else {
                elements.linkedChannelsContainer.innerHTML = `<div class="alert alert-danger text-center m-3">Error: ${result.error}</div>`;
            }
        } catch (error) {
            elements.linkedChannelsContainer.innerHTML = `<div class="alert alert-danger text-center m-3">Network error: ${error.message}</div>`;
        } finally {
            showLoader(false);
        }
    }

    // Payments
    async function loadPaymentRequests() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getPaymentRequests', data: {} })
            });
            const result = await response.json();
            const tableBody = elements.paymentRequestsTableBody;
            tableBody.innerHTML = '';
            if (result.success) {
                const requests = result.data.requests || [];
                if (requests.length === 0) {
                    tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No pending payment requests.</td></tr>`;
                    return;
                }
                requests.forEach(req => {
                    const row = tableBody.insertRow();
                    row.innerHTML = `
                        <td>${req.userName || 'N/A'} <small class="d-block text-secondary">${req.userId}</small></td>
                        <td>${req.amount} BDT</td>
                        <td>${req.trxId}</td>
                        <td>${new Date(req.timestamp).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-sm btn-success" onclick="window.handlePaymentRequest('${req.id}', 'approved', '${req.userId}', ${req.amount})">Approve</button>
                            <button class="btn btn-sm btn-danger" onclick="window.handlePaymentRequest('${req.id}', 'rejected')">Reject</button>
                        </td>
                    `;
                });
            } else {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${result.error}</td></tr>`;
            }
        } catch (error) {
            elements.paymentRequestsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Network error: ${error.message}</td></tr>`;
        } finally {
            showLoader(false);
        }
    }

    // Settings
    async function loadSettings() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getSettings', data: {} })
            });
            const result = await response.json();
            if (result.success) {
                const settings = result.data.settings || {};
                Object.keys(elements).forEach(key => {
                    if (key.startsWith('setting')) {
                        const settingKey = key.replace('setting', '').charAt(0).toLowerCase() + key.slice(8);
                        if (elements[key] && settings[settingKey] !== undefined) {
                            elements[key].value = settings[settingKey];
                        }
                    }
                });
                elements.toggleCoinPurchaseSwitch.checked = settings.coinPurchaseEnabled || false;
                elements.toggleNewRegistrationSwitch.checked = settings.newRegistrationEnabled || false;
            } else {
                alert(`Error loading settings: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error loading settings: ${error.message}`);
        } finally {
            showLoader(false);
        }
    }

    // Bot Statistics
    async function loadBotStatistics() {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'getBotStatistics', data: {} })
            });
            const result = await response.json();
            if (result.success) {
                const stats = result.data;
                elements.statTotalUsers.textContent = stats.totalUsers || 0;
                elements.statTotalPosts.textContent = stats.totalPosts || 0;
                elements.statTotalRevenue.textContent = stats.totalRevenue || 0; // Assuming revenue stat
            } else {
                alert(`Error loading bot statistics: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error loading bot statistics: ${error.message}`);
        } finally {
            showLoader(false);
        }
    }

    // =======================================================
    // ===               ACTION FUNCTIONS                  ===
    // =======================================================
    // These functions are called from inline onclick attributes for simplicity
    window.updatePostStatus = async (postId, status) => {
        if (!confirm(`Are you sure you want to ${status} this post?`)) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'updatePostStatus',
                    data: { postId, status }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert(`Post has been ${status}.`);
                loadPendingPosts(); // Refresh list
                loadScheduledPosts(); // Refresh scheduled list
                loadDashboardStats(); // Refresh dashboard stats
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.viewPostContent = async (postId) => {
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'getPostContent',
                    data: { postId }
                })
            });
            const result = await response.json();
            if (result.success) {
                elements.postContentModalBody.textContent = result.data.content;
                getModalInstance(getEl('postContentModal')).show();
            } else {
                alert(`Could not retrieve post content: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error retrieving post content: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.openUserModal = async (userId) => {
        currentEditingUserId = userId;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'getUserProfile',
                    data: { userId }
                })
            });
            const result = await response.json();
            if (result.success) {
                const user = result.data.user;
                elements.userModalTitle.textContent = `Details for ${user.name}`;
                elements.userDetailId.textContent = userId;
                elements.userDetailName.textContent = user.name;
                elements.userDetailPoints.textContent = user.points || 0;
                elements.userPremiumStatus.textContent = user.isPremium ? 'Premium' : 'Standard';
                elements.togglePremiumBtn.textContent = user.isPremium ? 'Remove Premium' : 'Grant Premium';
                getModalInstance(getEl('userModal')).show();
            } else {
                alert(`Could not retrieve user details: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error retrieving user details: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.updateUserPoints = async (e) => {
        e.preventDefault();
        const amount = parseInt(elements.pointsUpdateAmount.value);
        const reason = elements.pointsUpdateReason.value.trim();
        if (isNaN(amount) || !reason) {
            alert('Please provide a valid amount and a reason.');
            return;
        }
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'updateUserPoints',
                    data: { userId: currentEditingUserId, amount, reason }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Points updated successfully!');
                getModalInstance(getEl('userModal')).hide();
                loadUsers(); // Refresh user list
            } else {
                alert(`Error updating points: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error updating points: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.banUser = async (userId) => {
        if (!confirm('Are you sure you want to BAN this user?')) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'banUser',
                    data: { userId }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('User banned successfully!');
                loadUsers(); // Refresh user list
            } else {
                alert(`Error banning user: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error banning user: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.warnUser = async (userId) => {
        const message = prompt("Enter warning message for the user:");
        if (!message) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'warnUser',
                    data: { userId, message }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('User warned successfully!');
            } else {
                alert(`Error warning user: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error warning user: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.togglePremiumStatus = async (userId, currentStatus) => {
        const newStatus = !currentStatus;
        if (!confirm(`Are you sure you want to ${newStatus ? 'grant' : 'remove'} premium status for this user?`)) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'setPremiumStatus',
                    data: { userId, isPremium: newStatus }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert(`Premium status ${newStatus ? 'granted' : 'removed'} successfully!`);
                openUserModal(userId); // Refresh modal content
                loadUsers(); // Refresh user list
            } else {
                alert(`Error updating premium status: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error updating premium status: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.saveTag = async () => {
        const tagName = elements.tagNameInput.value.trim();
        if (!tagName) { alert('Tag name cannot be empty.'); return; }
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'addTag',
                    data: { tagName }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Tag added!');
                getModalInstance(getEl('tagModal')).hide();
                elements.addTagForm.reset();
                loadTags(); // Refresh tags list
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.deleteTag = async (tagName) => {
        if (!confirm(`Are you sure you want to delete the tag #${tagName}? This will not remove it from existing posts.`)) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'deleteTag',
                    data: { tagName }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Tag deleted!');
                loadTags(); // Refresh tags list
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.linkChannel = async (e) => {
        e.preventDefault();
        const tagName = elements.selectTag.value;
        const channelUsername = elements.channelUsernameInput.value.trim();
        if (!tagName || !channelUsername.startsWith('@')) {
            alert('Please select a tag and provide a valid channel username (starting with @).');
            return;
        }
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'linkChannel',
                    data: { tagName, channelUsername }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Channel linked successfully!');
                elements.linkChannelForm.reset();
                loadLinkedChannels(); // Refresh linked channels list
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.unlinkChannel = async (tagName, channelKey) => {
        if (!confirm('Are you sure you want to unlink this channel?')) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'unlinkChannel',
                    data: { tagName, channelKey }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Channel unlinked successfully!');
                loadLinkedChannels(); // Refresh linked channels list
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.handlePaymentRequest = async (reqId, status, userId, amount) => {
        if (!confirm(`Are you sure you want to ${status} this payment request?`)) return;
        showLoader(true);
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'handlePaymentRequest',
                    data: { reqId, status, userId, amount }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert(`Payment request ${status}.`);
                loadPaymentRequests(); // Refresh list
                loadDashboardStats(); // Refresh dashboard stats
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    window.saveSettings = async (e) => {
        e.preventDefault();
        showLoader(true);
        const settings = {
            joinBonus: parseInt(elements.settingJoinBonus.value),
            dailyBonus: parseInt(elements.settingDailyBonus.value),
            referralBonus: parseInt(elements.settingReferralBonus.value),
            postCost: parseInt(elements.settingPostCost.value),
            paymentNumber: elements.settingPaymentNumber.value.trim(),
            coinPurchaseEnabled: elements.toggleCoinPurchaseSwitch.checked,
            newRegistrationEnabled: elements.toggleNewRegistrationSwitch.checked,
        };
        try {
            const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: 'saveSettings',
                    data: { settings }
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Settings saved successfully!');
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Network error: ${error.message}`);
        } finally {
            showLoader(false);
        }
    };

    // =======================================================
    // ===               EVENT LISTENERS SETUP             ===
    // =======================================================
    function setupEventListeners() {
        elements.loginForm.addEventListener('submit', handleLogin);
        elements.logoutBtn.addEventListener('click', handleLogout);
        elements.sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navigateToSection(link.dataset.section);
            });
        });
        elements.updatePointsForm.addEventListener('submit', window.updateUserPoints);
        elements.saveTagBtn.addEventListener('click', window.saveTag);
        elements.linkChannelForm.addEventListener('submit', window.linkChannel);
        elements.settingsForm.addEventListener('submit', window.saveSettings);
        elements.userSearchInput.addEventListener('input', (e) => {
            // Debounce this input for better performance on large user lists
            clearTimeout(elements.userSearchInput.debounceTimer);
            elements.userSearchInput.debounceTimer = setTimeout(() => {
                loadUsers(); // Reload users with search term
            }, 300);
        });
        // New event listeners for user management actions
        elements.togglePremiumBtn.addEventListener('click', () => window.togglePremiumStatus(currentEditingUserId, elements.userPremiumStatus.textContent === 'Premium'));
        elements.banUserBtn.addEventListener('click', () => window.banUser(currentEditingUserId));
        elements.warnUserBtn.addEventListener('click', () => window.warnUser(currentEditingUserId));
    }
    setupEventListeners();

    // Utility to show loader
    const showLoader = (show) => { elements.loader.style.display = show ? 'flex' : 'none'; };

    // Initial check for admin session
    checkAdminSession();
})();