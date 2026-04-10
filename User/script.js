document.addEventListener('DOMContentLoaded', () => {
    // =======================================================
    // ===          1. FIREBASE INITIALIZATION           ===
    // =======================================================
    
    // অনুগ্রহ করে এখানে আপনার Firebase প্রজেক্টের কনফিগারেশন যুক্ত করুন।
    const firebaseConfig = {
    apiKey: "AIzaSyAe3TMK4RHmReffbhxZeYi5NuHgmJJWlTo",
    authDomain: "supchat-5474d.firebaseapp.com",
    databaseURL: "https://supchat-5474d-default-rtdb.firebaseio.com",
    projectId: "supchat-5474d",
    storageBucket: "supchat-5474d.appspot.com",
    messagingSenderId: "170794585438",
    appId: "1:170794585438:web:da9cb1f6d7cc3408b493cf"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();
    const googleProvider = new firebase.auth.GoogleAuthProvider();

    // =======================================================
    // ===            2. DOM ELEMENT SELECTORS           ===
    // =======================================================
    const globalLoader = document.getElementById('globalLoader');
    const authContainer = document.getElementById('authContainer');
    const appContainer = document.getElementById('appContainer');
    
    // UI elements
    const headerSectionTitle = document.getElementById('headerSectionTitle');
    const sections = document.querySelectorAll('.section');
    const navButtons = document.querySelectorAll('.nav-item');
    const sideNavLinks = document.querySelectorAll('#sideNavMenu .nav-link');
    const bsOffcanvas = new bootstrap.Offcanvas('#sideMenu');

    // =======================================================
    // ===        3. AUTHENTICATION STATE OBSERVER         ===
    // =======================================================
    // এটি অ্যাপের মূল চালক। ব্যবহারকারী লগইন বা লগআউট করলে এটি ট্রিগার হয়।
    auth.onAuthStateChanged(user => {
        globalLoader.style.display = 'flex'; // লোডার দেখান
        if (user) {
            // ব্যবহারকারী লগইন করা আছে
            console.log("User is signed in:", user.uid);
            initializeUser(user);
        } else {
            // ব্যবহারকারী লগইন করা নেই
            console.log("User is signed out.");
            // টেলিগ্রাম অ্যাপের ভিতর কিনা চেক করুন
            if (isTelegram()) {
                 // টেলিগ্রামের মাধ্যমে স্বয়ংক্রিয় লগইনের জন্য এখানে কোড লিখতে হবে (ব্যাকএন্ড প্রয়োজন)।
                 // আপাতত, টেলিগ্রাম ব্যবহারকারীকেও লগইন পেজ দেখানো হবে যদি তারা লগইন করা না থাকে।
                 console.log("Inside Telegram, but user is not authenticated. Showing auth page.");
                 showAuthUI();
            } else {
                // সাধারণ ব্রাউজার, লগইন পেজ দেখান
                showAuthUI();
            }
        }
    });

    function isTelegram() {
        return window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData;
    }

    // =======================================================
    // ===        4. UI MANAGEMENT FUNCTIONS             ===
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
        document.body.classList.add('ready');
        navigateToSection('home-section'); // ডিফল্ট সেকশন হিসেবে হোম দেখান
    }
    
    // সেকশন পরিবর্তন করার ফাংশন
    function navigateToSection(sectionId) {
        sections.forEach(section => {
            section.classList.remove('active');
        });
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.classList.add('active');
            
            // 헤더 শিরোনাম পরিবর্তন
            const title = activeSection.querySelector('.section-title')?.textContent || sectionId.replace('-section', '').replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
            headerSectionTitle.textContent = title;

            // বটম ন্যাভিগেশন ও সাইড মেনু-এর অ্যাক্টিভ স্টেট আপডেট
            updateNavActiveState(sectionId);
        }
        bsOffcanvas.hide(); // মেনু খোলা থাকলে বন্ধ করুন
    }

    function updateNavActiveState(sectionId) {
        const navElements = [...navButtons, ...sideNavLinks];
        navElements.forEach(nav => {
            if (nav.dataset.section === sectionId) {
                nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        });
    }

    // ন্যাভিগেশন ইভেন্ট লিসেনার
    document.body.addEventListener('click', (e) => {
        const targetElement = e.target.closest('[data-section]');
        if (targetElement) {
            e.preventDefault();
            const sectionId = targetElement.dataset.section;
            navigateToSection(sectionId);
        }
    });

    // =======================================================
    // ===          5. USER INITIALIZATION & DATA        ===
    // =======================================================
    
    function initializeUser(user) {
        const userRef = db.ref(`users/${user.uid}`);
        
        userRef.on('value', (snapshot) => {
            const userData = snapshot.val();
            if (!userData) {
                // যদি ডাটাবেসে ব্যবহারকারীর তথ্য না থাকে (যেমন গুগল দিয়ে প্রথমবার লগইন)
                console.log("User data not found in DB, creating new entry.");
                const newUser = {
                    name: user.displayName || 'New User',
                    email: user.email,
                    photoUrl: user.photoURL || 'https://via.placeholder.com/80',
                    points: 50, // Welcome bonus
                    joinDate: firebase.database.ServerValue.TIMESTAMP,
                    lastDailyBonus: 0
                };
                userRef.set(newUser).then(() => {
                    updateUIWithUserData(newUser, user.uid);
                });
            } else {
                updateUIWithUserData(userData, user.uid);
            }
            
            // fetch user-specific data
            fetchMyPosts(user.uid);
            fetchTransactions(user.uid);
        });
        showAppUI();
    }

    function updateUIWithUserData(userData, uid) {
        // Header & Menu
        document.getElementById('headerUserPoints').textContent = userData.points || 0;
        document.getElementById('menuUserName').textContent = userData.name || 'Guest';
        document.getElementById('menuUserPic').src = userData.photoUrl || 'https://via.placeholder.com/80';
        document.getElementById('menuUserTgId').textContent = `UID: ${uid.substring(0, 10)}...`;

        // Home
        document.getElementById('homeUserName').textContent = userData.name || 'User';

        // Profile
        document.getElementById('profileName').textContent = userData.name || 'User Name';
        document.getElementById('profileAvatar').src = userData.photoUrl || 'https://via.placeholder.com/80';
        document.getElementById('profileId').textContent = `UID: ${uid}`;
        
        // Wallet
        document.getElementById('walletPointsDisplay').innerHTML = `${userData.points || 0} <i class="bi bi-coin text-warning"></i>`;

        // Daily Bonus
        updateDailyBonusUI(userData.lastDailyBonus);
    }

    // =======================================================
    // ===             6. AUTHENTICATION FORMS           ===
    // =======================================================

    // Signup Form
    document.getElementById('emailSignupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        auth.createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;
                return user.updateProfile({ displayName: name }).then(() => user);
            })
            .then((user) => {
                // ডাটাবেসে নতুন ব্যবহারকারীর তথ্য তৈরি করা হবে `onAuthStateChanged` এ `initializeUser` ফাংশনের মাধ্যমে
                console.log('Signup successful for', user.email);
            })
            .catch((error) => {
                alert(`Signup Failed: ${error.message}`);
            });
    });

    // Login Form
    document.getElementById('emailLoginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        auth.signInWithEmailAndPassword(email, password).catch((error) => {
            alert(`Login Failed: ${error.message}`);
        });
    });

    

    // Logout
    document.getElementById('logoutButton').addEventListener('click', (e) => {
        e.preventDefault();
        auth.signOut();
    });

    // Auth page switcher
    document.getElementById('switchToSignup').addEventListene('click', () => {
        document.getElementById('webLoginCard').style.display = 'none';
        document.getElementById('webSignupCard').style.display = 'block';
    });
    document.getElementById('switchToLogin').addEventListener('click', () => {
        document.getElementById('webSignupCard').style.display = 'none';
        document.getElementById('webLoginCard').style.display = 'block';
    });
    
    // =======================================================
    // ===             7. CORE APP FEATURES              ===
    // =======================================================

        // --- Theme Switcher ---
    const themeSwitch = document.getElementById('themeSwitch');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.toggle('light-mode', currentTheme === 'light');
    themeSwitch.checked = currentTheme === 'light';
    
    themeSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light');
        } else {
            document.body.classList.remove('light-mode');
            localStorage.setItem('theme', 'dark');
        }
    });


    // --- Create Post Form Logic ---
    const createPostForm = document.getElementById('createPostForm');
    const addCustomButtonSwitch = document.getElementById('addCustomButtonSwitch');
    const customButtonFields = document.getElementById('customButtonFields');
    const scheduleOption = document.querySelectorAll('input[name="scheduleOption"]');
    const scheduleTimeFields = document.getElementById('scheduleTimeFields');

    addCustomButtonSwitch.addEventListener('change', () => {
        customButtonFields.style.display = addCustomButtonSwitch.checked ? 'block' : 'none';
    });

    scheduleOption.forEach(radio => {
        radio.addEventListener('change', () => {
            scheduleTimeFields.style.display = document.getElementById('postLater').checked ? 'block' : 'none';
        });
    });

    // Fetch tags for post creation
    db.ref('tags').on('value', snapshot => {
        const tagsContainer = document.getElementById('postTagsContainer');
        tagsContainer.innerHTML = '';
        if (snapshot.exists()) {
            const tags = snapshot.val();
            for (const tagName in tags) {
                const tagBtn = document.createElement('button');
                tagBtn.type = 'button';
                tagBtn.className = 'tag-btn';
                tagBtn.dataset.tag = tagName;
                tagBtn.textContent = tagName;
                tagsContainer.appendChild(tagBtn);
            }
        }
    });

    // Tag selection logic
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

    // Form Submission
    createPostForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) {
            alert('You must be logged in to post.');
            return;
        }

        const postContent = document.getElementById('postContent').value.trim();
        if (!postContent) {
            alert('Post content cannot be empty.');
            return;
        }

        const selectedTags = Array.from(document.querySelectorAll('.tag-btn.selected')).map(btn => btn.dataset.tag);
        if (selectedTags.length === 0) {
            alert('Please select at least one tag.');
            return;
        }

        const postData = {
            userId: user.uid,
            userName: user.displayName,
            content: postContent,
            tags: selectedTags,
            status: 'pending',
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        if (addCustomButtonSwitch.checked) {
            const buttonText = document.getElementById('buttonText').value.trim();
            const buttonUrl = document.getElementById('buttonUrl').value.trim();
            if (buttonText && buttonUrl) {
                postData.customButton = { text: buttonText, url: buttonUrl };
            }
        }

        if (document.getElementById('postLater').checked) {
            const scheduleDateTime = document.getElementById('scheduleDateTime').value;
            if (scheduleDateTime) {
                postData.status = 'scheduled';
                postData.scheduleTime = new Date(scheduleDateTime).getTime();
            }
        }
        
        const newPostRef = db.ref('posts').push();
        newPostRef.set(postData)
            .then(() => {
                alert('Post submitted successfully for review!');
                createPostForm.reset();
                customButtonFields.style.display = 'none';
                scheduleTimeFields.style.display = 'none';
                document.querySelectorAll('.tag-btn.selected').forEach(btn => btn.classList.remove('selected'));
                navigateToSection('posts-section');
            })
            .catch(error => {
                alert('Error submitting post: ' + error.message);
            });
    });
    
    // --- Fetch My Posts ---
    function fetchMyPosts(uid) {
        const postsRef = db.ref('posts').orderByChild('userId').equalTo(uid);
        postsRef.on('value', snapshot => {
            const myPostsContainer = document.getElementById('myPostsContainer');
            myPostsContainer.innerHTML = '<p class="text-center text-secondary">Loading your posts...</p>';
            if (snapshot.exists()) {
                myPostsContainer.innerHTML = '';
                snapshot.forEach(childSnapshot => {
                    const post = childSnapshot.val();
                    const postId = childSnapshot.key;
                    const statusClass = `status-${post.status}`; // e.g., status-pending
                    const statusBadgeColor = {
                        pending: 'bg-warning text-dark',
                        published: 'bg-success',
                        rejected: 'bg-danger',
                        scheduled: 'bg-primary',
                        archived: 'bg-secondary'
                    }[post.status] || 'bg-secondary';
                    
                    const postCard = `
                        <div class="custom-card post-item-card ${statusClass}" data-post-id="${postId}">
                            <div class="post-item-header">
                                <h6 class="mb-0">${post.content.substring(0, 30)}...</h6>
                                <span class="badge ${statusBadgeColor}">${post.status.charAt(0).toUpperCase() + post.status.slice(1)}</span>
                            </div>
                            <p class="post-item-content text-secondary">${post.tags.join(', ')}</p>
                            <small class="text-secondary">Submitted: ${new Date(post.createdAt).toLocaleDateString()}</small>
                        </div>`;
                    myPostsContainer.insertAdjacentHTML('afterbegin', postCard);
                });
            } else {
                myPostsContainer.innerHTML = '<p class="text-center text-secondary">You haven\'t created any posts yet.</p>';
            }
        });
    }

    // --- Fetch Transaction History ---
    function fetchTransactions(uid) {
        const transactionsRef = db.ref(`users/${uid}/transactions`).limitToLast(20);
        transactionsRef.on('value', snapshot => {
            const container = document.getElementById('transactionListContainer');
            container.innerHTML = '<p class="text-center text-secondary">Loading transaction history...</p>';
            if (snapshot.exists()) {
                container.innerHTML = '';
                snapshot.forEach(childSnapshot => {
                    const tx = childSnapshot.val();
                    const amountClass = tx.amount > 0 ? 'text-success' : 'text-danger';
                    const amountSign = tx.amount > 0 ? '+' : '';
                    
                    const txItem = `
                        <div class="list-group-item transaction-item">
                            <div class="d-flex w-100 justify-content-between">
                                <h6>${tx.description || tx.reason || 'Transaction'}</h6>
                                <small>${new Date(tx.timestamp).toLocaleDateString()}</small>
                            </div>
                            <p class="mb-1 text-secondary">Type: ${tx.type}</p>
                            <strong class="${amountClass}">${amountSign}${tx.amount} Points</strong>
                        </div>`;
                    container.insertAdjacentHTML('afterbegin', txItem);
                });
            } else {
                container.innerHTML = '<p class="text-center text-secondary">No transactions found.</p>';
            }
        });
    }

    // --- Daily Bonus ---
    const dailyBonusLink = document.getElementById('dailyBonusLink');
    function updateDailyBonusUI(lastBonusTime) {
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const badge = document.getElementById('dailyBonusBadge');
        if (now - lastBonusTime > twentyFourHours) {
            badge.textContent = 'Claim Now';
            badge.className = 'badge rounded-pill bg-success';
            dailyBonusLink.style.pointerEvents = 'auto';
            dailyBonusLink.style.opacity = '1';
        } else {
            const timeLeft = twentyFourHours - (now - lastBonusTime);
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            badge.textContent = `Wait ${hours}h ${minutes}m`;
            badge.className = 'badge rounded-pill bg-secondary';
            dailyBonusLink.style.pointerEvents = 'none';
            dailyBonusLink.style.opacity = '0.6';
        }
    }

    dailyBonusLink.addEventListener('click', (e) => {
        e.preventDefault();
        const user = auth.currentUser;
        if (!user) return;

        const userRef = db.ref(`users/${user.uid}`);
        userRef.transaction(userData => {
            if (userData) {
                const now = Date.now();
                const twentyFourHours = 24 * 60 * 60 * 1000;
                if (!userData.lastDailyBonus || (now - userData.lastDailyBonus > twentyFourHours)) {
                    userData.points = (userData.points || 0) + 20; // Daily bonus amount
                    userData.lastDailyBonus = now;

                    // Add transaction
                    if (!userData.transactions) {
                        userData.transactions = {};
                    }
                    const newTxKey = db.ref().child('transactions').push().key;
                    userData.transactions[newTxKey] = {
                        type: 'daily_bonus',
                        description: 'Daily bonus claimed',
                        amount: 20,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    };
                } else {
                    // Abort transaction
                    return; 
                }
            }
            return userData;
        }, (error, committed, snapshot) => {
            if (error) {
                alert('Transaction failed: ' + error);
            } else if (!committed) {
                alert('You have already claimed your daily bonus. Please wait.');
            } else {
                alert('You have received 20 points!');
            }
        });
    });
});
