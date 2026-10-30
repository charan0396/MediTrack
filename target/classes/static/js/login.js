(function () {
    function $(id) { return document.getElementById(id); }

    var loginForm = $('loginForm');
    var userInput = $('user');
    var passwordInput = $('password');
    var loginMsg = $('loginMsg');

    function setMsg(el, text, ok) {
        el.textContent = text || '';
        el.classList.toggle('ok', !!ok);
    }

    async function post(url, body) {
        var res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        var data = {};
        try { data = await res.json(); } catch (e) { /* empty body */ }
        return { ok: res.ok, data: data };
    }

    // ---------- Generic popup open / close ----------
    function setupModal(modal, closeBtn, focusEl, onOpen) {
        function open() {
            if (onOpen) onOpen();
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            focusEl.focus();
        }
        function close() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
        }
        closeBtn.addEventListener('click', close);
        modal.addEventListener('click', function (e) {
            if (e.target === modal) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
        return { open: open, close: close };
    }

    // ---------- Login ----------
    loginForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMsg(loginMsg, '');

        var user = userInput.value.trim();
        var password = passwordInput.value;
        if (!user || !password) {
            setMsg(loginMsg, 'Enter user and password');
            return;
        }

        var submitBtn = loginForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            var r = await post('/api/auth/login', { user: user, password: password });
            if (r.ok && r.data.success) {
                sessionStorage.setItem('loggedInUser', r.data.user);
                sessionStorage.setItem('superUser', r.data.superUser ? 'true' : 'false');
                window.location.href = 'home.html';
            } else {
                setMsg(loginMsg, r.data.message || 'Login failed');
            }
        } catch (err) {
            setMsg(loginMsg, 'Cannot reach server');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ---------- New user popup (save to DB) ----------
    var registerForm = $('registerForm');
    var newName = $('newName');
    var newPassword = $('newPassword');
    var registerMsg = $('registerMsg');

    var registerModal = setupModal($('modal'), $('closeModal'), newName, function () {
        setMsg(registerMsg, '');
        registerForm.reset();
    });
    $('newUserBtn').addEventListener('click', registerModal.open);

    registerForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMsg(registerMsg, '');

        var name = newName.value.trim();
        var password = newPassword.value;
        if (!name || !password) {
            setMsg(registerMsg, 'Enter name and password');
            return;
        }

        var submitBtn = registerForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            var r = await post('/api/auth/register', { name: name, password: password });
            if (r.ok && r.data.success) {
                setMsg(registerMsg, r.data.message, true);
                // Saved to DB: close popup and prefill the user so login uses the saved data
                setTimeout(function () {
                    registerModal.close();
                    userInput.value = name;
                    passwordInput.value = '';
                    passwordInput.focus();
                    setMsg(loginMsg, 'Saved. Enter your password to log in.', true);
                }, 900);
            } else {
                setMsg(registerMsg, r.data.message || 'Could not save user');
            }
        } catch (err) {
            setMsg(registerMsg, 'Cannot reach server');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ---------- Forgot password popup ----------
    var resetForm = $('resetForm');
    var resetUser = $('resetUser');
    var resetNew = $('resetNew');
    var resetConfirm = $('resetConfirm');
    var resetCode = $('resetCode');
    var resetMsg = $('resetMsg');

    var resetModal = setupModal($('resetModal'), $('closeReset'), resetUser, function () {
        setMsg(resetMsg, '');
        resetForm.reset();
        if (userInput.value.trim()) resetUser.value = userInput.value.trim();
    });
    $('forgotLink').addEventListener('click', function (e) {
        e.preventDefault();
        resetModal.open();
    });

    resetForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMsg(resetMsg, '');

        var user = resetUser.value.trim();
        if (!user || !resetNew.value || !resetConfirm.value || !resetCode.value) {
            setMsg(resetMsg, 'Fill in all the fields');
            return;
        }
        if (resetNew.value !== resetConfirm.value) {
            setMsg(resetMsg, 'Passwords do not match');
            resetConfirm.focus();
            return;
        }

        var submitBtn = resetForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
            var r = await post('/api/auth/reset-password', {
                user: user,
                newPassword: resetNew.value,
                resetCode: resetCode.value
            });
            if (r.ok && r.data.success) {
                setMsg(resetMsg, r.data.message, true);
                setTimeout(function () {
                    resetModal.close();
                    userInput.value = user;
                    passwordInput.value = '';
                    passwordInput.focus();
                    setMsg(loginMsg, 'Password reset. Log in with your new password.', true);
                }, 900);
            } else {
                setMsg(resetMsg, r.data.message || 'Could not reset password');
            }
        } catch (err) {
            setMsg(resetMsg, 'Cannot reach server');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
