(function () {
    var form = document.getElementById('miscForm');
    var msg = document.getElementById('miscMsg');
    var dateInput = document.getElementById('miscDate');
    var nameInput = document.getElementById('miscName');
    var descInput = document.getElementById('miscDesc');
    var amountInput = document.getElementById('miscAmount');
    var submitBtn = document.getElementById('miscSubmit');
    var head = document.getElementById('miscHead');
    var body = document.getElementById('miscBody');
    var totalText = document.getElementById('miscTotal');
    var banner = document.getElementById('miscEditBanner');
    var bannerText = document.getElementById('miscEditText');
    var fltName = document.getElementById('fltName');
    var fltFrom = document.getElementById('fltFrom');
    var fltTo = document.getElementById('fltTo');

    var COLUMNS = [
        { label: 'Sr No', serial: true },
        { label: 'Date', key: 'miscDate', date: true, cls: 'nowrap' },
        { label: 'Name', key: 'name' },
        { label: 'Description', key: 'description', cls: 'desc' },
        { label: 'Amount', key: 'amount', money: true, cls: 'num' },
        { label: 'Created By', key: 'createdBy' },
        { label: 'Created Date', key: 'createdDate', dateTime: true, cls: 'nowrap' },
        { label: 'Updated By', key: 'updatedBy', edited: true },
        { label: 'Updated Date', key: 'updatedDate', dateTime: true, edited: true, cls: 'nowrap' },
        { label: 'Action', action: true }
    ];

    var rows = [];
    var editingId = null;

    // The name starts as the logged-in user's own name and can be changed
    function defaultName() { return window.isSuperUser ? '' : window.loggedInUser; }
    nameInput.defaultValue = defaultName();
    nameInput.value = defaultName();

    COLUMNS.forEach(function (c) {
        var th = document.createElement('th');
        th.textContent = c.label;
        if (c.serial) th.className = 'serial';
        if (c.money) th.className = 'num';
        head.appendChild(th);
    });

    function setMsg(text, ok) {
        msg.textContent = text || '';
        msg.classList.toggle('ok', !!ok);
    }

    function money(n) {
        return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function dateOnly(v) { return v ? String(v).slice(0, 10) : ''; }
    function dateTime(v) { return v ? String(v).slice(0, 16).replace('T', ' ') : ''; }

    // Updated By / Updated Date are shown only for an entry that was edited
    function cellText(c, row, index) {
        if (c.serial) return String(index + 1);
        if (c.edited && !row.updatedBy) return '';
        var v = row[c.key];
        if (v === null || v === undefined || v === '') return '';
        if (c.money) return money(v);
        if (c.date) return dateOnly(v);
        if (c.dateTime) return dateTime(v);
        return String(v);
    }

    // ---------- filters: name + date range (on the entry Date) ----------
    function visible() {
        return rows.filter(function (r) {
            if (fltName.value && String(r.name || '').trim().toLowerCase() !== fltName.value) return false;
            var d = dateOnly(r.miscDate);
            if (fltFrom.value && d < fltFrom.value) return false;
            if (fltTo.value && d > fltTo.value) return false;
            return true;
        });
    }

    function buildNameFilter() {
        var keep = fltName.value;
        var seen = {}, options = [];
        rows.forEach(function (r) {
            var k = String(r.name || '').trim().toLowerCase();
            if (k && !seen[k]) { seen[k] = true; options.push({ key: k, label: String(r.name).trim() }); }
        });
        options.sort(function (a, b) { return a.label.localeCompare(b.label); });
        fltName.textContent = '';
        var all = document.createElement('option'); all.value = ''; all.textContent = 'All'; fltName.appendChild(all);
        options.forEach(function (o) {
            var opt = document.createElement('option'); opt.value = o.key; opt.textContent = o.label; fltName.appendChild(opt);
        });
        fltName.value = seen[keep] ? keep : '';
    }

    // ---------- table ----------
    function render() {
        body.textContent = '';
        var list = visible();
        if (!list.length) {
            var tr = document.createElement('tr');
            var cell = document.createElement('td');
            cell.colSpan = COLUMNS.length;
            cell.className = 'empty';
            cell.textContent = rows.length ? 'No entries match the selected filters.' : 'No entries saved yet.';
            tr.appendChild(cell);
            body.appendChild(tr);
            totalText.textContent = '';
            return;
        }
        var total = 0;
        list.forEach(function (e, i) {
            var tr = document.createElement('tr');
            COLUMNS.forEach(function (c) {
                var td = document.createElement('td');
                var cls = [];
                if (c.serial) cls.push('serial');
                if (c.cls) cls.push(c.cls);
                td.className = cls.join(' ');
                if (c.action) {
                    var btn = document.createElement('button');
                    btn.type = 'button'; btn.className = 'mini'; btn.textContent = 'Edit';
                    btn.addEventListener('click', function () { startEdit(e); });
                    td.appendChild(btn);
                } else {
                    var text = cellText(c, e, i);
                    if (text) { td.textContent = text; td.title = text; }
                }
                tr.appendChild(td);
            });
            body.appendChild(tr);
            total += Number(e.amount || 0);
        });
        totalText.textContent = '· ' + list.length + (list.length === 1 ? ' entry' : ' entries') + ' · total ' + money(total);
    }

    [fltName, fltFrom, fltTo].forEach(function (el) { el.addEventListener('change', render); });
    document.getElementById('fltClear').addEventListener('click', function () {
        fltName.value = ''; fltFrom.value = ''; fltTo.value = '';
        render();
    });

    async function load() {
        try {
            var res = await fetch('/api/misc');
            if (res.status === 401) { window.handleUnauthorized(); return; }
            if (!res.ok) throw new Error('bad status');
            rows = await res.json();
            buildNameFilter();
            render();
        } catch (e) {
            setMsg('Could not load the saved entries from the server');
        }
    }

    // ---------- edit ----------
    function startEdit(e) {
        editingId = e.id;
        dateInput.value = dateOnly(e.miscDate);
        nameInput.value = e.name || '';
        descInput.value = e.description || '';
        amountInput.value = e.amount === null || e.amount === undefined ? '' : String(e.amount);
        bannerText.textContent = 'Editing the entry of "' + (e.name || '') + '" dated ' + dateOnly(e.miscDate) + '. Change the fields and press Update.';
        banner.hidden = false;
        submitBtn.textContent = 'Update';
        setMsg('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        dateInput.focus();
    }

    function leaveEdit() {
        editingId = null;
        banner.hidden = true;
        submitBtn.textContent = 'Submit';
        form.reset();
        nameInput.value = defaultName();
        setMsg('');
    }
    document.getElementById('miscCancelEdit').addEventListener('click', leaveEdit);

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        setMsg('');
        var amount = amountInput.value.trim().replace(/,/g, '');
        if (!dateInput.value) { setMsg('Date is required'); dateInput.focus(); return; }
        if (!nameInput.value.trim()) { setMsg('Name is required'); nameInput.focus(); return; }
        if (!amount) { setMsg('Amount is required'); amountInput.focus(); return; }
        if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
            setMsg('Amount must be a number more than 0 (up to 2 decimals)');
            amountInput.focus();
            return;
        }

        var wasEdit = editingId !== null;
        submitBtn.disabled = true;
        try {
            var res = await fetch(wasEdit ? '/api/misc/' + encodeURIComponent(editingId) + '/update' : '/api/misc', {
                method: 'POST',
                body: new URLSearchParams({
                    date: dateInput.value,
                    name: nameInput.value.trim(),
                    description: descInput.value.trim(),
                    amount: amount
                })
            });
            if (res.status === 401) { window.handleUnauthorized(); return; }
            var data = {};
            try { data = await res.json(); } catch (err) { /* empty body */ }
            if (res.ok && data.success) {
                if (wasEdit) leaveEdit(); else { form.reset(); nameInput.value = defaultName(); }
                window.showToast(wasEdit ? 'Updated successfully' : 'Saved successfully');
                load();
            } else {
                setMsg(data.message || 'Could not save the entry');
            }
        } catch (err) {
            setMsg('Cannot reach server');
        } finally {
            submitBtn.disabled = false;
        }
    });

    // ---------- download (the rows as filtered) ----------
    function csvCell(value) {
        var text = value === null || value === undefined ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;   // stop Excel from running typed text as a formula
        return '"' + text.replace(/"/g, '""') + '"';
    }

    document.getElementById('miscDownload').addEventListener('click', function () {
        var list = visible();
        if (!list.length) { window.showToast('No entries to download'); return; }
        var cols = COLUMNS.filter(function (c) { return !c.action; });
        var lines = [cols.map(function (c) { return csvCell(c.label); }).join(',')];
        list.forEach(function (row, i) {
            lines.push(cols.map(function (c) {
                if (c.money) return csvCell(row[c.key] === null || row[c.key] === undefined ? '' : Number(row[c.key]).toFixed(2));
                return csvCell(cellText(c, row, i));
            }).join(','));
        });
        var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = String(window.loggedInUser || 'user').replace(/[^A-Za-z0-9_-]/g, '_') + '_MediMiscellaneous.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });

    load();
})();
