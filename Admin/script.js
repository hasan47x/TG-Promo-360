document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // ===          1. FIREBASE INITIALIZATION           ===
    // =======================================================
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAe3TMK4RHmReffbhxZeYi5NuHgmJJWlTo",
  authDomain: "supchat-5474d.firebaseapp.com",
  databaseURL: "https://supchat-5474d-default-rtdb.firebaseio.com",
  projectId: "supchat-5474d",
  storageBucket: "supchat-5474d.appspot.com",
  messagingSenderId: "170794585438",
  appId: "1:170794585438:web:da9cb1f6d7cc3408b493cf",
  measurementId: "G-NEWFJBQSB9"
};
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    // =======================================================
    // ===            2. DOM & STATE MANAGEMENT          ===
    // =======================================================
    const adminLoader = document.getElementById('adminLoader');
    const authContainer = document.getElementById('authContainer');
    const adminMainArea = document.getElementById('adminMainArea');
    const adminPageTitle = document.getElementById('adminPageTitle');
    let currentPostToReview = {};
    let modals = {};

    // =======================================================
    // ===        3. AUTHENTICATION & ADMIN CHECK        ===
    // =======================================================
    auth.onAuthStateChanged(user => {
        adminLoader.style.display = 'flex';
        if (user) {
            checkIfAdmin(user);
        } else {
            showLoginUI();
        }
    });

    function checkIfAdmin(user) {
        db.ref(`users/${user.uid}/isAdmin`).once('value')
            .then(snapshot => {
                if (snapshot.exists() && snapshot.val() === true) {
                    initializeAppUI(user);
                } else {
                    alert('Access Denied. You are not an administrator.');
                    auth.signOut();
                }
            })
            .catch(error => {
                alert('Error checking admin status: ' + error.message);
                auth.signOut();
            });
    }

    function showLoginUI() {
        adminMainArea.style.display = 'none';
        authContainer.style.display = 'flex';
        adminLoader.style.display = 'none';
    }

    function initializeAppUI(user) {
        authContainer.style.display = 'none';
        adminMainArea.style.display = 'block';
        adminLoader.style.display = 'none';
        document.getElementById('adminUserEmail').textContent = user.email;
        
        modals.tag = new bootstrap.Modal(document.getElementById('tagModal'));
        modals.user = new bootstrap.Modal(document.getElementById('userModal'));
        modals.postContent = new bootstrap.Modal(document.getElementById('postContentModal'));
        modals.rejectPost = new bootstrap.Modal(document.getElementById('rejectPostModal'));

        loadDashboardStats();
        loadPendingPosts();
        loadAllUsers();
        loadTagsAndChannels();
        loadPaymentRequests();
        loadSettings();
    }

    // =======================================================
    // ===            4. UI & NAVIGATION                   ===
    // =======================================================
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const sectionId = e.target.closest('a').dataset.section;
            document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
            
            document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
            e.target.closest('a').classList.add('active');
            
            adminPageTitle.textContent = e.target.closest('a').textContent.replace(/<span.*<\/span>/, '').trim();
            bootstrap.Offcanvas.getInstance(document.getElementById('adminSidebar'))?.hide();
        });
    });

    // =======================================================
    // ===           5. DATA FETCHING & RENDERING        ===
    // =======================================================
    function loadDashboardStats() {
        db.ref('users').on('value', s => { document.getElementById('statTotalUsers').textContent = s.exists() ? s.numChildren() : 0; });
        db.ref('posts').on('value', s => {
            if (!s.exists()) return;
            document.getElementById('statTotalPosts').textContent = s.numChildren();
            const pending = Object.values(s.val()).filter(p => p.status === 'pending').length;
            document.getElementById('statPendingPosts').textContent = pending;
            document.getElementById('pendingPostsCountBadge').textContent = pending;
        });
        db.ref('paymentRequests').on('value', s => {
            const pending = s.exists() ? Object.values(s.val()).filter(p => p.status === 'pending').length : 0;
            document.getElementById('statPendingPayments').textContent = pending;
            document.getElementById('pendingPaymentsCountBadge').textContent = pending;
        });
    }

    function loadPendingPosts() {
        db.ref('posts').on('value', snapshot => {
            const tableBody = document.getElementById('pendingPostsTableBody');
            tableBody.innerHTML = '';
            let hasPending = false;
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    const post = child.val();
                    if (post.status === 'pending') {
                        hasPending = true;
                        const row = `<tr data-post-id="${child.key}"><td>${post.userName || 'N/A'}</td><td class="post-content-preview">${post.content}</td><td>${post.tags.join(', ')}</td><td>${new Date(post.createdAt).toLocaleDateString()}</td><td><button class="btn btn-sm btn-info view-post-btn"><i class="bi bi-eye"></i> View</button></td></tr>`;
                        tableBody.insertAdjacentHTML('beforeend', row);
                    }
                });
            }
            if (!hasPending) tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No pending posts.</td></tr>';
        });
    }

    function loadAllUsers() {
        const usersRef = db.ref('users');
        usersRef.on('value', snapshot => renderUsersTable(snapshot));
        document.getElementById('userSearchInput').addEventListener('input', e => {
            usersRef.once('value').then(snapshot => renderUsersTable(snapshot, e.target.value.toLowerCase()));
        });
    }

    function renderUsersTable(snapshot, searchTerm = '') {
        const tableBody = document.getElementById('usersTableBody');
        tableBody.innerHTML = '';
        if (!snapshot.exists()) {
            tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No users found.</td></tr>';
            return;
        }
        snapshot.forEach(child => {
            const user = child.val();
            const userId = child.key;
            if (!searchTerm || userId.toLowerCase().includes(searchTerm) || (user.name && user.name.toLowerCase().includes(searchTerm)) || (user.email && user.email.toLowerCase().includes(searchTerm))) {
                const statusBadge = user.isSuspended ? '<span class="badge bg-danger">Suspended</span>' : '<span class="badge bg-success">Active</span>';
                const row = `
                    <tr data-user-id="${userId}" class="${user.isSuspended ? 'table-danger' : ''}">
                        <td><div class="user-info-cell"><img src="${user.photoUrl || 'https://via.placeholder.com/40'}" class="user-avatar"><div class="user-details"><span class="user-name">${user.name || 'N/A'}</span><span class="user-id">${userId}</span></div></div></td>
                        <td>${user.email || 'N/A'}</td><td>${user.points || 0}</td>
                        <td>${statusBadge}</td><td>${new Date(user.joinDate).toLocaleDateString()}</td>
                        <td><button class="btn btn-sm btn-primary view-user-btn"><i class="bi bi-pencil-square"></i> Details</button></td>
                    </tr>`;
                tableBody.insertAdjacentHTML('beforeend', row);
            }
        });
    }

    function loadTagsAndChannels() {
        db.ref('tags').on('value', s => {
            const tagsList = document.getElementById('tagsList');
            const selectTag = document.getElementById('selectTag');
            tagsList.innerHTML = '';
            selectTag.innerHTML = '<option selected disabled value="">Choose a tag...</option>';
            if (s.exists()) {
                s.forEach(c => {
                    tagsList.innerHTML += `<li class="list-group-item"><span>#${c.key}</span><button class="btn btn-sm btn-outline-danger delete-tag-btn" data-tag="${c.key}"><i class="bi bi-trash"></i></button></li>`;
                    selectTag.innerHTML += `<option value="${c.key}">${c.key}</option>`;
                });
            }
        });
        db.ref('linkedChannels').on('value', s => {
            const container = document.getElementById('linkedChannelsContainer');
            container.innerHTML = '';
            if (s.exists()) {
                s.forEach(tag => {
                    let html = `<div class="mb-2"><strong>#${tag.key}:</strong><div class="d-flex flex-wrap gap-2 mt-1 channel-list">`;
                    tag.forEach(chan => html += `<span class="badge bg-secondary" data-tag="${tag.key}" data-channel-id="${chan.key}">${chan.val()} <i class="bi bi-x-circle remove-channel-icon"></i></span>`);
                    container.innerHTML += `${html}</div></div>`;
                });
            }
        });
    }

    function loadPaymentRequests() {
        db.ref('paymentRequests').on('value', snapshot => {
            const tableBody = document.getElementById('paymentRequestsTableBody');
            tableBody.innerHTML = '';
            let hasPending = false;
            if(snapshot.exists()) {
                snapshot.forEach(child => {
                    const req = child.val();
                    if(req.status === 'pending') {
                        hasPending = true;
                        const row = `<tr data-request-id="${child.key}" data-user-id="${req.userId}" data-points="${req.points}"><td>${req.userName}</td><td>${req.amountBDT} BDT</td><td>${req.paymentNumber}</td><td>${new Date(req.createdAt).toLocaleString()}</td><td><button class="btn btn-sm btn-success approve-payment-btn">Approve</button><button class="btn btn-sm btn-danger reject-payment-btn ms-1">Reject</button></td></tr>`;
                        tableBody.insertAdjacentHTML('beforeend', row);
                    }
                });
            }
            if (!hasPending) tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No pending payment requests.</td></tr>';
        });
    }

    function loadSettings() {
        db.ref('settings').once('value').then(s => {
            if(s.exists()) {
                const settings = s.val();
                document.getElementById('settingJoinBonus').value = settings.joinBonus || 0;
                document.getElementById('settingDailyBonus').value = settings.dailyBonus || 0;
                document.getElementById('settingReferralBonus').value = settings.referralBonus || 0;
                document.getElementById('settingPostCost').value = settings.postCost || 0;
                document.getElementById('settingMinWithdrawal').value = settings.minWithdrawal || 1000;
                document.getElementById('settingPointsToBdt').value = settings.pointsToBdtRate || 100;
                document.getElementById('settingPaymentNumber').value = settings.paymentNumber || '';
                document.getElementById('settingPrivacyPolicy').value = settings.privacyPolicy || '';
                document.getElementById('settingTerms').value = settings.terms || '';
            }
        });
    }

    // =======================================================
    // ===               6. EVENT LISTENERS                ===
    // =======================================================
    document.getElementById('adminLoginForm').addEventListener('submit', e => { e.preventDefault(); const email = document.getElementById('adminEmail').value, password = document.getElementById('adminPassword').value; auth.signInWithEmailAndPassword(email, password).catch(err => { const status = document.getElementById('adminLoginStatus'); status.textContent = `Login Failed: ${err.code}`; status.className = 'alert alert-danger'; status.style.display = 'block'; }); });
    document.getElementById('adminLogoutBtn').addEventListener('click', () => auth.signOut());

    document.getElementById('pendingPostsTableBody').addEventListener('click', e => { if (e.target.closest('.view-post-btn')) { const postId = e.target.closest('tr').dataset.postId; currentPostToReview = { postId }; db.ref(`posts/${postId}`).once('value').then(s => { const post = s.val(); document.getElementById('postContentModalBody').innerHTML = `<p><strong>User:</strong> ${post.userName}</p><hr><div class="post-content-full">${post.content.replace(/\n/g, '<br>')}</div>`; document.getElementById('postReviewActionsFooter').innerHTML = `<button type="button" class="btn btn-success approve-post-btn">Approve</button><button type="button" class="btn btn-danger reject-post-btn">Reject</button>`; modals.postContent.show(); }); } });
    document.getElementById('postReviewActionsFooter').addEventListener('click', e => { if (e.target.classList.contains('approve-post-btn')) db.ref(`posts/${currentPostToReview.postId}`).update({ status: 'approved' }).then(() => { alert('Post approved!'); modals.postContent.hide(); }); else if (e.target.classList.contains('reject-post-btn')) { modals.postContent.hide(); modals.rejectPost.show(); } });
    document.getElementById('confirmRejectBtn').addEventListener('click', () => { const reason = document.getElementById('rejectionReason').value; if (!reason) return alert('Please provide a reason.'); db.ref(`posts/${currentPostToReview.postId}`).update({ status: 'rejected', rejectionReason: reason }).then(() => { alert('Post rejected!'); modals.rejectPost.hide(); document.getElementById('rejectionReason').value = ''; }); });

    document.getElementById('usersTableBody').addEventListener('click', e => { if (e.target.closest('.view-user-btn')) { const userId = e.target.closest('tr').dataset.userId; db.ref(`users/${userId}`).once('value').then(s => { const user = s.val(); document.getElementById('userModalTitle').textContent = `Details for ${user.name}`; document.getElementById('userDetailContent').innerHTML = `<p><strong>ID:</strong> ${userId}</p><p><strong>Email:</strong> ${user.email||'N/A'}</p><p><strong>Points:</strong> ${user.points||0}</p>`; document.getElementById('updatePointsForm').dataset.userId = userId; document.getElementById('suspendUserBtn').dataset.userId = userId; document.getElementById('reactivateUserBtn').dataset.userId = userId; document.getElementById('suspendUserBtn').style.display = user.isSuspended ? 'none' : 'block'; document.getElementById('reactivateUserBtn').style.display = user.isSuspended ? 'block' : 'none'; modals.user.show(); }); } });
    document.getElementById('updatePointsForm').addEventListener('submit', e => { e.preventDefault(); const userId = e.target.dataset.userId, amount = parseInt(document.getElementById('pointsUpdateAmount').value, 10), reason = document.getElementById('pointsUpdateReason').value; if (isNaN(amount) || !reason) return alert('Valid amount and reason required.'); db.ref(`users/${userId}/points`).once('value').then(s => { const updates = {}; updates[`users/${userId}/points`] = (s.val() || 0) + amount; updates[`users/${userId}/transactions/${db.ref().push().key}`] = { amount, description: `Admin: ${reason}`, type: 'admin_update', timestamp: firebase.database.ServerValue.TIMESTAMP }; db.ref().update(updates).then(() => { alert('Points updated!'); e.target.reset(); modals.user.hide(); }); }); });
    document.getElementById('suspendUserBtn').addEventListener('click', e => handleUserSuspension(e.target.dataset.userId, true));
    document.getElementById('reactivateUserBtn').addEventListener('click', e => handleUserSuspension(e.target.dataset.userId, false));
    function handleUserSuspension(userId, shouldSuspend) { if (!confirm(`Are you sure?`)) return; db.ref(`users/${userId}`).update({ isSuspended: shouldSuspend }).then(() => { alert(`User ${shouldSuspend ? 'suspended' : 're-activated'}.`); modals.user.hide(); }); }

    document.getElementById('saveTagBtn').addEventListener('click', () => { const tagName = document.getElementById('tagName').value.trim(); if (tagName) db.ref(`tags/${tagName}`).set(true).then(() => { document.getElementById('addTagForm').reset(); modals.tag.hide(); }); });
    document.getElementById('tagsList').addEventListener('click', e => { if(e.target.closest('.delete-tag-btn')) { const tagName = e.target.closest('.delete-tag-btn').dataset.tag; if (confirm(`Delete #${tagName}?`)) { db.ref(`tags/${tagName}`).remove(); db.ref(`linkedChannels/${tagName}`).remove(); } } });
    document.getElementById('linkChannelForm').addEventListener('submit', e => { e.preventDefault(); const tag = document.getElementById('selectTag').value, channel = document.getElementById('channelUsername').value.trim(); if (tag && channel.startsWith('@')) db.ref(`linkedChannels/${tag}`).push(channel).then(() => e.target.reset()); else alert('Valid tag and channel username (@...) required.'); });
    document.getElementById('linkedChannelsContainer').addEventListener('click', e => { if(e.target.classList.contains('remove-channel-icon')) { const badge = e.target.closest('.badge'); db.ref(`linkedChannels/${badge.dataset.tag}/${badge.dataset.channelId}`).remove(); } });

    document.getElementById('paymentRequestsTableBody').addEventListener('click', e => { const row = e.target.closest('tr'); if (!row) return; const requestId = row.dataset.requestId, userId = row.dataset.userId, points = parseInt(row.dataset.points, 10); if (e.target.classList.contains('approve-payment-btn')) { if (!confirm("Payment completed?")) return; db.ref(`paymentRequests/${requestId}`).update({ status: 'completed' }).then(() => alert("Request approved.")); } if (e.target.classList.contains('reject-payment-btn')) { const reason = prompt("Reason for rejection:"); db.ref(`users/${userId}/points`).once('value').then(s => { const updates = {}; updates[`paymentRequests/${requestId}/status`] = 'rejected'; updates[`paymentRequests/${requestId}/rejectionReason`] = reason; updates[`users/${userId}/points`] = (s.val() || 0) + points; updates[`users/${userId}/transactions/${db.ref().push().key}`] = { amount: points, description: `Refund for rejected withdrawal`, type: 'withdrawal_refund', timestamp: firebase.database.ServerValue.TIMESTAMP }; db.ref().update(updates).then(() => alert("Request rejected and points refunded.")); }); } });

    document.getElementById('settingsForm').addEventListener('submit', e => { e.preventDefault(); const settings = { joinBonus: parseInt(document.getElementById('settingJoinBonus').value), dailyBonus: parseInt(document.getElementById('settingDailyBonus').value), referralBonus: parseInt(document.getElementById('settingReferralBonus').value), postCost: parseInt(document.getElementById('settingPostCost').value), minWithdrawal: parseInt(document.getElementById('settingMinWithdrawal').value), pointsToBdtRate: parseInt(document.getElementById('settingPointsToBdt').value), paymentNumber: document.getElementById('settingPaymentNumber').value, privacyPolicy: document.getElementById('settingPrivacyPolicy').value, terms: document.getElementById('settingTerms').value }; db.ref('settings').set(settings).then(() => alert('Settings saved!')); });
});
