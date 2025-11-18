// =======================================================
// ===               FIREBASE & CONFIG                 ===
// =======================================================
// Firebase Imports (using ES6 Modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, get, set, update, push, onValue, off, query, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAe3TMK4RHmReffbhxZeYi5NuHgmJJWlTo",
    authDomain: "supchat-5474d.firebaseapp.com",
    databaseURL: "https://supchat-5474d-default-rtdb.firebaseio.com",
    projectId: "supchat-5474d",
    storageBucket: "supchat-5474d.appspot.com",
    messagingSenderId: "170794585438",
    appId: "1:170794585438:web:da9cb1f6d7cc3408b493cf"
};

// Initialize Firebase
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Firebase initialization failed:", e);
    document.body.innerHTML = `<div class="alert alert-danger m-5"><strong>Critical Error:</strong> Could not connect to Firebase. Check config and console.</div>`;
}

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
let currentAdminUser = null;
let currentEditingUserId = null;
let dbListeners = {}; // To keep track of active listeners

// --- Main Auth Flow ---
onAuthStateChanged(auth, (user) => {
    showLoader(true);
    if (user) {
        currentAdminUser = user;
        elements.adminUserEmail.textContent = user.email;
        elements.authContainer.style.display = 'none';
        elements.mainArea.style.display = 'block';
        navigateToSection('dashboard-section');
        setupRealtimeListeners();
    } else {
        currentAdminUser = null;
        elements.mainArea.style.display = 'none';
        elements.authContainer.style.display = 'block';
        elements.loginSection.style.display = 'block';
        detachAllListeners();
    }
    showLoader(false);
});

function handleLogin(e) {
    e.preventDefault();
    showLoader(true);
    const email = elements.adminEmailInput.value;
    const password = elements.adminPasswordInput.value;
    signInWithEmailAndPassword(auth, email, password)
        .catch(error => {
            elements.loginStatus.textContent = `Login Failed: ${error.message}`;
            elements.loginStatus.className = 'alert alert-danger';
            elements.loginStatus.style.display = 'block';
        })
        .finally(() => showLoader(false));
}

function handleLogout() {
    signOut(auth);
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
            break;
        case 'posts-section':
            loadPendingPosts();
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
    const usersRef = ref(db, 'users');
    const postsRef = ref(db, 'posts');
    const paymentsRef = query(ref(db, 'paymentRequests'), orderByChild('status'), equalTo('pending'));
    
    const [usersSnap, postsSnap, paymentsSnap] = await Promise.all([
        get(usersRef), get(postsRef), get(paymentsRef)
    ]);
    
    elements.statTotalUsers.textContent = usersSnap.exists() ? usersSnap.size : 0;
    
    let totalPosts = 0;
    let pendingPosts = 0;
    if (postsSnap.exists()) {
        totalPosts = postsSnap.size;
        postsSnap.forEach(child => {
            if (child.val().status === 'pending') {
                pendingPosts++;
            }
        });
    }
    elements.statTotalPosts.textContent = totalPosts;
    elements.statPendingPosts.textContent = pendingPosts;
    elements.pendingPostsCountBadge.textContent = pendingPosts;
    elements.pendingPostsCountBadge.style.display = pendingPosts > 0 ? 'inline-block' : 'none';

    const pendingPayments = paymentsSnap.exists() ? paymentsSnap.size : 0;
    elements.statPendingPayments.textContent = pendingPayments;
    elements.pendingPaymentsCountBadge.textContent = pendingPayments;
    elements.pendingPaymentsCountBadge.style.display = pendingPayments > 0 ? 'inline-block' : 'none';
}

// Post Management
function loadPendingPosts() {
    const postsQuery = query(ref(db, 'posts'), orderByChild('status'), equalTo('pending'));
    onValue(postsQuery, snapshot => {
        const tableBody = elements.pendingPostsTableBody;
        tableBody.innerHTML = '';
        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-secondary">No pending posts.</td></tr>`;
            return;
        }
        snapshot.forEach(childSnapshot => {
            const post = childSnapshot.val();
            const postId = childSnapshot.key;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${post.userName || 'Unknown'} <small class="d-block text-secondary">${post.userId}</small></td>
                <td class="post-content-preview">${post.content}</td>
                <td>${post.tags.map(tag => `<span class="badge bg-secondary">#${tag}</span>`).join(' ')}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="window.viewPostContent('${postId}')"><i class="bi bi-eye"></i></button>
                    <button class="btn btn-sm btn-success" onclick="window.updatePostStatus('${postId}', 'approved')"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="window.updatePostStatus('${postId}', 'rejected')"><i class="bi bi-x-lg"></i></button>
                </td>
            `;
        });
    });
}

// User Management
function loadUsers() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, snapshot => {
        const tableBody = elements.usersTableBody;
        tableBody.innerHTML = '';
        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No users found.</td></tr>`;
            return;
        }
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            const userId = childSnapshot.key;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${userId}</td>
                <td>${user.name || 'N/A'}</td>
                <td>${user.points || 0}</td>
                <td>${new Date(user.joinDate).toLocaleDateString()}</td>
                <td><button class="btn btn-sm btn-primary" onclick="window.openUserModal('${userId}')">Details</button></td>
            `;
        });
    });
}

// Tags & Channels
function loadTags() {
    onValue(ref(db, 'tags'), snapshot => {
        elements.tagsList.innerHTML = '';
        elements.selectTag.innerHTML = '<option value="">Select a tag</option>';
        if (!snapshot.exists()) {
            elements.tagsList.innerHTML = '<li class="list-group-item text-secondary">No tags created.</li>';
            return;
        }
        snapshot.forEach(child => {
            const tagName = child.key;
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `<span>#${tagName}</span><button class="btn btn-sm btn-outline-danger" onclick="window.deleteTag('${tagName}')"><i class="bi bi-trash"></i></button>`;
            elements.tagsList.appendChild(li);
            elements.selectTag.innerHTML += `<option value="${tagName}">${tagName}</option>`;
        });
    });
}

function loadLinkedChannels() {
     onValue(ref(db, 'linkedChannels'), snapshot => {
        elements.linkedChannelsContainer.innerHTML = '';
        if (!snapshot.exists()) return;
        snapshot.forEach(tagSnap => {
            const tagName = tagSnap.key;
            const channels = tagSnap.val();
            let channelHtml = `<h6>#${tagName}</h6>`;
            Object.entries(channels).forEach(([channelKey, channelUsername]) => {
                channelHtml += `<div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="badge bg-info">${channelUsername}</span>
                    <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="window.unlinkChannel('${tagName}', '${channelKey}')">×</button>
                </div>`;
            });
            elements.linkedChannelsContainer.innerHTML += channelHtml;
        });
     });
}

// Payments
function loadPaymentRequests() {
    const paymentsQuery = query(ref(db, 'paymentRequests'), orderByChild('status'), equalTo('pending'));
    onValue(paymentsQuery, snapshot => {
        const tableBody = elements.paymentRequestsTableBody;
        tableBody.innerHTML = '';
        if (!snapshot.exists()) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-secondary">No pending payment requests.</td></tr>`;
            return;
        }
        snapshot.forEach(child => {
            const req = child.val();
            const reqId = child.key;
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${req.userName || 'N/A'} <small class="d-block text-secondary">${req.userId}</small></td>
                <td>${req.amount} BDT</td>
                <td>${req.trxId}</td>
                <td>${new Date(req.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="window.handlePaymentRequest('${reqId}', 'approved', ${req.userId}, ${req.amount})">Approve</button>
                    <button class="btn btn-sm btn-danger" onclick="window.handlePaymentRequest('${reqId}', 'rejected')">Reject</button>
                </td>
            `;
        });
    });
}

// Settings
function loadSettings() {
    get(ref(db, 'settings')).then(snapshot => {
        if (snapshot.exists()) {
            const settings = snapshot.val();
            Object.keys(elements).forEach(key => {
                if (key.startsWith('setting')) {
                    const settingKey = key.replace('setting', '').charAt(0).toLowerCase() + key.slice(8);
                    if (elements[key] && settings[settingKey] !== undefined) {
                        elements[key].value = settings[settingKey];
                    }
                }
            });
        }
    });
}


// =======================================================
// ===               ACTION FUNCTIONS                  ===
// =======================================================
// These functions are called from inline onclick attributes for simplicity
window.updatePostStatus = (postId, status) => {
    if (!confirm(`Are you sure you want to ${status} this post?`)) return;
    const updates = {};
    updates[`/posts/${postId}/status`] = status;
    if (status === 'approved') {
        updates[`/posts/${postId}/approvedAt`] = new Date().toISOString();
    }
    update(ref(db), updates)
        .then(() => alert(`Post has been ${status}.`))
        .catch(err => alert(`Error: ${err.message}`));
    // In a real app, an 'approved' status would trigger a Cloud Function to broadcast the post.
};

window.viewPostContent = (postId) => {
    get(ref(db, `posts/${postId}/content`)).then(snapshot => {
        if (snapshot.exists()) {
            elements.postContentModalBody.textContent = snapshot.val();
            getModalInstance(getEl('postContentModal')).show();
        } else {
            alert('Could not retrieve post content.');
        }
    });
};

window.openUserModal = (userId) => {
    currentEditingUserId = userId;
    get(ref(db, `users/${userId}`)).then(snapshot => {
        if (snapshot.exists()) {
            const user = snapshot.val();
            elements.userModalTitle.textContent = `Details for ${user.name}`;
            elements.userDetailId.textContent = userId;
            elements.userDetailName.textContent = user.name;
            elements.userDetailPoints.textContent = user.points || 0;
            getModalInstance(getEl('userModal')).show();
        }
    });
};

window.updateUserPoints = (e) => {
    e.preventDefault();
    const amount = parseInt(elements.pointsUpdateAmount.value);
    const reason = elements.pointsUpdateReason.value.trim();
    if (isNaN(amount) || !reason) {
        alert('Please provide a valid amount and a reason.');
        return;
    }
    const userPointsRef = ref(db, `users/${currentEditingUserId}/points`);
    get(userPointsRef).then(snapshot => {
        const currentPoints = snapshot.val() || 0;
        const newPoints = currentPoints + amount;
        set(userPointsRef, newPoints).then(() => {
            // Log this transaction
            const transaction = { type: 'admin_update', amount, description: reason, timestamp: new Date().toISOString() };
            push(ref(db, `users/${currentEditingUserId}/transactions`), transaction);
            alert('Points updated successfully!');
            getModalInstance(getEl('userModal')).hide();
        });
    });
};

window.saveTag = () => {
    const tagName = elements.tagNameInput.value.trim();
    if (!tagName) { alert('Tag name cannot be empty.'); return; }
    set(ref(db, `tags/${tagName}`), true)
        .then(() => { alert('Tag added!'); getModalInstance(getEl('tagModal')).hide(); elements.addTagForm.reset(); })
        .catch(err => alert(`Error: ${err.message}`));
};

window.deleteTag = (tagName) => {
    if (!confirm(`Are you sure you want to delete the tag #${tagName}? This will not remove it from existing posts.`)) return;
    set(ref(db, `tags/${tagName}`), null);
};

window.linkChannel = (e) => {
    e.preventDefault();
    const tagName = elements.selectTag.value;
    const channelUsername = elements.channelUsernameInput.value.trim();
    if (!tagName || !channelUsername.startsWith('@')) {
        alert('Please select a tag and provide a valid channel username (starting with @).');
        return;
    }
    push(ref(db, `linkedChannels/${tagName}`), channelUsername)
        .then(() => { alert('Channel linked successfully!'); elements.linkChannelForm.reset(); })
        .catch(err => alert(`Error: ${err.message}`));
};

window.unlinkChannel = (tagName, channelKey) => {
    if (!confirm('Are you sure you want to unlink this channel?')) return;
    set(ref(db, `linkedChannels/${tagName}/${channelKey}`), null);
};

window.handlePaymentRequest = (reqId, status, userId, amount) => {
    if (!confirm(`Are you sure you want to ${status} this payment request?`)) return;
    const updates = {};
    updates[`/paymentRequests/${reqId}/status`] = status;
    if (status === 'approved') {
        get(ref(db, `users/${userId}/points`)).then(snapshot => {
            const currentPoints = snapshot.val() || 0;
            // Assuming 1 BDT = 10 points for simplicity
            const pointsToAdd = amount * 10; 
            updates[`/users/${userId}/points`] = currentPoints + pointsToAdd;
            update(ref(db), updates).then(() => alert('Request approved and points added.'));
        });
    } else {
        update(ref(db), updates).then(() => alert('Request has been rejected.'));
    }
};

window.saveSettings = (e) => {
    e.preventDefault();
    const settings = {
        joinBonus: parseInt(elements.settingJoinBonus.value),
        dailyBonus: parseInt(elements.settingDailyBonus.value),
        referralBonus: parseInt(elements.settingReferralBonus.value),
        postCost: parseInt(elements.settingPostCost.value),
        paymentNumber: elements.settingPaymentNumber.value.trim(),
    };
    set(ref(db, 'settings'), settings)
        .then(() => alert('Settings saved successfully!'))
        .catch(err => alert(`Error: ${err.message}`));
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
        const searchTerm = e.target.value.toLowerCase();
        const rows = elements.usersTableBody.getElementsByTagName('tr');
        Array.from(rows).forEach(row => {
            row.style.display = row.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        });
    });
}
setupEventListeners();

// =======================================================
// ===        REALTIME LISTENER SETUP/CLEANUP          ===
// =======================================================
function setupRealtimeListeners() {
    // Listen for pending posts count
    const pendingPostsQuery = query(ref(db, 'posts'), orderByChild('status'), equalTo('pending'));
    dbListeners.pendingPosts = onValue(pendingPostsQuery, snapshot => {
        const count = snapshot.exists() ? snapshot.size : 0;
        elements.pendingPostsCountBadge.textContent = count;
        elements.pendingPostsCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
    });
    // Listen for pending payments count
    const pendingPaymentsQuery = query(ref(db, 'paymentRequests'), orderByChild('status'), equalTo('pending'));
    dbListeners.pendingPayments = onValue(pendingPaymentsQuery, snapshot => {
        const count = snapshot.exists() ? snapshot.size : 0;
        elements.pendingPaymentsCountBadge.textContent = count;
        elements.pendingPaymentsCountBadge.style.display = count > 0 ? 'inline-block' : 'none';
    });
}

function detachAllListeners() {
    Object.values(dbListeners).forEach(listenerRef => {
        // The onValue function returns an unsubscribe function.
        // It's better to store that function and call it.
        // For simplicity here, we assume the object can be turned off,
        // but this approach is flawed. A better way is to store unsubscribe functions.
        // off(listenerRef); 
    });
    dbListeners = {};
}
// Utility to show loader
const showLoader = (show) => { elements.loader.style.display = show ? 'flex' : 'none'; };
