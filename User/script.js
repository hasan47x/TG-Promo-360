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
    // ===            2. DOM ELEMENT SELECTORS           ===
    // =======================================================
    const globalLoader = document.getElementById('globalLoader');
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    const headerSectionTitle = document.getElementById('headerSectionTitle');
    const allSections = document.querySelectorAll('.section');
    const navItems = document.querySelectorAll('.nav-item, .nav-link');
    const bsOffcanvas = new bootstrap.Offcanvas('#sideMenu');
    let bsPostDetailsModal, bsSetEmailPasswordModal;

    // =======================================================
    // ===        3. AUTHENTICATION STATE OBSERVER         ===
    // =======================================================
    auth.onAuthStateChanged(user => {
        globalLoader.style.display = 'flex';
        if (user) {
            initializeUser(user);
        } else {
            if (isTelegram()) {
                // এখানে আপনার ব্যাকএন্ড ফাংশন কল করে কাস্টম টোকেন দিয়ে লগইন করানোর কোড থাকবে।
                // এই ফাংশনটি আপনাকে Firebase Cloud Functions দিয়ে তৈরি করতে হবে।
                // handleTelegramAutoLogin(); 
                console.warn("Telegram auto-login requires a backend. Showing manual login.");
                showAuthUI(); // ফলব্যাক হিসেবে লগইন পেজ দেখানো
            } else {
                showAuthUI();
            }
        }
    });

    function isTelegram() {
        return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
    }

    // =======================================================
    // ===        4. UI & NAVIGATION MANAGEMENT          ===
    // =======================================================
    function showAuthUI() {
        appContainer.style.display = 'none';
        authContainer.style.display = 'flex';
        globalLoader.style.display = 'none';
        document.body.classList.add('ready');
    }

    function showAppUI() {
        authContainer.style.display = 'none';
        appContainer.style.display = 'block';
        globalLoader.style.display = 'none';
        bsPostDetailsModal = new bootstrap.Modal(document.getElementById('postDetailsModal'));
        bsSetEmailPasswordModal = new bootstrap.Modal(document.getElementById('setEmailPasswordModal'));
        document.body.classList.add('ready');
        navigateToSection('home-section');
    }

    function navigateToSection(sectionId) {
        allSections.forEach(section => section.classList.remove('active'));
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
            const title = activeSection.querySelector('.section-title')?.textContent || sectionId.replace(/-section/g, '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            headerSectionTitle.textContent = title;
            updateNavActiveState(sectionId);
        }
        bsOffcanvas.hide();
    }

    function updateNavActiveState(sectionId) {
        navItems.forEach(nav => {
            nav.classList.toggle('active', nav.dataset.section === sectionId);
        });
    }

    document.body.addEventListener('click', e => {
        const navElement = e.target.closest('[data-section]');
        if (navElement) {
            e.preventDefault();
            navigateToSection(navElement.dataset.section);
        }
    });

    // =======================================================
    // ===     5. USER INITIALIZATION & DATA FETCHING    ===
    // =======================================================
    function initializeUser(user) {
        const userRef = db.ref(`users/${user.uid}`);
        userRef.on('value', snapshot => {
            if (!snapshot.exists()) {
                const tgUser = isTelegram() ? window.Telegram.WebApp.initDataUnsafe.user : null;
                const newUser = {
                    name: user.displayName || (tgUser ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim() : 'New User'),
                    email: user.email,
                    photoUrl: user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'N A'}&background=random`,
                    points: 50,
                    joinDate: firebase.database.ServerValue.TIMESTAMP,
                    telegramId: tgUser ? tgUser.id : null,
                    lastDailyBonus: 0
                };
                userRef.set(newUser).then(() => updateUIWithUserData(newUser, user.uid));
            } else {
                updateUIWithUserData(snapshot.val(), user.uid);
            }
            fetchMyPosts(user.uid);
            fetchTransactions(user.uid);
        });
        fetchSystemSettings();
        fetchTags();
        showAppUI();
    }
    
    function updateUIWithUserData(userData, uid) {
        document.getElementById('headerUserPoints').textContent = userData.points || 0;
        document.getElementById('menuUserName').textContent = userData.name || 'Guest';
        document.getElementById('menuUserPic').src = userData.photoUrl;
        document.getElementById('menuUserTgId').textContent = `UID: ${uid.substring(0, 10)}...`;
        document.getElementById('homeUserName').textContent = userData.name || 'User';
        document.getElementById('profileName').textContent = userData.name || 'User Name';
        document.getElementById('profileAvatar').src = userData.photoUrl;
        document.getElementById('profileId').textContent = `UID: ${uid}`;
        document.getElementById('walletPointsDisplay').innerHTML = `${userData.points || 0} <i class="bi bi-coin text-warning"></i>`;
        updateDailyBonusUI(userData.lastDailyBonus);
        updateAccountLinkingUI(userData);
    }

    function updateAccountLinkingUI(userData) {
        const emailDisplay = document.getElementById('emailAccountDisplay');
        const telegramDisplay = document.getElementById('telegramAccountDisplay');
        const setupEmailBtn = document.getElementById('setupEmailPasswordBtn');
        const connectTelegramBtn = document.getElementById('connectTelegramBtn');

        if (auth.currentUser.email) {
            emailDisplay.style.display = 'flex';
            document.getElementById('emailSpan').textContent = auth.currentUser.email;
            setupEmailBtn.style.display = 'none';
        } else {
            emailDisplay.style.display = 'none';
            setupEmailBtn.style.display = 'block';
        }

        if (userData.telegramId) {
            telegramDisplay.style.display = 'flex';
            document.getElementById('telegramIdSpan').textContent = `ID: ${userData.telegramId}`;
            connectTelegramBtn.style.display = 'none';
        } else {
            telegramDisplay.style.display = 'none';
            connectTelegramBtn.style.display = isTelegram() ? 'block' : 'none';
        }
    }

    // =======================================================
    // ===             6. AUTHENTICATION FORMS           ===
    // =======================================================
    document.getElementById('emailSignupForm').addEventListener('submit', e => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        auth.createUserWithEmailAndPassword(email, password)
            .then(cred => cred.user.updateProfile({ displayName: name }))
            .catch(err => alert(`Signup Failed: ${err.message}`));
    });

    document.getElementById('emailLoginForm').addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        auth.signInWithEmailAndPassword(email, password).catch(err => alert(`Login Failed: ${err.message}`));
    });

    document.getElementById('logoutButton').addEventListener('click', e => {
        e.preventDefault();
        auth.signOut();
    });

    document.getElementById('switchToSignup').addEventListener('click', () => {
        document.getElementById('webLoginCard').style.display = 'none';
        document.getElementById('webSignupCard').style.display = 'block';
    });
    document.getElementById('switchToLogin').addEventListener('click', () => {
        document.getElementById('webSignupCard').style.display = 'none';
        document.getElementById('webLoginCard').style.display = 'block';
    });

    // =======================================================
    // ===        7. ACCOUNT LINKING & MANAGEMENT        ===
    // =======================================================
    document.getElementById('connectTelegramBtn').addEventListener('click', e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user || !isTelegram()) return alert("This action is only available inside Telegram.");
        const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
        if (tgUser) {
            db.ref(`users/${user.uid}/telegramId`).set(tgUser.id)
              .then(() => alert(`Telegram ID ${tgUser.id} linked successfully!`))
              .catch(err => alert(`Failed to link Telegram: ${err.message}`));
        }
    });

    document.getElementById('saveEmailPasswordBtn').addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) return;
        const email = document.getElementById('userEmail').value;
        const password = document.getElementById('newUserPassword').value;
        if (!email || password.length < 6) return alert("Please provide a valid email and a password of at least 6 characters.");
        
        user.updateEmail(email)
            .then(() => user.updatePassword(password))
            .then(() => db.ref(`users/${user.uid}/email`).set(email))
            .then(() => {
                alert('Web login credentials set successfully!');
                bsSetEmailPasswordModal.hide();
                document.getElementById('setEmailPasswordForm').reset();
            })
            .catch(err => alert(`Failed to update credentials: ${err.message}`));
    });

    // =======================================================
    // ===             8. CORE APP FEATURES              ===
    // =======================================================
    
    // --- Theme Switcher ---
    const themeSwitch = document.getElementById('themeSwitch');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-mode', currentTheme === 'light');
    themeSwitch.checked = currentTheme === 'light';
    themeSwitch.addEventListener('change', e => {
        localStorage.setItem('theme', e.target.checked ? 'light' : 'dark');
        document.body.classList.toggle('light-mode', e.target.checked);
    });

    // --- System Settings & Tags ---
    function fetchSystemSettings() {
        db.ref('settings').on('value', snapshot => {
            const settings = snapshot.val();
            if (settings) {
                document.getElementById('estimatedCost').textContent = settings.postCost || 100;
                document.getElementById('privacyPolicyContent').innerHTML = settings.privacyPolicy || '<p>Not available.</p>';
                document.getElementById('termsContent').innerHTML = settings.terms || '<p>Not available.</p>';
            }
        });
    }

    function fetchTags() {
        db.ref('tags').on('value', snapshot => {
            const tagsContainer = document.getElementById('postTagsContainer');
            tagsContainer.innerHTML = '';
            if (snapshot.exists()) {
                Object.keys(snapshot.val()).forEach(tagName => {
                    tagsContainer.innerHTML += `<button type="button" class="tag-btn" data-tag="${tagName}">${tagName}</button>`;
                });
            }
        });
    }

    // --- Create Post Logic ---
    document.getElementById('postTagsContainer').addEventListener('click', e => {
        if (e.target.classList.contains('tag-btn')) {
            const selectedCount = document.querySelectorAll('.tag-btn.selected').length;
            if (e.target.classList.contains('selected')) {
                e.target.classList.remove('selected');
            } else if (selectedCount < 3) {
                e.target.classList.add('selected');
            } else {
                alert('You can select up to 3 tags.');
            }
        }
    });

    document.getElementById('addCustomButtonSwitch').addEventListener('change', e => {
        document.getElementById('customButtonFields').style.display = e.target.checked ? 'block' : 'none';
    });

    document.querySelectorAll('input[name="scheduleOption"]').forEach(radio => {
        radio.addEventListener('change', () => {
            document.getElementById('scheduleTimeFields').style.display = document.getElementById('postLater').checked ? 'block' : 'none';
        });
    });

    document.getElementById('createPostForm').addEventListener('submit', e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return alert('You must be logged in.');
        const content = document.getElementById('postContent').value.trim();
        const tags = Array.from(document.querySelectorAll('.tag-btn.selected')).map(btn => btn.dataset.tag);
        if (!content || tags.length === 0) return alert('Post content and at least one tag are required.');

        const postData = { userId: user.uid, userName: user.displayName, content, tags, status: 'pending', createdAt: firebase.database.ServerValue.TIMESTAMP };
        if (document.getElementById('addCustomButtonSwitch').checked) {
            const text = document.getElementById('buttonText').value.trim();
            const url = document.getElementById('buttonUrl').value.trim();
            if (text && url) postData.customButton = { text, url };
        }
        if (document.getElementById('postLater').checked) {
            const scheduleTime = document.getElementById('scheduleDateTime').value;
            if (scheduleTime) {
                postData.status = 'scheduled';
                postData.scheduleTime = new Date(scheduleTime).getTime();
            }
        }

        db.ref('posts').push(postData)
            .then(() => {
                alert('Post submitted for review!');
                e.target.reset();
                navigateToSection('posts-section');
            })
            .catch(err => alert('Error: ' + err.message));
    });

    // --- Fetch & Display Data (Posts, Transactions) ---
    function fetchMyPosts(uid) {
        db.ref('posts').orderByChild('userId').equalTo(uid).on('value', snapshot => {
            const container = document.getElementById('myPostsContainer');
            container.innerHTML = '';
            if (!snapshot.exists()) {
                container.innerHTML = '<p class="text-center text-secondary">You haven\'t created any posts yet.</p>';
                return;
            }
            snapshot.forEach(child => {
                const post = child.val();
                const postId = child.key;
                const statusColors = { pending: 'warning', approved: 'info', published: 'success', rejected: 'danger', scheduled: 'primary' };
                const card = `
                    <div class="custom-card post-item-card status-${post.status}" data-post-id="${postId}">
                        <div class="post-item-header">
                            <h6 class="mb-0">${post.content.substring(0, 30)}...</h6>
                            <span class="badge bg-${statusColors[post.status] || 'secondary'}">${post.status}</span>
                        </div>
                        <p class="post-item-content text-secondary">Tags: ${post.tags.join(', ')}</p>
                        <small class="text-secondary">Submitted: ${new Date(post.createdAt).toLocaleDateString()}</small>
                    </div>`;
                container.insertAdjacentHTML('afterbegin', card);
            });
        });
    }

    document.getElementById('myPostsContainer').addEventListener('click', e => {
        const card = e.target.closest('.post-item-card');
        if (card) {
            const postId = card.dataset.postId;
            db.ref(`posts/${postId}`).once('value', snapshot => {
                const post = snapshot.val();
                let body = `<p><strong>Content:</strong><br><div class="p-2 bg-dark bg-opacity-10 rounded">${post.content}</div></p>
                            <p><strong>Status:</strong> ${post.status}</p>`;
                if (post.rejectionReason) body += `<p class="rejection-reason mt-2"><strong>Reason for Rejection:</strong><br>${post.rejectionReason}</p>`;
                document.getElementById('postDetailsModalBody').innerHTML = body;
                bsPostDetailsModal.show();
            });
        }
    });

    function fetchTransactions(uid) {
        db.ref(`users/${uid}/transactions`).limitToLast(20).on('value', snapshot => {
            const container = document.getElementById('transactionListContainer');
            container.innerHTML = '';
            if (!snapshot.exists()) {
                container.innerHTML = '<p class="text-center text-secondary p-3">No transactions found.</p>';
                return;
            }
            snapshot.forEach(child => {
                const tx = child.val();
                const item = `<div class="list-group-item transaction-item">
                                <div class="d-flex w-100 justify-content-between"><h6>${tx.description || 'Transaction'}</h6><small>${new Date(tx.timestamp).toLocaleDateString()}</small></div>
                                <strong class="${tx.amount > 0 ? 'text-success' : 'text-danger'}">${tx.amount > 0 ? '+' : ''}${tx.amount} Points</strong>
                              </div>`;
                container.insertAdjacentHTML('afterbegin', item);
            });
        });
    }

    // --- Daily Bonus Logic ---
    function updateDailyBonusUI(lastBonusTime) {
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const badge = document.getElementById('dailyBonusBadge');
        const link = document.getElementById('dailyBonusLink');

        if (now - (lastBonusTime || 0) > twentyFourHours) {
            badge.textContent = 'Claim Now';
            badge.className = 'badge rounded-pill bg-success';
            link.style.pointerEvents = 'auto';
            link.style.opacity = '1';
        } else {
            const timeLeft = twentyFourHours - (now - lastBonusTime);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            badge.textContent = `Wait ${hours}h`;
            badge.className = 'badge rounded-pill bg-secondary';
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.6';
        }
    }

    document.getElementById('dailyBonusLink').addEventListener('click', e => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;
        
        db.ref('settings/dailyBonus').once('value', bonusSnapshot => {
            const bonusAmount = bonusSnapshot.val() || 20;
            const userRef = db.ref(`users/${user.uid}`);
            userRef.transaction(userData => {
                if (userData) {
                    const now = Date.now();
                    if (now - (userData.lastDailyBonus || 0) > 24 * 60 * 60 * 1000) {
                        userData.points = (userData.points || 0) + bonusAmount;
                        userData.lastDailyBonus = now;
                        if (!userData.transactions) userData.transactions = {};
                        const newTxKey = db.ref().child('transactions').push().key;
                        userData.transactions[newTxKey] = {
                            type: 'daily_bonus', description: 'Daily bonus claimed', amount: bonusAmount, timestamp: firebase.database.ServerValue.TIMESTAMP
                        };
                    } else { return; } // Abort transaction
                }
                return userData;
            }, (error, committed) => {
                if (error) alert('Transaction failed: ' + error);
                else if (committed) alert(`You have received ${bonusAmount} points!`);
                else alert('You have already claimed your bonus today.');
            });
        });
    });
});