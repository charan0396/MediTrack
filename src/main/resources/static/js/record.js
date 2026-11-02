(function () {
    var MAX_FILE = 10 * 1024 * 1024; // 10 MB per file, same as server limit
    var MAX_FILES = 10;              // per document type, same as server limit

    var form = document.getElementById('recordForm');
    var msg = document.getElementById('formMsg');
    var nameInput = document.getElementById('recName');
    var dateInput = document.getElementById('recDate');
    var typeInput = document.getElementById('recType');
    var submitBtn = document.getElementById('submitBtn');

    var modal = document.getElementById('confirmModal');
    var confirmText = document.getElementById('confirmText');
    var confirmYes = document.getElementById('confirmYes');
    var confirmNo = document.getElementById('confirmNo');

    // The name can be changed (a record may be for someone else). It starts as the logged-in user's own name.
    if (!window.isSuperUser) {
        nameInput.defaultValue = window.loggedInUser;
        nameInput.value = window.loggedInUser;
    }

    function setMsg(text, ok) {
        msg.textContent = text || '';
        msg.classList.toggle('ok', !!ok);
    }

    function resetFileLabel(input) {
        var box = input.parentElement;
        box.querySelector('.file-text').textContent = 'attachment';
        box.classList.remove('has-file');
        box.removeAttribute('title');
    }

    // Show chosen file name(s) inside the attachment box (several files allowed)
    form.querySelectorAll('input[type="file"]').forEach(function (input) {
        input.addEventListener('change', function () {
            var files = Array.prototype.slice.call(input.files);
            if (!files.length) {
                resetFileLabel(input);
                return;
            }
            var tooBig = files.filter(function (f) { return f.size > MAX_FILE; })[0];
            if (tooBig) {
                setMsg('"' + tooBig.name + '" is larger than 10 MB');
                input.value = '';
                resetFileLabel(input);
                return;
            }
            if (files.length > MAX_FILES) {
                setMsg('You can upload at most ' + MAX_FILES + ' files for each document type');
                input.value = '';
                resetFileLabel(input);
                return;
            }
            setMsg('');
            var box = input.parentElement;
            box.querySelector('.file-text').textContent =
                files.length === 1 ? files[0].name : files.length + ' files selected';
            box.title = files.map(function (f) { return f.name; }).join(', ');
            box.classList.add('has-file');
        });
    });

    // ---------- Confirmation popup ----------
    function openConfirm() {
        confirmText.textContent = 'Save this record for "' + nameInput.value.trim() + '" to the database?';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        confirmYes.focus();
    }

    function closeConfirm() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    confirmNo.addEventListener('click', closeConfirm);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closeConfirm();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeConfirm();
    });

    // Submit button -> validate -> ask for confirmation
    form.addEventListener('submit', function (e) {
        e.preventDefault();
        setMsg('');
        if (!nameInput.value.trim()) {
            setMsg('Name is required');
            nameInput.focus();
            return;
        }
        if (!dateInput.value) {
            setMsg('Date is required');
            dateInput.focus();
            return;
        }
        if (!typeInput.value.trim()) {
            setMsg('Medical Type is required');
            typeInput.focus();
            return;
        }
        openConfirm();
    });

    // Confirmed -> send everything (fields + files) to the server
    confirmYes.addEventListener('click', async function () {
        confirmYes.disabled = true;
        submitBtn.disabled = true;
        try {
            var res = await fetch('/api/records', {
                method: 'POST',
                body: new FormData(form) // multipart: text fields + all selected files
            });
            if (res.status === 401) {
                window.handleUnauthorized();
                return;
            }
            var data = {};
            try { data = await res.json(); } catch (err) { /* empty body */ }

            closeConfirm();
            if (res.ok && data.success) {
                form.reset();
                form.querySelectorAll('input[type="file"]').forEach(resetFileLabel);
                setMsg('');
                window.showToast('Record saved successfully');
            } else {
                setMsg(data.message || 'Could not save the record');
            }
        } catch (err) {
            closeConfirm();
            setMsg('Cannot reach server');
        } finally {
            confirmYes.disabled = false;
            submitBtn.disabled = false;
        }
    });
})();
