(function () {
    // এই ফাংশনটি একটি সেফ 'স্কোপ' তৈরি করে, যাতে গ্লোবাল ভেরিয়েবল নিয়ে কোনো সমস্যা না হয়।

    // =======================================================
    // ===           CONFIGURATION & CONSTANTS           ===
    // =======================================================
    const firebaseConfig = {
        apiKey: "AIzaSyAe3TMK4RHmReffbhxZeYi5NuHgmJJWlTo",
        authDomain: "supchat-5474d.firebaseapp.com",
        databaseURL: "https://supchat-5474d-default-rtdb.firebaseio.com",
        projectId: "supchat-5474d",
        storageBucket: "supchat-5474d.appspot.com",
        messagingSenderId: "170794585438",
        appId: "1:170794585438:web:da9cb1f6d7cc3408b493cf"
    };
    const BOT_USERNAME = "TGPromo360Bot";
    const JOIN_BONUS = 50, DAILY_BONUS_POINTS = 20, REFERRAL_BONUS_REFERRER = 50, POST_SUBMISSION_COST = 100;

    function displayError(message) {
        const loader = document.getElementById('globalLoader');
        if (loader) loader.style.display = 'none';
        document.body.classList.add('ready');
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.innerHTML = `<div class="alert alert-danger text-center m-3" role="alert">${message}</div>`;
    }

    // =======================================================
    // ===             SAFE APP INITIALIZATION             ===
    // =======================================================
    try {
        if (!window.Telegram || !window.Telegram.WebApp || !window.Telegram.WebApp.initDataUnsafe || !window.Telegram.WebApp.initDataUnsafe.user) {
            displayError("Please open this app through the designated Telegram bot.");
            return;
        }
        
        const WebApp = window.Telegram.WebApp;
        WebApp.ready();
        WebApp.expand();

        const app = firebase.initializeApp(firebaseConfig);
        const db = firebase.database();
        
        runApp(WebApp, db, WebApp.initDataUnsafe.user);
    } catch (e) {
        displayError(`Critical Error: ${e.message}`);
    }

    // =======================================================
    // ===               MAIN APPLICATION LOGIC            ===
    // =======================================================
    function runApp(WebApp, db, tgUser) {
        const getEl = (id) => document.getElementById(id);
        const elements = {
            body: document.body, loader: getEl('globalLoader'),
            header: { sectionTitle: getEl('headerSectionTitle'), userPoints: getEl('headerUserPoints') },
            menu: { container: getEl('sideNavMenu'), userPic: getEl('menuUserPic'), userName: getEl('menuUserName'), userId: getEl('menuUserTgId') },
            bottomNav: { container: getEl('bottomNav') },
            createPost: {
                form: getEl('createPostForm'), content: getEl('postContent'), toolbar: document.querySelector('.text-editor-toolbar'),
                tagsContainer: getEl('postTagsContainer'), customButtonSwitch: getEl('addCustomButtonSwitch'),
                customButtonFields: getEl('customButtonFields'), buttonText: getEl('buttonText'), buttonUrl: getEl('buttonUrl'),
                scheduleFields: getEl('scheduleTimeFields'), estimatedCost: getEl('estimatedCost'), submitBtn: getEl('submitPostBtn')
            },
            myPosts: { container: getEl('myPostsContainer'), navigateToCreatePostBtn: getEl('navigateToCreatePostBtn') },
            profile: { avatar: getEl('profileAvatar'), name: getEl('profileName'), id: getEl('profileId'), themeSwitch: getEl('themeSwitch') },
            earn: { dailyBonusLink: getEl('dailyBonusLink'), dailyBonusBadge: getEl('dailyBonusBadge') },
            postDetails: { modal: new bootstrap.Modal(getEl('postDetailsModal')), modalBody: getEl('postDetailsModalBody') },
            wallet: { pointsDisplay: getEl('walletPointsDisplay') },
            transactions: { container: getEl('transactionListContainer') },
            sections: document.querySelectorAll('.section'),
        };
        let currentUser = null, sideMenu = new bootstrap.Offcanvas(getEl('sideMenu')), sectionHistory = ['home-section'];

        const showLoader = (show) => elements.loader.style.display = show ? 'flex' : 'none';
        const makeBodyVisible = () => elements.body.classList.add('ready');

        function renderPage(sectionId) {
            if (!getEl(sectionId)) sectionId = 'home-section';
            if (sectionHistory[sectionHistory.length - 1] !== sectionId) sectionHistory.push(sectionId);
            elements.sections.forEach(sec => sec.classList.remove('active'));
            getEl(sectionId)?.classList.add('active');
            document.querySelectorAll('.menu-nav .nav-link, .bottom-nav .nav-item').forEach(link => link.classList.toggle('active', link.dataset.section === sectionId));
            const pageTitles = {'home-section': 'Dashboard', 'earn-section': 'Earn Points', 'create-post-section': 'Create Post', 'posts-section': 'My Content', 'profile-section': 'Profile', 'wallet-section': 'My Wallet', 'transactions-section': 'Transaction History' };
            elements.header.sectionTitle.textContent = pageTitles[sectionId] || 'TG Promo 360';
            if (pageRenderers[sectionId]) pageRenderers[sectionId]();
        }

        function updateAllUI() {
            if (!currentUser) return;
            elements.header.userPoints.textContent = currentUser.points || 0;
            elements.menu.userName.textContent = currentUser.name;
            elements.menu.userId.textContent = `ID: ${currentUser.id}`;
            elements.menu.userPic.src = currentUser.photoUrl || 'https://via.placeholder.com/45';
            elements.profile.name.textContent = currentUser.name;
            elements.profile.id.textContent = `ID: ${currentUser.id}`;
            elements.profile.avatar.src = currentUser.photoUrl || 'https://via.placeholder.com/80';
        }

        function loadOrCreateUser(tgUserData) {
            showLoader(true);
            const userId = tgUserData.id.toString();
            const userRef = db.ref('users/' + userId);
            const startParam = WebApp.initDataUnsafe.start_param;

            userRef.on('value', (snapshot) => {
                if (!snapshot.exists()) {
                    const newUser = {
                        id: userId, name: `${tgUserData.first_name || ''} ${tgUserData.last_name || ''}`.trim(),
                        username: tgUserData.username || '', photoUrl: tgUserData.photo_url,
                        points: JOIN_BONUS, joinDate: new Date().toISOString(), lastBonusTime: 0,
                        referredBy: startParam && startParam !== userId ? startParam : null
                    };
                    userRef.set(newUser).then(() => {
                        if (newUser.referredBy) handleReferral(newUser.referredBy, newUser.id);
                        addTransaction(userId, 'join_bonus', JOIN_BONUS, 'Welcome bonus');
                    });
                    currentUser = newUser;
                } else {
                    currentUser = { id: userId, ...snapshot.val() };
                }
                updateAllUI();
                showLoader(false);
                makeBodyVisible();
                renderPage(sectionHistory[sectionHistory.length - 1] || 'home-section');
            });
        }

        const addTransaction = (userId, type, amount, description) => db.ref(`users/${userId}/transactions`).push({ type, amount, description, timestamp: firebase.database.ServerValue.TIMESTAMP });
        
        function applyTextFormat(format) {
            const textarea = elements.createPost.content; const start = textarea.selectionStart; const end = textarea.selectionEnd; const selectedText = textarea.value.substring(start, end);
            if (!selectedText) { WebApp.showAlert('Please select text to format.'); return; }
            const formats = { 'bold': `<b>${selectedText}</b>`, 'italic': `<i>${selectedText}</i>`, 'underline': `<u>${selectedText}</u>`, 'strikethrough': `<s>${selectedText}</s>`, 'spoiler': `<span class="tg-spoiler">${selectedText}</span>`, 'code': `<code>${selectedText}</code>` };
            textarea.setRangeText(formats[format] || selectedText, start, end, 'end'); textarea.focus();
        }
        
        const pageRenderers = {};
        function initializePageRenderers() {
            const menuItems = [ { id: 'home-section', icon: 'house-door-fill', title: 'Home' }, { id: 'wallet-section', icon: 'wallet-fill', title: 'My Wallet'}, { id: 'create-post-section', icon: 'plus-square-fill', title: 'Create Post' }, { id: 'posts-section', icon: 'collection-fill', title: 'My Content' }, { id: 'earn-section', icon: 'gem', title: 'Earn Points' }, { id: 'profile-section', icon: 'person-fill', title: 'Profile' } ];
            elements.menu.container.innerHTML = menuItems.map(item => `<li><a href="#" class="nav-link" data-section="${item.id}"><i class="bi bi-${item.icon}"></i> ${item.title}</a></li>`).join('');
            pageRenderers['home-section'] = () => { getEl('home-section').innerHTML = `<h2 class="section-title">Welcome, ${currentUser.name.split(' ')[0]}!</h2><div class="custom-card"><p>Explore, create, and grow!</p></div>`; };
            pageRenderers['earn-section'] = () => updateDailyBonusUI();
            pageRenderers['tasks-section'] = () => loadTasks();
            pageRenderers['referral-section'] = () => renderReferralPage();
            pageRenderers['create-post-section'] = () => { loadTagsForPostCreation(); elements.createPost.estimatedCost.textContent = POST_SUBMISSION_COST; };
            pageRenderers['posts-section'] = () => loadUserPosts();
            pageRenderers['wallet-section'] = () => { elements.wallet.pointsDisplay.innerHTML = `${currentUser.points || 0} <i class="bi bi-coin text-warning"></i>`; };
            pageRenderers['transactions-section'] = () => loadTransactionHistory();
        }

        function initializeEventListeners() {
            elements.bottomNav.container.addEventListener('click', (e) => { const navItem = e.target.closest('.nav-item'); if (navItem) renderPage(navItem.dataset.section); });
            document.body.addEventListener('click', (e) => { const sectionLink = e.target.closest('[data-section]'); if (sectionLink && !sectionLink.closest('.bottom-nav')) { e.preventDefault(); renderPage(sectionLink.dataset.section); if (sideMenu) sideMenu.hide(); } });
            elements.createPost.form.addEventListener('submit', handlePostSubmission);
            elements.createPost.toolbar.addEventListener('click', (e) => { const btn = e.target.closest('.toolbar-btn'); if (btn) applyTextFormat(btn.dataset.format); });
            elements.myPosts.navigateToCreatePostBtn.addEventListener('click', () => renderPage('create-post-section'));
            elements.earn.dailyBonusLink.addEventListener('click', claimDailyBonus);
            elements.profile.themeSwitch.addEventListener('change', (e) => applyTheme(e.target.checked ? 'dark' : 'light'));
            elements.createPost.customButtonSwitch.addEventListener('change', (e) => { elements.createPost.customButtonFields.style.display = e.target.checked ? 'block' : 'none'; });
            document.querySelectorAll('input[name="scheduleOption"]').forEach(radio => { radio.addEventListener('change', (e) => { elements.createPost.scheduleFields.style.display = e.target.value === 'later' ? 'block' : 'none'; }); });
        }
        
        function handlePostSubmission(e) { 
            e.preventDefault();
            if (currentUser.points < POST_SUBMISSION_COST) { WebApp.showAlert(`You need at least ${POST_SUBMISSION_COST} points.`); return; }
            const content = elements.createPost.content.value.trim();
            if (!content) { WebApp.showAlert('Post content cannot be empty.'); return; }
            const selectedTags = Array.from(elements.createPost.tagsContainer.querySelectorAll('.selected')).map(btn => btn.dataset.tag);
            if (selectedTags.length === 0) { WebApp.showAlert('Please select at least one tag.'); return; }
            
            showLoader(true); elements.createPost.submitBtn.disabled = true;

            const postData = {
                userId: currentUser.id, userName: currentUser.name, content, tags: selectedTags,
                status: 'pending', submittedAt: firebase.database.ServerValue.TIMESTAMP
            };

            if (elements.createPost.customButtonSwitch.checked) {
                const btnText = elements.createPost.buttonText.value.trim();
                const btnUrl = elements.createPost.buttonUrl.value.trim();
                if (btnText && btnUrl) {
                    postData.customButton = { text: btnText, url: btnUrl };
                }
            }
            
            if (document.getElementById('postLater').checked) {
                const scheduleDate = document.getElementById('scheduleDateTime').value;
                if (scheduleDate) {
                    postData.scheduleTime = new Date(scheduleDate).getTime();
                } else {
                    WebApp.showAlert('Please select a valid date for scheduling.');
                    showLoader(false); elements.createPost.submitBtn.disabled = false; return;
                }
            }

            const newPostRef = db.ref('posts').push();
            newPostRef.set(postData)
                .then(() => db.ref('users/' + currentUser.id).update({ points: currentUser.points - POST_SUBMISSION_COST }))
                .then(() => {
                    addTransaction(currentUser.id, 'post_fee', -POST_SUBMISSION_COST, `Fee for post #${newPostRef.key.slice(-6)}`);
                    WebApp.showAlert('Your post submitted for review!');
                    elements.createPost.form.reset();
                    elements.createPost.tagsContainer.querySelectorAll('.selected').forEach(btn => btn.classList.remove('selected'));
                    renderPage('posts-section');
                })
                .catch(err => WebApp.showAlert(`Error: ${err.message}`))
                .finally(() => { showLoader(false); elements.createPost.submitBtn.disabled = false; });
        }

        function loadUserPosts() {
            const container = elements.myPosts.container;
            container.innerHTML = `<div class="text-center p-4"><div class="spinner-border"></div></div>`;
            db.ref('posts').orderByChild('userId').equalTo(currentUser.id).limitToLast(30).once('value', snapshot => {
                container.innerHTML = '';
                if (!snapshot.exists()) { container.innerHTML = `<div class="text-center p-5"><i class="bi bi-file-earmark-x fs-1 text-secondary"></i><p class="mt-2 text-secondary">You haven't created any posts yet.</p></div>`; return; }
                const posts = []; snapshot.forEach(child => posts.push({ id: child.key, ...child.val() }));
                posts.reverse().forEach(post => {
                    const postCard = document.createElement('div');
                    postCard.className = `custom-card post-item-card status-${post.status}`;
                    postCard.addEventListener('click', () => showPostDetails(post));
                    const submittedDate = new Date(post.submittedAt).toLocaleDateString('en-GB');
                    const statusText = post.status.charAt(0).toUpperCase() + post.status.slice(1);
                    postCard.innerHTML = `<div class="post-item-header"><span class="badge bg-secondary">${statusText}</span><small class="text-secondary">${submittedDate}</small></div><p class="post-item-content mt-2 text-truncate">${post.content.replace(/<[^>]*>?/gm, '')}</p>`;
                    container.appendChild(postCard);
                });
            });
        }

        function showPostDetails(post) {
            const body = elements.postDetails.modalBody;
            const statusBadges = { approved: 'bg-success', rejected: 'bg-danger', scheduled: 'bg-info', pending: 'bg-warning', published: 'bg-primary', archived: 'bg-secondary' };
            const statusText = post.status.charAt(0).toUpperCase() + post.status.slice(1);
            body.innerHTML = `<h5>Content</h5><div class="post-content-full p-3 mb-3" style="background-color: var(--primary-bg); border-radius: 8px;">${post.content}</div><hr><h5>Details</h5><ul class="list-unstyled"><li><strong>Status:</strong> <span class="badge ${statusBadges[post.status] || 'bg-secondary'}">${statusText}</span></li><li><strong>Tags:</strong> ${post.tags.map(tag => `<span class="badge bg-dark">#${tag}</span>`).join(' ')}</li><li><strong>Submitted:</strong> ${new Date(post.submittedAt).toLocaleString()}</li>${post.scheduleTime ? `<li><strong>Scheduled for:</strong> ${new Date(post.scheduleTime).toLocaleString()}</li>` : ''}${post.publishedAt ? `<li><strong>Published:</strong> ${new Date(post.publishedAt).toLocaleString()}</li>` : ''}</ul>`;
            elements.postDetails.modal.show();
        }

        function updateDailyBonusUI() {
            const badge = elements.earn.dailyBonusBadge; if (!currentUser || !badge) return;
            const timePassed = Date.now() - (currentUser.lastBonusTime || 0); const coolDown = 24 * 60 * 60 * 1000;
            if (timePassed > coolDown) { badge.textContent = "Claim"; badge.className = 'badge rounded-pill bg-success'; } 
            else { const timeLeft = coolDown - timePassed; const h = Math.floor(timeLeft / 3600000); const m = Math.floor((timeLeft % 3600000) / 60000); badge.textContent = `${h}h ${m}m`; badge.className = 'badge rounded-pill bg-secondary'; }
        }

        function claimDailyBonus() {
            if (!currentUser) return; const timePassed = Date.now() - (currentUser.lastBonusTime || 0);
            if (timePassed < 24 * 60 * 60 * 1000) { WebApp.showAlert("You can claim again after the cooldown."); return; }
            const newPoints = (currentUser.points || 0) + DAILY_BONUS_POINTS;
            db.ref('users/' + currentUser.id).update({ points: newPoints, lastBonusTime: Date.now() })
                .then(() => { addTransaction(currentUser.id, 'daily_bonus', DAILY_BONUS_POINTS, 'Daily bonus claimed'); WebApp.showAlert(`You've claimed ${DAILY_BONUS_POINTS} points!`); })
                .catch(e => WebApp.showAlert("Error claiming bonus."));
        }

        function loadTasks() {
            const container = getEl('tasks-section'); container.innerHTML = `<h2 class="section-title">Join & Earn</h2><div id="tasksListContainer" class="custom-card list-group"></div>`;
            const listContainer = getEl('tasksListContainer');
            listContainer.innerHTML = '<div class="text-center p-4"><div class="spinner-border text-secondary"></div></div>';
            db.ref('tasks').once('value', snapshot => {
                listContainer.innerHTML = '';
                if (!snapshot.exists()) { listContainer.innerHTML = '<p class="text-center text-secondary">No tasks available right now.</p>'; return; }
                Object.keys(snapshot.val()).forEach(taskId => {
                    const task = snapshot.val()[taskId]; const isCompleted = currentUser.completedTasks && currentUser.completedTasks[taskId];
                    const taskElement = document.createElement('div'); taskElement.className = 'list-group-item task-item';
                    taskElement.innerHTML = `<div class="task-icon"><i class="bi bi-link-45deg"></i></div><div class="task-details"><div class="task-title">${task.title}</div><div class="task-reward">+${task.points} Points</div></div><div class="task-action"><button class="btn btn-sm ${isCompleted ? 'btn-success claimed' : 'btn-primary'}" ${isCompleted ? 'disabled' : ''}>${isCompleted ? 'Claimed' : 'Join'}</button></div>`;
                    if (!isCompleted) { taskElement.querySelector('button').addEventListener('click', (e) => handleTaskClick(taskId, task.link, task.points, e.currentTarget)); }
                    listContainer.appendChild(taskElement);
                });
            });
        }

        function handleTaskClick(taskId, link, points, btn) {
            if (!link) return; WebApp.openTelegramLink(link);
            btn.textContent = "Verifying..."; btn.disabled = true;
            setTimeout(() => {
                const newPoints = (currentUser.points || 0) + parseInt(points);
                db.ref(`users/${currentUser.id}`).update({ points: newPoints, [`completedTasks/${taskId}`]: true })
                    .then(() => { addTransaction(currentUser.id, 'task_reward', points, `Reward for task`); WebApp.showAlert(`Task done! You earned ${points} points.`); })
                    .catch(() => { WebApp.showAlert("An error occurred."); btn.textContent = "Join"; btn.disabled = false; });
            }, 8000);
        }
        
        function handleReferral(referrerId, refereeId) {
            const referrerRef = db.ref(`users/${referrerId}`);
            referrerRef.once('value').then(snapshot => {
                if (snapshot.exists()) {
                    const currentPoints = snapshot.val().points || 0;
                    const updates = {
                        points: currentPoints + REFERRAL_BONUS_REFERRER,
                        [`referredUsers/${refereeId}`]: true
                    };
                    referrerRef.update(updates).then(() => {
                        addTransaction(referrerId, 'referral_bonus', REFERRAL_BONUS_REFERRER, `Bonus for referring ${refereeId}`);
                    });
                }
            });
        }

        function renderReferralPage() {
            const section = getEl('referral-section');
            const referralCount = currentUser.referredUsers ? Object.keys(currentUser.referredUsers).length : 0;
            const referralEarnings = referralCount * REFERRAL_BONUS_REFERRER;
            const link = `https://t.me/${BOT_USERNAME}?start=${currentUser.id}`;
            section.innerHTML = `<h2 class="section-title">Refer & Earn</h2><div class="custom-card"><div class="row text-center mb-4 g-3"><div class="col-6"><div class="stat-box"><span class="stat-value">${referralCount}</span><span class="stat-label">Total Referrals</span></div></div><div class="col-6"><div class="stat-box"><span class="stat-value">${referralEarnings}</span><span class="stat-label">Points Earned</span></div></div></div><div class="text-center"><p class="text-secondary mb-3 small">Share your link to earn <strong class="text-warning">${REFERRAL_BONUS_REFERRER}</strong> points for each friend who joins!</p><div class="referral-box"><p class="small text-secondary mb-1">Your Referral Link</p><h4 class="referral-code">${link}</h4></div><button class="btn btn-lg btn-custom-accent mt-3 w-100" id="shareReferralBtn"><i class="bi bi-share-fill"></i> Share Now</button></div></div>`;
            getEl('shareReferralBtn').addEventListener('click', () => { WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Join me and earn points!`)}`); });
        }
        
        function loadTransactionHistory() {
            const container = elements.transactions.container;
            container.innerHTML = `<div class="text-center p-4"><div class="spinner-border"></div></div>`;
            db.ref(`users/${currentUser.id}/transactions`).limitToLast(50).once('value', snapshot => {
                container.innerHTML = '';
                if (!snapshot.exists()) { container.innerHTML = `<div class="list-group-item text-center text-secondary">No transactions found.</div>`; return; }
                const transactions = []; snapshot.forEach(child => transactions.push(child.val()));
                transactions.reverse().forEach(tx => {
                    const isCredit = tx.amount > 0;
                    const item = document.createElement('div'); item.className = 'list-group-item transaction-item';
                    item.innerHTML = `<div class="d-flex align-items-center"><i class="bi ${isCredit ? 'bi-arrow-down-circle-fill text-success' : 'bi-arrow-up-circle-fill text-danger'} me-3"></i><div><h6 class="mb-0">${tx.description}</h6><small class="text-secondary">${new Date(tx.timestamp).toLocaleString()}</small></div></div><span class="fw-bold ${isCredit ? 'text-success' : 'text-danger'}">${isCredit ? '+' : ''}${tx.amount}</span>`;
                    container.appendChild(item);
                });
            });
        }

        function loadTagsForPostCreation() {
            const container = elements.createPost.tagsContainer;
            container.innerHTML = '<div class="spinner-border spinner-border-sm"></div>';
            db.ref('tags').once('value', snapshot => {
                container.innerHTML = '';
                if (snapshot.exists()) {
                    Object.keys(snapshot.val()).forEach(tagKey => {
                        const tagBtn = document.createElement('button');
                        tagBtn.type = 'button'; tagBtn.className = 'tag-btn';
                        tagBtn.textContent = `#${tagKey}`; tagBtn.dataset.tag = tagKey;
                        tagBtn.addEventListener('click', () => {
                            tagBtn.classList.toggle('selected');
                            if (container.querySelectorAll('.selected').length > 3) {
                                tagBtn.classList.remove('selected');
                                WebApp.showAlert('You can select up to 3 tags.');
                            }
                        });
                        container.appendChild(tagBtn);
                    });
                } else { container.innerHTML = '<p class="text-secondary small">No tags available to select.</p>'; }
            });
        }

        function applyTheme(theme) {
            document.body.classList.toggle('light-mode', theme === 'light');
            localStorage.setItem('appTheme', theme);
            elements.profile.themeSwitch.checked = (theme === 'dark');
        }

        // --- Initial App Calls ---
        initializeEventListeners();
        initializePageRenderers();
        loadOrCreateUser(tgUser);
    }
})();
