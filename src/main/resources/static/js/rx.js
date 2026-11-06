/* Prescription popup on the record page: when a prescription file is chosen, a popup shows the file beside the
   medicine fields. Submit saves the medicines (table "medicines") together with the prescription file. */
(function () {
    var MAX_MEDICINES = 30;
    var fileInput = document.querySelector('input[name="prescription"]');
    var openBtn = document.getElementById('rxOpen');
    var clearBtn = document.getElementById('rxClear');
    if (!fileInput) return;

    var modal = document.getElementById('rxModal');
    var form = document.getElementById('rxForm');
    var imageBox = document.getElementById('rxImage');
    var medsBox = document.getElementById('rxMeds');
    var countText = document.getElementById('rxCount');
    var msg = document.getElementById('rxMsg');
    var submitBtn = document.getElementById('rxSubmit');
    var f = {
        date: document.getElementById('rxDate'), name: document.getElementById('rxName'),
        type: document.getElementById('rxType'), dr: document.getElementById('rxDr'),
        hospital: document.getElementById('rxHospital')
    };

    // same medical types as the record form
    f.type.innerHTML = document.getElementById('recType').innerHTML;

    var queue = [];        // prescription files still to be entered
    var current = null;    // file shown in the popup
    var total = 0;
    var saved = [];        // files whose medicines are already saved (so they are not saved twice)
    var objectUrl = null;

    function setMsg(text, ok) {
        msg.textContent = text || '';
        msg.classList.toggle('ok', !!ok);
    }

    function extOf(name) {
        var i = name.lastIndexOf('.');
        return i < 0 ? '' : name.slice(i + 1).toLowerCase();
    }

    function renumber() {
        Array.prototype.forEach.call(medsBox.children, function (row, i) {
            row.querySelector('.sno').textContent = String(i + 1);
        });
    }

    function addMedicine() {
        if (medsBox.children.length >= MAX_MEDICINES) {
            setMsg('At most ' + MAX_MEDICINES + ' medicines');
            return;
        }
        var row = document.createElement('div');
        row.className = 'rx-med';
        row.innerHTML = '<span class="sno"></span>' +
            '<input type="text" class="input med-name" maxlength="200" aria-label="Medicine">' +
            '<input type="text" class="input med-desc" maxlength="500" aria-label="Medicine description">' +
            '<label class="tick"><input type="checkbox" class="med-morning" aria-label="Morning"></label>' +
            '<label class="tick"><input type="checkbox" class="med-afternoon" aria-label="Afternoon"></label>' +
            '<label class="tick"><input type="checkbox" class="med-night" aria-label="Night"></label>' +
            '<button type="button" class="rx-del" title="Remove" aria-label="Remove medicine">×</button>';
        row.querySelector('.rx-del').addEventListener('click', function () {
            if (medsBox.children.length > 1) {
                medsBox.removeChild(row);
                renumber();
            }
        });
        medsBox.appendChild(row);
        renumber();
        return row;
    }

    function showFile(file) {
        imageBox.textContent = '';
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        var ext = extOf(file.name);
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
            objectUrl = URL.createObjectURL(file);
            var img = document.createElement('img');
            img.alt = file.name;
            img.src = objectUrl;
            imageBox.appendChild(img);
        } else if (ext === 'pdf') {
            objectUrl = URL.createObjectURL(file);
            var frame = document.createElement('iframe');
            frame.title = file.name;
            frame.src = objectUrl;
            imageBox.appendChild(frame);
        } else {
            var p = document.createElement('p');
            p.textContent = file.name + ' (no preview for this file type)';
            imageBox.appendChild(p);
        }
    }

    // Opens the popup for the next file; the common fields start from what is typed on the record form
    function showNext() {
        current = queue.shift() || null;
        if (!current) { close(); return; }
        setMsg('');
        showFile(current);
        f.date.value = document.getElementById('recDate').value;
        f.name.value = document.getElementById('recName').value.trim();
        f.type.value = document.getElementById('recType').value;
        f.dr.value = document.getElementById('drName').value.trim();
        f.hospital.value = document.getElementById('hospitalName').value.trim();
        medsBox.textContent = '';
        addMedicine();
        var done = total - queue.length;
        countText.textContent = total > 1 ? 'Prescription ' + done + ' of ' + total + ' · ' + current.name : current.name;
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        medsBox.querySelector('.med-name').focus();
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        imageBox.textContent = '';
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
        current = null;
        queue = [];
        refreshOpenBtn();
    }

    function pending() {
        return Array.prototype.slice.call(fileInput.files).filter(function (file) { return saved.indexOf(file) === -1; });
    }

    function refreshOpenBtn() {
        openBtn.hidden = pending().length === 0;
        clearBtn.hidden = fileInput.files.length === 0;   // "Clear prescription" while a file is chosen
    }

    function start() {
        queue = pending();
        total = queue.length;
        if (total) showNext();
    }

    // A prescription was chosen (the record page has already checked size and count)
    fileInput.addEventListener('change', function () {
        saved = [];
        refreshOpenBtn();
        if (fileInput.files.length) start();
    });
    openBtn.addEventListener('click', start);

    // Clear: drop the chosen prescription file(s) (not wanted, or the wrong file). Medicines already saved stay saved.
    function clearPrescription() {
        if (modal.classList.contains('open')) close();
        fileInput.value = '';
        fileInput.dispatchEvent(new Event('change', { bubbles: true })); // record.js resets the label, this file resets the links
    }
    clearBtn.addEventListener('click', clearPrescription);
    document.getElementById('rxDiscard').addEventListener('click', clearPrescription); // same button inside the popup
    document.getElementById('rxAdd').addEventListener('click', function () {
        setMsg('');
        addMedicine().querySelector('.med-name').focus();
    });
    document.getElementById('rxCancel').addEventListener('click', function () {
        // skip this file; carry on with the next one, if any
        if (queue.length) showNext(); else close();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
    });

    // After the record itself is saved the form is reset: forget the files
    document.getElementById('recordForm').addEventListener('reset', function () {
        saved = [];
        setTimeout(refreshOpenBtn, 0);
    });

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMsg('');
        if (!f.date.value) { setMsg('Date is required'); f.date.focus(); return; }
        if (!f.name.value.trim()) { setMsg('Name is required'); f.name.focus(); return; }
        if (!f.type.value) { setMsg('Medical Type is required'); f.type.focus(); return; }

        var data = new FormData();
        data.append('date', f.date.value);
        data.append('name', f.name.value.trim());
        data.append('medicalType', f.type.value);
        data.append('drName', f.dr.value.trim());
        data.append('hospitalName', f.hospital.value.trim());
        if (current) data.append('image', current);

        var used = 0;
        for (var i = 0; i < medsBox.children.length; i++) {
            var row = medsBox.children[i];
            var med = row.querySelector('.med-name').value.trim();
            var desc = row.querySelector('.med-desc').value.trim();
            var any = desc || row.querySelector('.med-morning').checked || row.querySelector('.med-afternoon').checked
                || row.querySelector('.med-night').checked;
            if (!med) {
                if (any) { setMsg('Medicine name is required in row ' + (i + 1)); row.querySelector('.med-name').focus(); return; }
                continue; // empty row, ignore
            }
            used++;
            data.append('medicine', med);
            data.append('description', desc);
            data.append('morning', String(row.querySelector('.med-morning').checked));
            data.append('afternoon', String(row.querySelector('.med-afternoon').checked));
            data.append('night', String(row.querySelector('.med-night').checked));
        }
        if (!used) { setMsg('Add at least one medicine'); medsBox.querySelector('.med-name').focus(); return; }

        submitBtn.disabled = true;
        try {
            var res = await fetch('/api/medicines', { method: 'POST', body: data });
            if (res.status === 401) { window.handleUnauthorized(); return; }
            var body = {};
            try { body = await res.json(); } catch (err) { /* empty body */ }
            if (res.ok && body.success) {
                if (current) saved.push(current);
                window.showToast('Medicines saved successfully');
                if (queue.length) showNext(); else close();
            } else {
                setMsg(body.message || 'Could not save the medicines');
            }
        } catch (err) {
            setMsg('Cannot reach server');
        } finally {
            submitBtn.disabled = false;
        }
    });
})();
