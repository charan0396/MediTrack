/* Shared by pages after login: auth guard, home / view / bill / record / logout buttons, toast */
(function () {
    function clearUser() {
        try { sessionStorage.removeItem('loggedInUser'); } catch (e) { /* ignore */ }
    }

    var user = null;
    try { user = sessionStorage.getItem('loggedInUser'); } catch (e) { /* ignore */ }
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    window.loggedInUser = user;
    try { window.isSuperUser = sessionStorage.getItem('superUser') === 'true'; } catch (e) { window.isSuperUser = false; }

    // Called by pages when the server answers 401 (session ended or server restarted)
    window.handleUnauthorized = function () {
        clearUser();
        window.location.href = 'index.html';
    };

    // ---------- Toast ----------
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);

    var timer = null;
    window.showToast = function (text) {
        toast.textContent = text;
        toast.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(function () { toast.classList.remove('show'); }, 2500);
    };

    // ---------- Header: logged-in user name + buttons ----------
    var userName = document.getElementById('userName');
    if (userName) userName.textContent = user;

    var homeBtn = document.getElementById('homeBtn');
    var recordBtn = document.getElementById('recordBtn');
    var viewBtn = document.getElementById('viewBtn');
    var billBtn = document.getElementById('billBtn');
    var logoutBtn = document.getElementById('logoutBtn');

    if (homeBtn) {
        homeBtn.addEventListener('click', function () { window.location.href = 'home.html'; });
    }
    if (recordBtn) {
        recordBtn.addEventListener('click', function () { window.location.href = 'record.html'; });
    }
    if (viewBtn) {
        viewBtn.addEventListener('click', function () { window.location.href = 'view.html'; });
    }
    if (billBtn) {
        billBtn.addEventListener('click', function () { window.location.href = 'bill.html'; });
    }

    // ---------- Logout confirmation popup ----------
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
        '<div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="logoutTitle">' +
        '<h2 id="logoutTitle">Confirm logout</h2>' +
        '<p>Are you sure you want to log out?</p>' +
        '<div class="modal-actions">' +
        '<button type="button" class="btn secondary" data-act="no">Cancel</button>' +
        '<button type="button" class="btn" data-act="yes">Yes, logout</button>' +
        '</div></div>';
    document.body.appendChild(modal);

    var yesBtn = modal.querySelector('[data-act="yes"]');
    var noBtn = modal.querySelector('[data-act="no"]');

    function openLogout() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        noBtn.focus();
    }

    function closeLogout() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', openLogout);
    }
    noBtn.addEventListener('click', closeLogout);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeLogout();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeLogout();
    });

    yesBtn.addEventListener('click', async function () {
        yesBtn.disabled = true;
        try {
            await fetch('/api/auth/logout', { method: 'POST' }); // ends the server session
        } catch (e) { /* even if the server is unreachable, leave this page */ }
        clearUser();
        window.location.href = 'index.html';
    });
})();
