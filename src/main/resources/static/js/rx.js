/* Prescription popup.
   Record page: when a prescription file is chosen, the popup shows the file beside the medicine fields and Submit saves
   the medicines (table "medicines") together with the file.
   View page (Medicines): Rx.edit(row, rows) opens the same popup to change the medicines of a saved prescription. */
(function () {
    var MAX_MEDICINES = 30;
    var modal = document.getElementById('rxModal');
    if (!modal) return;

    var fileInput = document.querySelector('input[name="prescription"]');   // record page only
    var openBtn = document.getElementById('rxOpen');
    var clearBtn = document.getElementById('rxClear');
    var form = document.getElementById('rxForm');
    var imageBox = document.getElementById('rxImage');
    var medsBox = document.getElementById('rxMeds');
    var countText = document.getElementById('rxCount');
    var titleText = document.getElementById('rxTitle');
    var msg = document.getElementById('rxMsg');
    var submitBtn = document.getElementById('rxSubmit');
    var discardBtn = document.getElementById('rxDiscard');
    var f = {
        date: document.getElementById('rxDate'), name: document.getElementById('rxName'),
        type: document.getElementById('rxType'), dr: document.getElementById('rxDr'),
        hospital: document.getElementById('rxHospital')
    };

    // medical types of the dropdown
    f.type.textContent = '';
    var placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select medical type';
    f.type.appendChild(placeholder);
    (window.MEDICAL_TYPES || []).forEach(function (t) {
        var o = document.createElement('option');
        o.value = t;
        o.textContent = t;
        f.type.appendChild(o);
    });

    var queue = [];        // prescription files still to be entered (record page)
    var current = null;    // file shown in the popup (record page)
    var total = 0;
    var saved = [];        // files whose medicines are already saved (so they are not saved twice)
    var objectUrl = null;
    var editId = null;     // id of a medicine row when a saved prescription is being edited

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

    function addMedicine(line) {
        if (medsBox.children.length >= MAX_MEDICINES) {
            setMsg('At most ' + MAX_MEDICINES + ' medicines');
            return null;
        }
        var row = document.createElement('div');
        row.className = 'rx-med';
        row.innerHTML = '<span class="sno"></span>' +
            '<input type="text" class="input med-name" maxlength="200" data-suggest="medicine" aria-label="Medicine">' +
            '<input type="text" class="input med-desc" maxlength="500" aria-label="Medicine description">' +
            '<label class="tick"><input type="checkbox" class="med-morning" aria-label="Morning"></label>' +
            '<label class="tick"><input type="checkbox" class="med-afternoon" aria-label="Afternoon"></label>' +
            '<label class="tick"><input type="checkbox" class="med-night" aria-label="Night"></label>' +
            '<button type="button" class="rx-del" title="Remove" aria-label="Remove medicine">×</button>';
        if (line) {
            row.querySelector('.med-name').value = line.medicine || '';
            row.querySelector('.med-desc').value = line.description || '';
            row.querySelector('.med-morning').checked = !!line.morning;
            row.querySelector('.med-afternoon').checked = !!line.afternoon;
            row.querySelector('.med-night').checked = !!line.night;
        }
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

    function clearImage() {
        imageBox.textContent = '';
        if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    }

    function showNote(text) {
        var p = document.createElement('p');
        p.textContent = text;
        imageBox.appendChild(p);
    }

    // kind of preview by file name: a picture, a PDF, or nothing to show
    function showSource(src, name) {
        var ext = extOf(name);
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
            var img = document.createElement('img');
            img.alt = name;
            img.addEventListener('error', function () {
                imageBox.textContent = '';
                showNote('The prescription file could not be loaded.');
            });
            img.src = src;
            imageBox.appendChild(img);
        } else if (ext === 'pdf') {
            var frame = document.createElement('iframe');
            frame.title = name;
            frame.src = src;
            imageBox.appendChild(frame);
        } else {
            showNote(name + ' (no preview for this file type)');
        }
    }

    function showFile(file) {
        clearImage();
        var ext = extOf(file.name);
        if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'pdf') {
            objectUrl = URL.createObjectURL(file);
            showSource(objectUrl, file.name);
        } else {
            showNote(file.name + ' (no preview for this file type)');
        }
    }

    function openModal() {
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        medsBox.querySelector('.med-name').focus();
    }

    // ---------- record page: new prescription ----------
    function valueOf(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    // Opens the popup for the next file; the common fields start from what is typed on the record form
    function showNext() {
        current = queue.shift() || null;
        if (!current) { close(); return; }
        editId = null;
        titleText.textContent = 'Prescription medicines';
        submitBtn.textContent = 'Submit';
        discardBtn.hidden = false;
        setMsg('');
        showFile(current);
        f.date.value = valueOf('recDate');
        f.name.value = valueOf('recName');
        f.type.value = valueOf('recType');
        f.dr.value = valueOf('drName');
        f.hospital.value = valueOf('hospitalName');
        medsBox.textContent = '';
        addMedicine();
        var done = total - queue.length;
        countText.textContent = total > 1 ? 'Prescription ' + done + ' of ' + total + ' · ' + current.name : current.name;
        openModal();
    }

    function close() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        clearImage();
        current = null;
        queue = [];
        editId = null;
        if (fileInput) refreshOpenBtn();
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

    // Clear: drop the chosen prescription file(s) (not wanted, or the wrong file). Medicines already saved stay saved.
    function clearPrescription() {
        if (modal.classList.contains('open')) close();
        fileInput.value = '';
        fileInput.dispatchEvent(new Event('change', { bubbles: true })); // record.js resets the label, this file resets the links
    }

    if (fileInput) {
        // A prescription was chosen (the record page has already checked size and count)
        fileInput.addEventListener('change', function () {
            saved = [];
            refreshOpenBtn();
            if (fileInput.files.length && !document.body.dataset.edit) start();   // not when editing a saved record
        });
        openBtn.addEventListener('click', start);
        clearBtn.addEventListener('click', clearPrescription);
        discardBtn.addEventListener('click', clearPrescription); // same button inside the popup

        // After the record itself is saved the form is reset: forget the files
        document.getElementById('recordForm').addEventListener('reset', function () {
            saved = [];
            setTimeout(refreshOpenBtn, 0);
        });
    }

    // ---------- view page: edit a saved prescription ----------
    // row = any medicine row of the prescription, rows = all rows (to find the others of the same prescription)
    function edit(row, rows) {
        var group = rows.filter(function (r) { return r.prescriptionRef === row.prescriptionRef; })
            .sort(function (a, b) { return (a.sno - b.sno) || (a.id - b.id); });
        if (!group.length) group = [row];
        var first = group[0];

        editId = row.id;
        current = null;
        queue = [];
        titleText.textContent = 'Edit prescription medicines';
        submitBtn.textContent = 'Update';
        discardBtn.hidden = true;
        countText.textContent = first.prescriptionFileName || 'No prescription file saved';
        setMsg('');
        clearImage();
        if (first.prescriptionFileName) {
            showSource('/api/medicines/' + encodeURIComponent(row.id) + '/image', first.prescriptionFileName);
        } else {
            showNote('No prescription file was saved with these medicines.');
        }
        f.date.value = first.medDate ? String(first.medDate).slice(0, 10) : '';
        f.name.value = first.name || '';
        f.type.value = first.medicalType || '';
        f.dr.value = first.drName || '';
        f.hospital.value = first.hospitalName || '';
        medsBox.textContent = '';
        group.forEach(function (r) { addMedicine(r); });
        openModal();
    }
    window.Rx = { edit: edit };

    // ---------- shared ----------
    document.getElementById('rxAdd').addEventListener('click', function () {
        setMsg('');
        var row = addMedicine();
        if (row) row.querySelector('.med-name').focus();
    });
    document.getElementById('rxCancel').addEventListener('click', function () {
        // skip this file; carry on with the next one, if any
        if (queue.length) showNext(); else close();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
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
        if (current && editId === null) data.append('image', current);

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

        var editing = editId !== null;
        submitBtn.disabled = true;
        try {
            var res = await fetch(editing ? '/api/medicines/' + encodeURIComponent(editId) + '/update' : '/api/medicines',
                { method: 'POST', body: data });
            if (res.status === 401) { window.handleUnauthorized(); return; }
            var body = {};
            try { body = await res.json(); } catch (err) { /* empty body */ }
            if (res.ok && body.success) {
                if (current) saved.push(current);
                window.showToast(editing ? 'Medicines updated successfully' : 'Medicines saved successfully');
                if (editing) {
                    close();
                    document.dispatchEvent(new CustomEvent('rx-saved'));
                } else if (queue.length) {
                    showNext();
                } else {
                    close();
                }
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
