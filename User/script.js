// =======================================================
// ===               INITIALIZATION                    ===
// =======================================================
document.addEventListener('DOMContentLoaded', () => {
    // Firebase v8 Configuration
    // IMPORTANT: Replace with your actual Firebase project configuratin
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
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // App State
    let currentUserData = null;
    let currentUserAuth = null;
    let settings = {};

    // DOM Elements
    const globalLoader = document.getElementById('globalLoader');
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');

    // Environment Detection
    const isTelegram = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;

    if (isTelegram) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        handleTelegramLogin();
    } else {
        handleWebBrowserLogin();
    }

    // =======================================================
    // ===            AUTHENTICATION HANDLERS              ===
    // =======================================================

    function handleTelegramLogin() {
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        if (!tgUser) {
            showError("Could not verify Telegram user.");
            globalLoader.style.display = 'none';
            return;
        }
        const userId = tgUser.id.toString();
        const userRef = db.ref(`users/${userId}`);
        userRef.once('value', snapshot => {
            if (snapshot.exists()) {
                currentUserData = { id: userId, ...snapshot.val() };
                if (!currentUserData.password) {
                    new bootstrap.Modal(document.getElementById('setPasswordModal')).show();
                }
                initializeApp(currentUserData);
            } else {
                const newUser = {
                    name: `${tgUser.first_name} ${tgUser.last_name || ''}`.trim(),
                    username: tgUser.username || '',
                    tgId: userId,
                    photoUrl: tgUser.photo_url || 'https://via.placeholder.com/80',
                    points: 100, // Join Bonus
                    joined: firebase.database.ServerValue.TIMESTAMP,
                };
                userRef.set(newUser).then(() => {
                    db.ref(`users/${userId}/transactions`).push({ type: 'bonus', amount: 100, reason: 'Join Bonus', timestamp: firebase.database.ServerValue.TIMESTAMP });
                    currentUserData = { id: userId, ...newUser };
                    new bootstrap.Modal(document.getElementById('setPasswordModal')).show();
                    initializeApp(currentUserData);
                });
            }
        });
    }

    function handleWebBrowserLogin() {
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUserAuth = user;
                const userRef = db.ref(`users/${user.uid}`);
                userRef.once('value', snapshot => {
                    if (snapshot.exists()) {
                        currentUserData = { id: user.uid, ...snapshot.val() };
                        initializeApp(currentUserData);
                    } else {
                        const newUser = {
                            name: user.displayName || 'New User',
                            email: user.email,
                            photoUrl: user.photoURL || 'https://via.placeholder.com/80',
                            points: 100, // Join Bonus
                            joined: firebase.database.ServerValue.TIMESTAMP,
                        };
                        userRef.set(newUser).then(() => {
                            db.ref(`users/${user.uid}/transactions`).push({ type: 'bonus', amount: 100, reason: 'Join Bonus', timestamp: firebase.database.ServerValue.TIMESTAMP });
                            currentUserData = { id: user.uid, ...newUser };
                            initializeApp(currentUserData);
                        });
                    }
                });
            } else {
                globalLoader.style.display = 'none';
                appContainer.style.display = 'none';
                authContainer.style.display = 'flex';
                document.body.style.padding = '0';
            }
        });
        setupWebAuthListeners();
    }
    
    function setupWebAuthListeners() {
        const webLoginCard = document.getElementById('webLoginCard');
        const webSignupCard = document.getElementById('webSignupCard');
        const telegramLoginCard = document.getElementById('telegramLoginCard');

        document.getElementById('emailLoginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            globalLoader.style.display = 'flex';
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            auth.signInWithEmailAndPassword(email, password).catch(error => {
                globalLoader.style.display = 'none';
                showError(error.message);
            });
        });

        document.getElementById('emailSignupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            globalLoader.style.display = 'flex';
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            if (name.trim().length < 2) {
                globalLoader.style.display = 'none';
                return showError("Please enter a valid name.");
            }
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => userCredential.user.updateProfile({ displayName: name }))
                .catch(error => {
                    globalLoader.style.display = 'none';
                    showError(error.message);
                });
        });

        document.getElementById('googleSignInBtn').addEventListener('click', () => {
            globalLoader.style.display = 'flex';
            auth.signInWithPopup(googleProvider).catch(error => {
                globalLoader.style.display = 'none';
                showError(error.message);
            });
        });
        
        document.getElementById('telegramLoginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            globalLoader.style.display = 'flex';
            const tgIdentifier = document.getElementById('tgUsername').value;
            const password = document.getElementById('tgPassword').value;
            db.ref('users').orderByChild('tgId').equalTo(tgIdentifier).once('value', snapshot => {
                if(snapshot.exists()){
                     handleTgLoginAttempt(snapshot, password);
                } else {
                     db.ref('users').orderByChild('username').equalTo(tgIdentifier).once('value', snap => {
                        if(snap.exists()){ handleTgLoginAttempt(snap, password); } 
                        else { globalLoader.style.display = 'none'; showError("User not found."); }
                    });
                }
            });
        });

        document.getElementById('switchToSignup').addEventListener('click', (e) => { e.preventDefault(); webLoginCard.style.display = 'none'; telegramLoginCard.style.display = 'none'; webSignupCard.style.display = 'block'; });
        document.getElementById('switchToLogin').addEventListener('click', (e) => { e.preventDefault(); webSignupCard.style.display = 'none'; telegramLoginCard.style.display = 'none'; webLoginCard.style.display = 'block'; });
        document.getElementById('switchToTgLoginFromLogin').addEventListener('click', (e) => { e.preventDefault(); webLoginCard.style.display = 'none'; webSignupCard.style.display = 'none'; telegramLoginCard.style.display = 'block'; });
        document.getElementById('switchToWebLogin').addEventListener('click', (e) => { e.preventDefault(); telegramLoginCard.style.display = 'none'; webSignupCard.style.display = 'none'; webLoginCard.style.display = 'block'; });
    }

    function handleTgLoginAttempt(snapshot, password){
        const userId = Object.keys(snapshot.val())[0];
        const userData = snapshot.val()[userId];
        if (userData.password && userData.password === password) {
             currentUserData = { id: userId, ...userData };
             initializeApp(currentUserData);
        } else {
            globalLoader.style.display = 'none';
            showError("Invalid password.");
        }
    }

    // =======================================================
    // ===             MAIN APP LOGIC                      ===
    // =======================================================

    function initializeApp(userData) {
        authContainer.style.display = 'none';
        globalLoader.style.display = 'none';
        appContainer.style.display = 'block';
        document.body.style.paddingTop = '75px';
        document.body.style.paddingBottom = '75px';
        document.body.classList.add('ready');

        db.ref('settings').once('value', (snapshot) => {
            settings = snapshot.val() || { postCost: 100, dailyBonus: 20 };
            const estimatedCostEl = document.getElementById('estimatedCost');
            if(estimatedCostEl) estimatedCostEl.textContent = settings.postCost || 100;

            buildSideMenu();
            updateUserInfoUI(userData);
            setupNavigation();
            loadDynamicContent();
            setupEventListeners();
            navigateToSection('home-section');
        });
    }

    function updateUserInfoUI(userData) {
        document.getElementById('headerUserPoints').textContent = userData.points || 0;
        document.getElementById('menuUserName').textContent = userData.name || 'Guest';
        document.getElementById('menuUserPic').src = userData.photoUrl || 'https://via.placeholder.com/80';
        document.getElementById('menuUserTgId').textContent = `ID: ${userData.tgId || userData.id}`;
        document.getElementById('profileName').textContent = userData.name || 'User';
        document.getElementById('profileAvatar').src = userData.photoUrl || 'https://via.placeholder.com/80';
        document.getElementById('profileId').textContent = `ID: ${userData.tgId || userData.id}`;
        document.getElementById('walletPointsDisplay').textContent = userData.points || 0;
        updateAccountLinkingUI(userData);
    }
    
    function updateAccountLinkingUI(userData) {
        const connectGoogleLink = document.getElementById('connectGoogleLink');
        const connectTelegramLink = document.getElementById('connectTelegramLink');
        const connectedGoogleAccount = document.getElementById('connectedGoogleAccount');
        const connectedTelegramAccount = document.getElementById('connectedTelegramAccount');
        
        if (currentUserAuth && currentUserAuth.providerData.some(p => p.providerId === 'google.com')) {
            connectGoogleLink.style.display = 'none';
            connectedGoogleAccount.style.display = 'flex';
            document.getElementById('googleEmailSpan').textContent = currentUserAuth.email;
        } else if (currentUserAuth) {
             connectGoogleLink.style.display = 'flex';
             connectedGoogleAccount.style.display = 'none';
        } else {
            connectGoogleLink.style.display = 'none';
            connectedGoogleAccount.style.display = 'none';
        }
        if (userData.tgId) {
            connectTelegramLink.style.display = 'none';
            connectedTelegramAccount.style.display = 'flex';
            document.getElementById('telegramIdSpan').textContent = `ID: ${userData.tgId}`;
        } else {
            connectTelegramLink.style.display = 'flex';
            connectedTelegramAccount.style.display = 'none';
        }
    }

    function buildSideMenu() {
        const menuItems = [
            { icon: 'bi-house-door-fill', text: 'Home', section: 'home-section' },
            { icon: 'bi-gem', text: 'Earn Points', section: 'earn-section' },
            { icon: 'bi-collection-fill', text: 'My Content', section: 'posts-section' },
            { icon: 'bi-wallet2', text: 'My Wallet', section: 'wallet-section' },
            { icon: 'bi-person-fill', text: 'My Profile', section: 'profile-section' },
        ];
        const menuContainer = document.getElementById('sideNavMenu');
        menuContainer.innerHTML = '';
        menuItems.forEach(item => {
            menuContainer.innerHTML += `
                <li>
                    <a class="nav-link" data-section="${item.section}">
                        <i class="bi ${item.icon}"></i> ${item.text}
                    </a>
                </li>
            `;
        });
    }

    function setupNavigation() {
        document.querySelectorAll('.nav-item, .menu-nav .nav-link, [data-section]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = link.dataset.section;
                if (sectionId) {
                    navigateToSection(sectionId);
                    const offcanvasEl = document.getElementById('sideMenu');
                    const offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
                    if (offcanvas) offcanvas.hide();
                }
            });
        });
    }

    function navigateToSection(sectionId) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
            const link = document.querySelector(`[data-section="${sectionId}"]`);
            const title = link ? (link.querySelector('span')?.textContent || link.textContent.trim().replace(/<[^>]*>?/gm, '').split(" ").pop()) : 'Dashboard';
            document.getElementById('headerSectionTitle').textContent = title;
            document.querySelectorAll('.nav-item, .menu-nav .nav-link').forEach(nav => {
                nav.classList.toggle('active', nav.dataset.section === sectionId);
            });
        }
    }
    
    function loadDynamicContent() {
        loadHomePage();
        loadMyPosts();
        loadTransactions();
        loadTags();
        db.ref(`users/${currentUserData.id}/points`).on('value', (snapshot) => {
            const points = snapshot.val() || 0;
            currentUserData.points = points;
            document.getElementById('headerUserPoints').textContent = points;
            document.getElementById('walletPointsDisplay').textContent = points;
        });
    }

    function loadHomePage() {
        const homeSection = document.getElementById('home-section');
        homeSection.innerHTML = `
            <div class="custom-card text-center">
                <h4 class="mb-1">Welcome, ${currentUserData.name}!</h4>
                <p class="text-secondary">Ready to promote your content?</p>
                <div class="d-grid gap-2 mt-4">
                    <button class="btn btn-primary btn-lg" data-section="create-post-section">
                        <i class="bi bi-plus-circle-fill me-2"></i>Create a New Post
                    </button>
                    <button class="btn btn-outline-warning" data-section="wallet-section">
                        <i class="bi bi-wallet2 me-2"></i>View My Wallet
                    </button>
                </div>
            </div>
            <div class="custom-card">
                 <h5>Recent Activity</h5>
                 <div id="home-transactions"></div>
            </div>
        `;
        // Load recent transactions for home page
        db.ref(`users/${currentUserData.id}/transactions`).orderByChild('timestamp').limitToLast(3).once('value', snapshot => {
            const container = document.getElementById('home-transactions');
            if(!container) return;
            container.innerHTML = '';
            let transactionsHtml = '';
            snapshot.forEach(child => {
                const t = child.val();
                const isBonus = t.type === 'bonus';
                transactionsHtml = `
                    <div class="d-flex justify-content-between align-items-center border-bottom py-2">
                        <span>${t.reason}</span>
                        <span class="fw-bold text-${isBonus ? 'success' : 'danger'}">${isBonus ? '+' : '-'}${t.amount}</span>
                    </div>
                ` + transactionsHtml;
            });
            container.innerHTML = transactionsHtml || '<p class="text-secondary text-center">No recent activity.</p>';
        });
    }

    function loadTags() {
        const tagsContainer = document.getElementById('postTagsContainer');
        if (!tagsContainer) return;
        
        db.ref('tags').on('value', snapshot => {
            tagsContainer.innerHTML = '';
            if (snapshot.exists()) {
                snapshot.forEach(child => {
                    tagsContainer.innerHTML += `<button type="button" class="tag-btn" data-tag="${child.key}">#${child.val().name}</button>`;
                });
                tagsContainer.addEventListener('click', e => {
                    if (e.target.classList.contains('tag-btn')) {
                        const selectedCount = tagsContainer.querySelectorAll('.selected').length;
                        if (!e.target.classList.contains('selected') && selectedCount >= 3) {
                            showError("You can select up to 3 tags only.");
                            return;
                        }
                        e.target.classList.toggle('selected');
                    }
                });
            }
        });
    }

    function loadMyPosts() {
        const postsContainer = document.getElementById('myPostsContainer');
        if (!postsContainer) return;
        
        const userPostsRef = db.ref(`users/${currentUserData.id}/posts`).orderByValue();
        userPostsRef.on('value', snapshot => {
            postsContainer.innerHTML = '<p class="text-center text-secondary">Loading your posts...</p>';
            if (!snapshot.exists()) {
                postsContainer.innerHTML = '<p class="text-center text-secondary">You have not created any posts yet.</p>';
                return;
            }
            postsContainer.innerHTML = '';
            let postPromises = [];
            snapshot.forEach(childSnapshot => {
                const postId = childSnapshot.key;
                postPromises.push(db.ref(`posts/${postId}`).once('value'));
            });
            Promise.all(postPromises.reverse()).then(results => {
                postsContainer.innerHTML = '';
                results.forEach(postSnap => {
                    const post = postSnap.val();
                    if(post) {
                        const postDate = new Date(post.createdAt).toLocaleDateString();
                        const statusClass = `status-${post.status}`;
                        const statusColor = post.status === 'approved' ? 'success' : post.status === 'pending' ? 'warning' : 'danger';
                        postsContainer.innerHTML += `
                            <div class="custom-card post-item-card ${statusClass}">
                                <div class="post-item-header">
                                    <span class="badge bg-secondary">${postDate}</span>
                                    <span class="badge bg-${statusColor} text-capitalize">${post.status}</span>
                                </div>
                                <p class="post-item-content">${post.content.substring(0, 100)}...</p>
                            </div>
                        `;
                    }
                });
            });
        });
    }

    function loadTransactions() {
        const container = document.getElementById('transactionListContainer');
        if (!container) return;
        
        db.ref(`users/${currentUserData.id}/transactions`).orderByChild('timestamp').on('value', snapshot => {
            container.innerHTML = '';
            if (!snapshot.exists()) {
                container.innerHTML = '<p class="text-center text-secondary">No transactions found.</p>';
                return;
            }
            let transactionsHtml = '';
            snapshot.forEach(child => {
                const t = child.val();
                const isBonus = t.type === 'bonus';
                transactionsHtml = `
                    <div class="list-group-item d-flex align-items-center">
                        <i class="bi ${isBonus ? 'bi-arrow-down-circle-fill text-success' : 'bi-arrow-up-circle-fill text-danger'} me-3"></i>
                        <div class="flex-grow-1">
                            <h6>${t.reason}</h6>
                            <small class="text-secondary">${new Date(t.timestamp).toLocaleString()}</small>
                        </div>
                        <h5 class="fw-bold text-${isBonus ? 'success' : 'danger'}">${isBonus ? '+' : '-'}${t.amount}</h5>
                    </div>
                ` + transactionsHtml;
            });
            container.innerHTML = transactionsHtml;
        });
    }

    function setupEventListeners() {
        document.getElementById('logoutButton').addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm("Are you sure you want to logout?")) {
                if (isTelegram) {
                    window.Telegram.WebApp.close();
                } else if (currentUserAuth) {
                    auth.signOut().then(() => window.location.reload());
                } else {
                    window.location.reload();
                }
            }
        });

        document.getElementById('themeSwitch').addEventListener('change', (e) => {
            document.body.classList.toggle('light-mode', e.target.checked);
        });
        
        document.getElementById('savePasswordBtn').addEventListener('click', () => {
            const newPassword = document.getElementById('newUserPassword').value;
            const confirmPassword = document.getElementById('confirmNewUserPassword').value;
            if (newPassword.length < 6) return showError("Password must be at least 6 characters long.");
            if (newPassword !== confirmPassword) return showError("Passwords do not match.");
            db.ref(`users/${currentUserData.id}/password`).set(newPassword).then(() => {
                bootstrap.Modal.getInstance(document.getElementById('setPasswordModal')).hide();
                showSuccess("Password set successfully!");
            });
        });

        document.getElementById('connectGoogleLink').addEventListener('click', (e) => {
             e.preventDefault();
             if(currentUserAuth){
                currentUserAuth.linkWithPopup(googleProvider).then(result => {
                    showSuccess('Google account linked successfully!');
                    db.ref(`users/${result.user.uid}/email`).set(result.user.email);
                    updateAccountLinkingUI(currentUserData);
                }).catch(error => showError(`Could not link account: ${error.message}`));
             }
        });

        const createPostForm = document.getElementById('createPostForm');
        if (createPostForm) {
            createPostForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const postCost = settings.postCost || 100;
                if(currentUserData.points < postCost) { return showError(`You need at least ${postCost} points to create a post.`); }
                const content = document.getElementById('postContent').value.trim();
                if(!content) return showError("Post content cannot be empty.");
                const selectedTags = Array.from(document.querySelectorAll('#postTagsContainer .tag-btn.selected')).map(btn => btn.dataset.tag);
                if(selectedTags.length === 0) return showError("Please select at least one tag.");

                const postData = { userId: currentUserData.id, userName: currentUserData.name, content: content, tags: selectedTags, status: 'pending', createdAt: firebase.database.ServerValue.TIMESTAMP };
                const newPostKey = db.ref('posts').push().key;
                const updates = {};
                updates[`/posts/${newPostKey}`] = postData;
                updates[`/users/${currentUserData.id}/posts/${newPostKey}`] = true;
                updates[`/users/${currentUserData.id}/points`] = currentUserData.points - postCost;
                const transactionData = { type: 'expense', amount: postCost, reason: 'Created a new post', timestamp: firebase.database.ServerValue.TIMESTAMP };
                const newTransactionKey = db.ref(`users/${currentUserData.id}/transactions`).push().key;
                updates[`/users/${currentUserData.id}/transactions/${newTransactionKey}`] = transactionData;

                db.ref().update(updates).then(() => {
                    showSuccess("Post submitted for review!");
                    createPostForm.reset();
                    document.querySelectorAll('#postTagsContainer .tag-btn.selected').forEach(b => b.classList.remove('selected'));
                    navigateToSection('posts-section');
                }).catch(error => showError("Could not create post: " + error.message));
            });
        }

        const dailyBonusLink = document.getElementById('dailyBonusLink');
        if (dailyBonusLink) {
            dailyBonusLink.addEventListener('click', (e) => {
                e.preventDefault();
                const now = Date.now();
                const lastBonusTime = currentUserData.lastDailyBonus || 0;
                const twentyFourHours = 24 * 60 * 60 * 1000;

                if (now - lastBonusTime > twentyFourHours) {
                    const bonusAmount = settings.dailyBonus || 20;
                    const updates = {};
                    updates[`/users/${currentUserData.id}/points`] = currentUserData.points + bonusAmount;
                    updates[`/users/${currentUserData.id}/lastDailyBonus`] = now;
                    const transactionData = { type: 'bonus', amount: bonusAmount, reason: 'Daily Bonus', timestamp: now };
                    const newTransactionKey = db.ref(`users/${currentUserData.id}/transactions`).push().key;
                    updates[`/users/${currentUserData.id}/transactions/${newTransactionKey}`] = transactionData;
                    
                    db.ref().update(updates).then(() => {
                        showSuccess(`You received ${bonusAmount} points as a daily bonus!`);
                    });
                } else {
                    showError("You have already claimed your daily bonus. Please try again later.");
                }
            });
        }
    }

    function showError(message) { alert(`Error: ${message}`); console.error(message); }
    function showSuccess(message) { alert(`Success: ${message}`); }

});
