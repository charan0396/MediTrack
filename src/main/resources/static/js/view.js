(function () {
    // Table columns, in display order. serial = running number, files = list of attachments
    var COLUMNS = [
        { label: 'Sr No', serial: true },
        { label: 'Recorded Date', key: 'updatedDate', date: true },
        { label: 'Name', key: 'name' },
        { label: 'Date', key: 'createdDate', date: true },
        { label: 'Medical Type', key: 'medicalType' },
        { label: 'Hospital Name', key: 'hospitalName' },
        { label: 'Dr Name', key: 'drName' },
        { label: 'Address', key: 'address' },
        { label: 'Diagnostic Center', key: 'diagnosticCenter' },
        { label: 'Details', key: 'details' },
        { label: 'Diag Address', key: 'diagAddress' },
        { label: 'Prescription', key: 'prescription', files: true },
        { label: 'Bill', key: 'bill', files: true },
        { label: 'Scan', key: 'scan', files: true },
        { label: 'Others', key: 'others', files: true }
    ];

    // Columns of the "Medicines" view. yesno = tick for true; image = prescription file of the row
    var MED_COLUMNS = [
        { label: 'Sr No', serial: true },
        { label: 'Recorded Date', key: 'createdDate', date: true },
        { label: 'Date', key: 'medDate', date: true },
        { label: 'Name', key: 'name' },
        { label: 'Medical Type', key: 'medicalType' },
        { label: 'Dr Name', key: 'drName' },
        { label: 'Hospital Name', key: 'hospitalName' },
        { label: 'Medicine', key: 'medicine' },
        { label: 'Medicine Description', key: 'description' },
        { label: 'Morning', key: 'morning', yesno: true },
        { label: 'Afternoon', key: 'afternoon', yesno: true },
        { label: 'Night', key: 'night', yesno: true },
        { label: 'Prescription', key: 'prescriptionFileName', image: true }
    ];
    var RECORD_COLUMNS = COLUMNS;

    // One dropdown per entry. Options are the unique values found in the table.
    // The Name filter is only for the super user (a normal user sees only his own records).
    var RECORD_FILTERS = [
        { key: 'name', label: 'Name', superOnly: true },
        { key: 'hospitalName', label: 'Hospital' },
        { key: 'drName', label: 'Dr Name' },
        { key: 'diagnosticCenter', label: 'Diagnostic Center' }
    ].filter(function (f) { return !f.superOnly || window.isSuperUser; });
    var FILTERS = RECORD_FILTERS;
    var mode = 'records';   // "records" = Medical Records, "medicines" = Medicines
    var viewTypeSelect = document.getElementById('viewType');
    var IMAGE_EXT = ['png', 'jpg', 'jpeg'];

    var headRow = document.getElementById('headRow');
    var body = document.getElementById('rowsBody');
    var msg = document.getElementById('viewMsg');
    var scopeNote = document.getElementById('scopeNote');
    var filtersBox = document.getElementById('filters');
    var downloadBtn = document.getElementById('downloadBtn');

    var modal = document.getElementById('previewModal');
    var previewTitle = document.getElementById('previewTitle');
    var previewBody = document.getElementById('previewBody');
    var previewDownload = document.getElementById('previewDownload');
    var previewClose = document.getElementById('previewClose');

    var dateFilter = document.getElementById('dateFilter');
    var dateFrom = document.getElementById('dateFrom');
    var dateTo = document.getElementById('dateTo');

    var rows = [];      // everything the server returned for this user
    var selected = {};  // filter key -> chosen value ('' or missing = All)

    function fileUrl(fileId) {
        return '/api/records/files/' + encodeURIComponent(fileId);
    }

    function imageUrl(rowId) {
        return '/api/medicines/' + encodeURIComponent(rowId) + '/image';
    }

    function extOf(name) {
        var i = name.lastIndexOf('.');
        return i < 0 ? '' : name.slice(i + 1).toLowerCase();
    }

    function norm(value) {
        return String(value || '').trim().toLowerCase();
    }

    // Rows that match every dropdown that is not on "All"
    function visibleRows() {
        return rows.filter(function (row) {
            if (mode === 'medicines') {   // date range on the prescription Date
                var d = row.medDate ? String(row.medDate).slice(0, 10) : '';
                if (dateFrom.value && (!d || d < dateFrom.value)) return false;
                if (dateTo.value && (!d || d > dateTo.value)) return false;
            }
            return FILTERS.every(function (f) {
                return !selected[f.key] || norm(row[f.key]) === selected[f.key];
            });
        });
    }

    // ---------- Header ----------
    function renderHeader() {
        headRow.textContent = '';
        COLUMNS.forEach(function (col) {
            var th = document.createElement('th');
            th.textContent = col.label;
            if (col.serial) th.className = 'serial';
            headRow.appendChild(th);
        });
        var act = document.createElement('th');
        act.textContent = 'Action';
        act.className = 'serial';
        headRow.appendChild(act);
    }

    // ---------- Filter dropdowns ----------
    function renderFilters() {
        filtersBox.textContent = '';
        FILTERS.forEach(function (f) {
            var seen = {};
            var options = [];
            rows.forEach(function (r) {
                var key = norm(r[f.key]);
                if (key && !seen[key]) {
                    seen[key] = true;
                    options.push({ key: key, label: String(r[f.key]).trim() });
                }
            });
            options.sort(function (a, b) { return a.label.localeCompare(b.label); });
            if (selected[f.key] && !seen[selected[f.key]]) selected[f.key] = '';

            var wrap = document.createElement('label');
            wrap.className = 'filter';
            var caption = document.createElement('span');
            caption.textContent = f.label;
            var select = document.createElement('select');
            select.setAttribute('aria-label', 'Filter by ' + f.label);

            var all = document.createElement('option');
            all.value = '';
            all.textContent = 'All';
            select.appendChild(all);
            options.forEach(function (o) {
                var opt = document.createElement('option');
                opt.value = o.key;
                opt.textContent = o.label;
                select.appendChild(opt);
            });
            select.value = selected[f.key] || '';

            select.addEventListener('change', function () {
                selected[f.key] = select.value;
                render();
            });

            wrap.appendChild(caption);
            wrap.appendChild(select);
            filtersBox.appendChild(wrap);
        });
    }

    // ---------- Table ----------
    function messageRow(text) {
        var tr = document.createElement('tr');
        var td = document.createElement('td');
        td.colSpan = COLUMNS.length + 1;
        td.className = 'empty';
        td.textContent = text;
        tr.appendChild(td);
        body.appendChild(tr);
    }

    function render() {
        body.textContent = '';
        var list = visibleRows();
        if (!list.length) {
            messageRow(rows.length ? 'No records match the selected filters.'
                : (mode === 'medicines' ? 'No medicines saved yet. Upload a prescription on the "record" page to add some.'
                    : 'No records saved yet. Use "record" to add one.'));
            return;
        }
        list.forEach(function (row, index) {
            var tr = document.createElement('tr');
            COLUMNS.forEach(function (col) {
                var td = document.createElement('td');
                if (col.serial) {
                    td.className = 'serial';
                    td.textContent = String(index + 1);
                } else if (col.yesno) {
                    td.className = 'serial';
                    td.textContent = row[col.key] ? '\u2714' : '';
                } else if (col.image) {
                    td.className = 'files-cell';
                    if (row[col.key]) {
                        var imgLink = document.createElement('button');
                        imgLink.type = 'button';
                        imgLink.className = 'file-link';
                        imgLink.textContent = row[col.key];
                        imgLink.title = 'Open ' + row[col.key];
                        imgLink.addEventListener('click', function () {
                            openPreview(imageUrl(row.id), row[col.key]);
                        });
                        td.appendChild(imgLink);
                    }
                } else if (col.files) {
                    td.className = 'files-cell';
                    (row[col.key] || []).forEach(function (file) {
                        var link = document.createElement('button');
                        link.type = 'button';
                        link.className = 'file-link';
                        link.textContent = file.fileName;
                        link.title = 'Open ' + file.fileName;
                        link.addEventListener('click', function () {
                            openPreview(fileUrl(file.id), file.fileName);
                        });
                        td.appendChild(link);
                    });
                } else {
                    var value = row[col.key];
                    if (col.date && value) value = String(value).slice(0, 10);
                    if (value !== null && value !== undefined && value !== '') {
                        td.textContent = value;
                        td.title = value;
                    }
                }
                tr.appendChild(td);
            });
            var actTd = document.createElement('td');
            actTd.className = 'serial';
            var editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'file-link';
            editBtn.textContent = 'Edit';
            editBtn.title = mode === 'medicines' ? 'Edit this prescription' : 'Edit this record';
            editBtn.addEventListener('click', function () {
                if (mode === 'medicines') window.Rx.edit(row, rows);
                else window.location.href = 'record.html?edit=' + encodeURIComponent(row.id);
            });
            actTd.appendChild(editBtn);
            tr.appendChild(actTd);
            body.appendChild(tr);
        });
    }

    document.addEventListener('rx-saved', load);
    [dateFrom, dateTo].forEach(function (el) { el.addEventListener('change', render); });
    document.getElementById('dateClear').addEventListener('click', function () {
        dateFrom.value = '';
        dateTo.value = '';
        render();
    });

    async function load() {
        msg.textContent = '';
        try {
            var res = await fetch(mode === 'medicines' ? '/api/medicines' : '/api/records');
            if (res.status === 401) {
                window.handleUnauthorized();
                return;
            }
            if (!res.ok) throw new Error('bad status');
            rows = await res.json();
        } catch (e) {
            rows = [];
            msg.textContent = 'Could not load ' + (mode === 'medicines' ? 'medicines' : 'records') + ' from the server';
        }
        renderHeader();
        renderFilters();
        render();
    }

    // View Type dropdown: Medical Records (table + filter dropdowns) or Medicines (table only, no other dropdowns)
    viewTypeSelect.addEventListener('change', function () {
        mode = viewTypeSelect.value === 'medicines' ? 'medicines' : 'records';
        COLUMNS = mode === 'medicines' ? MED_COLUMNS : RECORD_COLUMNS;
        FILTERS = mode === 'medicines' ? [] : RECORD_FILTERS;
        filtersBox.hidden = mode === 'medicines';
        dateFilter.hidden = mode !== 'medicines';
        dateFrom.value = '';
        dateTo.value = '';
        selected = {};
        rows = [];
        load();
    });

    if (window.isSuperUser) {
        scopeNote.textContent = 'Super user: showing records of all users';
        scopeNote.hidden = false;
    }

    // ---------- Attachment preview popup ----------
    function openPreview(url, fileName) {
        var ext = extOf(fileName);

        previewTitle.textContent = fileName;
        previewDownload.href = url + '?download=true';
        previewDownload.setAttribute('download', fileName);
        previewBody.textContent = '';

        if (IMAGE_EXT.indexOf(ext) !== -1) {
            var img = document.createElement('img');
            img.alt = fileName;
            img.addEventListener('error', function () {
                previewBody.textContent = '';
                var p = document.createElement('p');
                p.className = 'preview-note';
                p.textContent = 'The file could not be loaded.';
                previewBody.appendChild(p);
            });
            img.src = url;
            previewBody.appendChild(img);
        } else if (ext === 'pdf') {
            var frame = document.createElement('iframe');
            frame.title = fileName;
            frame.src = url;
            previewBody.appendChild(frame);
        } else {
            var note = document.createElement('p');
            note.className = 'preview-note';
            note.textContent = 'Preview is not available for this file type. Use Download to open it.';
            previewBody.appendChild(note);
        }

        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        previewClose.focus();
    }

    function closePreview() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        previewBody.textContent = ''; // stops loading / clears the file
    }

    previewClose.addEventListener('click', closePreview);
    modal.addEventListener('click', function (e) {
        if (e.target === modal) closePreview();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closePreview();
    });

    // ---------- Download the table as shown (CSV opens in Excel) ----------
    function csvCell(value) {
        var text = value === null || value === undefined ? '' : String(value);
        // stop Excel from running typed text as a formula
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function cellValue(col, row, index) {
        if (col.serial) return index + 1;
        if (col.yesno) return row[col.key] ? 'Yes' : 'No';
        if (col.date) return row[col.key] ? String(row[col.key]).slice(0, 10) : '';
        if (col.files) {
            return (row[col.key] || []).map(function (f) { return f.fileName; }).join('; ');
        }
        return row[col.key];
    }

    function safeFilePart(text) {
        return String(text || 'user').replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function downloadCsv() {
        var list = visibleRows();
        if (!list.length) {
            window.showToast('No records to download');
            return;
        }
        var lines = [COLUMNS.map(function (c) { return csvCell(c.label); }).join(',')];
        list.forEach(function (row, index) {
            lines.push(COLUMNS.map(function (c) { return csvCell(cellValue(c, row, index)); }).join(','));
        });

        // BOM so Excel reads UTF-8 correctly
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = safeFilePart(window.loggedInUser) + (mode === 'medicines' ? '_MediMedicines.csv' : '_MediRecords.csv'); // e.g. Sai_MediRecords.csv
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    downloadBtn.addEventListener('click', downloadCsv);

    load();
})();
