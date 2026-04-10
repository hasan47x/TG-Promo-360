// =======================================================
// ===           MODULE IMPORTS & SETUP              ===
// =======================================================

// index.html থেকে এক্সপোর্ট করা auth এবং db ইম্পোর্ট করুন
import { auth, db } from './index.html';

// Firebase Auth এবং Database থেকে প্রয়োজনীয় ফাংশন ইম্পোর্ট করুন
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { 
    ref, 
    onValue, 
    get, 
    set, 
    update, 
    remove, 
    push 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =======================================================
// ===           DOM ELEMENT SELECTION               ===
// =======================================================

// Global & Auth
const adminLoader = document.getElementById('adminLoader');
const authContainer = document.getElementById('authContainer');
const adminMainArea = document.getElementById('adminMainArea');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminEmailInput = document.getElementById('adminEmail');
const adminPasswordInput = document.getElementById('adminPassword');
const adminLoginStatus = document.getElementById('adminLoginStatus');

// Header & Sidebar
const adminUserEmail = document.getElementById('adminUserEmail');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
const adminSidebar = document.getElementById('adminSidebar');
const adminPageTitle = document.getElementById('adminPageTitle');
const pendingPostsCountBadge = document.getElementById('pendingPostsCountBadge');
const pendingPaymentsCountBadge = document.getElementById('pendingPaymentsCountBadge');

// Sections
const adminSections = document.querySelectorAll('.admin-section');
const adminMainContent = document.getElementById('adminMainContent');

// Dashboard Stats
const statTotalUsers = document.getElementById('statTotalUsers');
const statTotalPosts = document.getElementById('statTotalPosts');
const statPendingPosts = document.getElementById('statPendingPosts');
const statPendingPayments = document.getElementById('statPendingPayments');

// Tables
const pendingPostsTableBody = document.getElementById('pendingPostsTableBody');
const usersTableBody = document.getElementById('usersTableBody');
const paymentRequestsTableBody = document.getElementById('paymentRequestsTableBody');

// Tags & Channels
const tagsList = document.getElementById('tagsList');
const addTagForm = document.getElementById('addTagForm');
const saveTagBtn = document.getElementById('saveTagBtn');
const linkChannelForm = document.getElementById('linkChannelForm');
const selectTagForChannel = document.getElementById('selectTag');
const linkedChannelsContainer = document.getElementById('linkedChannelsContainer');

// Settings
const settingsForm = document.getElementById('settingsForm');

// Modals
const userModal = new bootstrap.Modal(document.getElementById('userModal'));
const postContentModal = new bootstrap.Modal(document.getElementById('postContentModal'));
const rejectPostModal = new bootstrap.Modal(document.getElementById('rejectPostModal'));
const tagModal = new bootstrap.Modal(document.getElementById('tagModal'));

// State to hold temporary data
let state = {
    selectedUserId: null,
    selectedPostId: null,
    allUsers: {},
};


// =======================================================
// ===           HELPER & UI FUNCTIONS               ===
// =======================================================

const toggleLoader = (show) => {
    adminLoader.style.display = show ? 'flex' : 'none';
};

const showAlert = (element, message, type = 'danger') => {
    element.innerHTML = message;
    element.className = `alert alert-${type}`;
    element.style.display = 'block';
    setTimeout(() => { element.style.display = 'none'; }, 5000);
};

const showSection = (sectionId) => {
    adminSections.forEach(section => {
        section.classList.remove('active');
    });
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
        const navLink = document.querySelector(`.nav-link[data-section="${sectionId}"]`);
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        if (navLink) {
            navLink.classList.add('active');
            adminPageTitle.textContent = navLink.textContent.replace(/<span.*<\/span>/, '').trim();
        }
    }
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

// =======================================================
// ===           AUTHENTICATION LOGIC                ===
// =======================================================

const checkIfAdmin = async (uid) => {
    try {
        const userRef = ref(db, `users/${uid}/isAdmin`);
        const snapshot = await get(userRef);
        return snapshot.exists() && snapshot.val() === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
};

onAuthStateChanged(auth, async (user) => {
    toggleLoader(true);
    if (user) {
        const isAdmin = await checkIfAdmin(user.uid);
        if (isAdmin) {
            adminUserEmail.textContent = user.email;
            authContainer.style.display = 'none';
            adminMainArea.style.display = 'block';
            loadAllAdminData();
        } else {
            showAlert(adminLoginStatus, 'You do not have permission to access this panel.', 'danger');
            await signOut(auth);
            authContainer.style.display = 'flex';
            adminMainArea.style.display = 'none';
        }
    } else {
        authContainer.style.display = 'flex';
        adminMainArea.style.display = 'none';
    }
    toggleLoader(false);
});

const handleLogin = async (e) => {
    e.preventDefault();
    toggleLoader(true);
    const email = adminEmailInput.value;
    const password = adminPasswordInput.value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle the rest
    } catch (error) {
        showAlert(adminLoginStatus, `Login Failed: ${error.message}`);
        toggleLoader(false);
    }
};

const handleLogout = async () => {
    await signOut(auth);
};


// =======================================================
// ===           DATA FETCHING & RENDERING           ===
// =======================================================

const loadAllAdminData = () => {
    fetchDashboardStats();
    fetchPendingPosts();
    fetchUsers();
    fetchTagsAndChannels();
    fetchPaymentRequests();
    fetchSettings();
};

// --- Dashboard ---
const fetchDashboardStats = () => {
    const usersRef = ref(db, 'users');
    const postsRef = ref(db, 'posts');
    const paymentsRef = ref(db, 'paymentRequests');

    get(usersRef).then(snap => { statTotalUsers.textContent = snap.exists() ? Object.keys(snap.val()).length : 0; });
    get(postsRef).then(snap => {
        if (snap.exists()) {
            const posts = Object.values(snap.val());
            statTotalPosts.textContent = posts.length;
            const pending = posts.filter(p => p.status === 'pending').length;
            statPendingPosts.textContent = pending;
            pendingPostsCountBadge.textContent = pending;
        }
    });
    get(paymentsRef).then(snap => {
        if (snap.exists()) {
            const payments = Object.values(snap.val());
            const pending = payments.filter(p => p.status === 'pending').length;
            statPendingPayments.textContent = pending;
            pendingPaymentsCountBadge.textContent = pending;
        }
    });
};

// --- Post Management ---
const fetchPendingPosts = () => {
    const postsRef = ref(db, 'posts');
    onValue(postsRef, (snapshot) => {
        const posts = snapshot.val();
        pendingPostsTableBody.innerHTML = '';
        let pendingCount = 0;
        if (posts) {
            for (const postId in posts) {
                if (posts[postId].status === 'pending') {
                    pendingCount++;
                    const post = posts[postId];
                    const user = state.allUsers[post.userId] || { name: 'Unknown User' };
                    const row = `
                        <tr>
                            <td>${user.name}<br><small class="text-secondary">${post.userId}</small></td>
                            <td class="post-content-preview">${post.content}</td>
                            <td>${post.tags.join(', ')}</td>
                            <td>${formatDate(post.createdAt || post.submittedAt)}</td>
                            <td>
                                <button class="btn btn-sm btn-info view-post-btn" data-id="${postId}"><i class="bi bi-eye"></i></button>
                                <button class="btn btn-sm btn-success approve-post-btn" data-id="${postId}"><i class="bi bi-check-lg"></i></button>
                                <button class="btn btn-sm btn-danger reject-post-btn" data-id="${postId}"><i class="bi bi-x-lg"></i></button>
                            </td>
                        </tr>
                    `;
                    pendingPostsTableBody.innerHTML += row;
                }
            }
        }
        if (pendingCount === 0) {
            pendingPostsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No pending posts found.</td></tr>';
        }
        statPendingPosts.textContent = pendingCount;
        pendingPostsCountBadge.textContent = pendingCount;
    });
};

// --- User Management ---
const fetchUsers = () => {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        const users = snapshot.val();
        state.allUsers = users || {};
        renderUsers(state.allUsers);
        statTotalUsers.textContent = users ? Object.keys(users).length : 0;
        // Re-fetch posts to update user names
        fetchPendingPosts();
    });
};

const renderUsers = (users) => {
    usersTableBody.innerHTML = '';
    if (!users || Object.keys(users).length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
        return;
    }
    for (const userId in users) {
        const user = users[userId];
        const row = `
            <tr class="${user.isSuspended ? 'table-danger' : ''}">
                <td>
                    <div class="user-info-cell">
                         <img src="${user.photoUrl || 'https://ui-avatars.com/api/?name=' + user.name}" class="user-avatar" alt="Avatar">
                        <div class="user-details">
                            <span class="user-name">${user.name || 'N/A'}</span>
                            <span class="user-id">${userId}</span>
                        </div>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>${user.points || 0}</td>
                <td>
                    <span class="badge ${user.isSuspended ? 'bg-danger' : 'bg-success'}">
                        ${user.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                    ${user.isAdmin ? '<span class="badge bg-primary ms-1">Admin</span>' : ''}
                </td>
                <td>${formatDate(user.joinDate)}</td>
                <td>
                    <button class="btn btn-sm btn-primary view-user-btn" data-id="${userId}">Details</button>
                </td>
            </tr>
        `;
        usersTableBody.innerHTML += row;
    }
};

// --- Tags & Channels ---
const fetchTagsAndChannels = () => {
    const tagsRef = ref(db, 'tags');
    const channelsRef = ref(db, 'linkedChannels');
    
    onValue(tagsRef, (snapshot) => {
        const tags = snapshot.val();
        tagsList.innerHTML = '';
        selectTagForChannel.innerHTML = '<option selected disabled>Choose a tag...</option>';
        if (tags) {
            Object.keys(tags).forEach(tag => {
                tagsList.innerHTML += `
                    <li class="list-group-item">
                        ${tag}
                        <button class="btn btn-sm btn-outline-danger delete-tag-btn" data-tag="${tag}"><i class="bi bi-trash"></i></button>
                    </li>
                `;
                selectTagForChannel.innerHTML += `<option value="${tag}">${tag}</option>`;
            });
        }
    });

    onValue(channelsRef, (snapshot) => {
        const channels = snapshot.val();
        linkedChannelsContainer.innerHTML = '<h6>Currently Linked Channels</h6>';
        if (channels) {
            for (const tag in channels) {
                linkedChannelsContainer.innerHTML += `<div class="mb-2"><strong>${tag}:</strong></div>`;
                const tagChannels = channels[tag];
                const channelList = document.createElement('div');
                channelList.className = 'd-flex flex-wrap gap-2 channel-list';
                for (const channelId in tagChannels) {
                    channelList.innerHTML += `
                        <span class="badge bg-secondary remove-channel-btn" data-tag="${tag}" data-id="${channelId}">
                            ${tagChannels[channelId]} <i class="bi bi-x-circle remove-channel-icon"></i>
                        </span>
                    `;
                }
                linkedChannelsContainer.appendChild(channelList);
            }
        }
    });
};

// --- Payment Requests ---
const fetchPaymentRequests = () => {
    // Placeholder - implement similarly to fetchPendingPosts
    paymentRequestsTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Feature coming soon.</td></tr>';
};

// --- Settings ---
const fetchSettings = () => {
    const settingsRef = ref(db, 'settings');
    get(settingsRef).then((snapshot) => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            for (const key in settings) {
                const input = document.getElementById(`setting${key.charAt(0).toUpperCase() + key.slice(1)}`);
                if (input) {
                    input.value = settings[key];
                }
            }
        }
    });
};


// =======================================================
// ===              ACTION HANDLERS                  ===
// =======================================================

// --- Post Actions ---
const handleViewPost = async (postId) => {
    state.selectedPostId = postId;
    const postRef = ref(db, `posts/${postId}`);
    const snapshot = await get(postRef);
    if (snapshot.exists()) {
        const post = snapshot.val();
        const user = state.allUsers[post.userId] || {};
        
        let contentHTML = `
            <p><strong>User:</strong> ${user.name || 'Unknown'} (${post.userId})</p>
            <p><strong>Submitted:</strong> ${formatDate(post.createdAt || post.submittedAt)}</p>
            <p><strong>Tags:</strong> ${post.tags.join(', ')}</p>
            ${post.customButton ? `<p><strong>Button:</strong> <a href="${post.customButton.url}" target="_blank">${post.customButton.text}</a></p>` : ''}
            <hr>
            <h6>Content:</h6>
            <div class="post-content-full">${post.content}</div>
        `;
        document.getElementById('postContentModalBody').innerHTML = contentHTML;

        let footerHTML = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-danger reject-post-btn" data-id="${postId}">Reject</button>
            <button type="button" class="btn btn-success approve-post-btn" data-id="${postId}">Approve</button>
        `;
        document.getElementById('postReviewActionsFooter').innerHTML = footerHTML;
        postContentModal.show();
    }
};

const handleApprovePost = async (postId) => {
    const postRef = ref(db, `posts/${postId}`);
    await update(postRef, {
        status: 'published',
        approvedAt: new Date().toISOString()
    });
    postContentModal.hide();
    alert('Post approved and published.');
};

const handleRejectPost = (postId) => {
    state.selectedPostId = postId;
    document.getElementById('rejectionReason').value = '';
    postContentModal.hide();
    rejectPostModal.show();
};

const confirmRejectPost = async () => {
    const reason = document.getElementById('rejectionReason').value;
    if (!reason) {
        alert('Please provide a reason for rejection.');
        return;
    }
    const postRef = ref(db, `posts/${state.selectedPostId}`);
    await update(postRef, {
        status: 'rejected',
        rejectionReason: reason
    });
    rejectPostModal.hide();
    alert('Post rejected.');
};

// --- User Actions ---
const handleViewUser = (userId) => {
    state.selectedUserId = userId;
    const user = state.allUsers[userId];
    const userDetailContent = document.getElementById('userDetailContent');
    userDetailContent.innerHTML = `
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
        <p><strong>Points:</strong> ${user.points}</p>
        <p><strong>Status:</strong> ${user.isSuspended ? 'Suspended' : 'Active'}</p>
        <p><strong>Joined:</strong> ${formatDate(user.joinDate)}</p>
    `;
    
    document.getElementById('suspendUserBtn').style.display = user.isSuspended ? 'none' : 'block';
    document.getElementById('reactivateUserBtn').style.display = user.isSuspended ? 'block' : 'none';

    userModal.show();
};

const handleSuspendUser = async () => {
    if (confirm(`Are you sure you want to suspend this user?`)) {
        await update(ref(db, `users/${state.selectedUserId}`), { isSuspended: true });
        userModal.hide();
        alert('User suspended.');
    }
};

const handleReactivateUser = async () => {
    await update(ref(db, `users/${state.selectedUserId}`), { isSuspended: false });
    userModal.hide();
    alert('User re-activated.');
};

const handleUpdatePoints = async (e) => {
    e.preventDefault();
    const amount = parseInt(document.getElementById('pointsUpdateAmount').value);
    const reason = document.getElementById('pointsUpdateReason').value;

    if (isNaN(amount) || !reason) {
        alert('Please enter a valid amount and reason.');
        return;
    }

    const userRef = ref(db, `users/${state.selectedUserId}`);
    const snapshot = await get(userRef);
    const user = snapshot.val();
    const newPoints = (user.points || 0) + amount;

    await update(userRef, { points: newPoints });

    const transactionsRef = ref(db, `users/${state.selectedUserId}/transactions`);
    await push(transactionsRef, {
        amount: amount,
        description: reason,
        type: 'admin_update',
        timestamp: Date.now()
    });

    document.getElementById('updatePointsForm').reset();
    userModal.hide();
    alert('Points updated successfully.');
};

// --- Tag/Channel Actions ---
const handleSaveTag = async () => {
    const tagName = document.getElementById('tagName').value.trim();
    if (tagName) {
        await set(ref(db, `tags/${tagName}`), true);
        tagModal.hide();
        addTagForm.reset();
        alert('Tag added successfully.');
    }
};

const handleDeleteTag = async (tagName) => {
    if (confirm(`Are you sure you want to delete the tag "${tagName}"? This will not remove it from existing posts.`)) {
        await remove(ref(db, `tags/${tagName}`));
        alert('Tag deleted.');
    }
};

const handleLinkChannel = async (e) => {
    e.preventDefault();
    const tag = selectTagForChannel.value;
    const channelUsername = document.getElementById('channelUsername').value.trim();
    if (tag && channelUsername.startsWith('@')) {
        const channelRef = ref(db, `linkedChannels/${tag}`);
        await push(channelRef, channelUsername);
        linkChannelForm.reset();
        alert('Channel linked successfully.');
    } else {
        alert('Please select a tag and provide a valid channel username (starting with @).');
    }
};

const handleRemoveChannel = async (tag, channelId) => {
    if (confirm('Are you sure you want to unlink this channel?')) {
        await remove(ref(db, `linkedChannels/${tag}/${channelId}`));
        alert('Channel unlinked.');
    }
};


// --- Settings Actions ---
const handleSaveSettings = async (e) => {
    e.preventDefault();
    const settings = {
        joinBonus: parseInt(document.getElementById('settingJoinBonus').value),
        dailyBonus: parseInt(document.getElementById('settingDailyBonus').value),
        referralBonus: parseInt(document.getElementById('settingReferralBonus').value),
        postCost: parseInt(document.getElementById('settingPostCost').value),
        minWithdrawal: parseInt(document.getElementById('settingMinWithdrawal').value),
        pointsToBdt: parseInt(document.getElementById('settingPointsToBdt').value),
        paymentNumber: document.getElementById('settingPaymentNumber').value,
        privacyPolicy: document.getElementById('settingPrivacyPolicy').value,
        terms: document.getElementById('settingTerms').value,
    };
    await set(ref(db, 'settings'), settings);
    alert('Settings saved successfully!');
};

// =======================================================
// ===              EVENT LISTENERS SETUP              ===
// =======================================================

document.addEventListener('DOMContentLoaded', () => {

    adminLoginForm.addEventListener('submit', handleLogin);
    adminLogoutBtn.addEventListener('click', handleLogout);
    settingsForm.addEventListener('submit', handleSaveSettings);
    saveTagBtn.addEventListener('click', handleSaveTag);
    linkChannelForm.addEventListener('submit', handleLinkChannel);
    
    // Sidebar Navigation
    adminSidebar.addEventListener('click', (e) => {
        if (e.target.matches('.nav-link')) {
            e.preventDefault();
            const sectionId = e.target.dataset.section;
            if (sectionId) {
                showSection(sectionId);
                const offcanvas = bootstrap.Offcanvas.getInstance(adminSidebar);
                if (offcanvas) offcanvas.hide();
            }
        }
    });

    // Event Delegation for dynamic content
    adminMainContent.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        // Post actions
        if (target.matches('.view-post-btn')) handleViewPost(target.dataset.id);
        if (target.matches('.approve-post-btn')) handleApprovePost(target.dataset.id);
        if (target.matches('.reject-post-btn')) handleRejectPost(target.dataset.id);

        // User actions
        if (target.matches('.view-user-btn')) handleViewUser(target.dataset.id);

        // Tag actions
        if (target.matches('.delete-tag-btn')) handleDeleteTag(target.dataset.tag);
    });
    
    linkedChannelsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('.remove-channel-btn');
        if(target) {
            handleRemoveChannel(target.dataset.tag, target.dataset.id);
        }
    });
    
    // Modal related buttons
    document.getElementById('confirmRejectBtn').addEventListener('click', confirmRejectPost);
    document.getElementById('suspendUserBtn').addEventListener('click', handleSuspendUser);
    document.getElementById('reactivateUserBtn').addEventListener('click', handleReactivateUser);
    document.getElementById('updatePointsForm').addEventListener('submit', handleUpdatePoints);

    // User search
    document.getElementById('userSearchInput').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = {};
        for (const userId in state.allUsers) {
            const user = state.allUsers[userId];
            if (
                userId.toLowerCase().includes(searchTerm) ||
                (user.name && user.name.toLowerCase().includes(searchTerm)) ||
                (user.email && user.email.toLowerCase().includes(searchTerm))
            ) {
                filteredUsers[userId] = user;
            }
        }
        renderUsers(filteredUsers);
    });
});
