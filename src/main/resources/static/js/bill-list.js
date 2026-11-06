(function () {
    // "Saved bills" table: one row per product, the invoice columns are merged over its products.
    // Filters work on whole invoices. Each invoice has Edit and Delete buttons.
    var COLUMNS = 20;

    // One dropdown per entry. Options are the unique values found in the table.
    var FILTERS = [
        { key: 'name', label: 'Name', value: function (g) { return g.head.name; } },
        { key: 'shop', label: 'Medical Shop', value: function (g) { return g.head.medicalShop; } },
        { key: 'invoice', label: 'Invoice Number', value: function (g) { return g.head.invoiceNumber; } },
        { key: 'product', label: 'Product', multi: true, value: function (g) { return g.lines.map(function (l) { return l.product; }); } },
        { key: 'status', label: 'Status', value: function (g) { return g.head.status || ''; }, blankLabel: 'No changes' }
    ];

    var body = document.getElementById('billRows');
    var msg = document.getElementById('savedMsg');
    var note = document.getElementById('savedNote');
    var filtersBox = document.getElementById('savedFilters');
    var clearFiltersBtn = document.getElementById('clearFilters');
    var downloadBtn = document.getElementById('downloadBills');

    var modal = document.getElementById('previewModal');
    var previewTitle = document.getElementById('previewTitle');
    var previewBody = document.getElementById('previewBody');
    var previewDownload = document.getElementById('previewDownload');
    var previewClose = document.getElementById('previewClose');

    var deleteModal = document.getElementById('deleteModal');
    var deleteText = document.getElementById('deleteText');
    var deleteYes = document.getElementById('deleteYes');
    var deleteNo = document.getElementById('deleteNo');

    var groups = [];          // every invoice the server returned for this user
    var selected = {};        // filter key -> chosen value (missing = All)
    var from = '', to = '';   // bill date range
    var pendingDelete = null;

    // ---------- small helpers ----------
    function imageUrl(billId) {
        return '/api/bills/' + encodeURIComponent(billId) + '/image';
    }

    function text(value) {
        return value === null || value === undefined ? '' : String(value);
    }

    function money(value) {
        return Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function quantity(value) {
        return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    // 2026-10-30T17:45:12.123 -> 2026-10-30 17:45
    function dateTime(value) {
        return value ? String(value).replace('T', ' ').slice(0, 16) : '';
    }

    function cell(content, className) {
        var td = document.createElement('td');
        if (className) td.className = className;
        td.textContent = content;
        if (content) td.title = content;
        return td;
    }

    // Group the flat rows (one per product) by invoice, keeping the order the server sent
    function groupByBill(rows) {
        var list = [], byId = {};
        rows.forEach(function (r) {
            if (!byId[r.billId]) {
                byId[r.billId] = { head: r, lines: [] };
                list.push(byId[r.billId]);
            }
            byId[r.billId].lines.push(r);
        });
        return list;
    }

    function subTotalOf(g) {
        if (g.head.subTotal !== null && g.head.subTotal !== undefined) return g.head.subTotal;
        return g.lines.reduce(function (s, l) { return s + Number(l.lineTotal); }, 0); // invoices saved before sub total existed
    }

    // ---------- filters ----------
    function matches(g) {
        for (var i = 0; i < FILTERS.length; i++) {
            var f = FILTERS[i], want = selected[f.key];
            if (want === undefined || want === null) continue;
            var have = f.value(g);
            if (f.multi ? have.indexOf(want) < 0 : have !== want) return false;
        }
        var d = g.head.billDate || '';
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    }

    function uniqueValues(filter) {
        var seen = {}, values = [];
        groups.forEach(function (g) {
            [].concat(filter.value(g)).forEach(function (v) {
                v = text(v);
                if (!seen[v] && (v !== '' || filter.blankLabel)) { seen[v] = true; values.push(v); }
            });
        });
        return values.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    }

    function buildFilters() {
        filtersBox.textContent = '';

        FILTERS.forEach(function (f) {
            var values = uniqueValues(f);
            if (selected[f.key] !== undefined && values.indexOf(selected[f.key]) < 0) delete selected[f.key]; // value is gone

            var wrap = document.createElement('label');
            wrap.className = 'filter';
            wrap.appendChild(document.createTextNode(f.label));
            var select = document.createElement('select');
            select.setAttribute('aria-label', f.label);

            var all = document.createElement('option');
            all.value = '';
            all.textContent = 'All';
            select.appendChild(all);
            values.forEach(function (v, i) {
                var o = document.createElement('option');
                o.value = String(i);
                o.textContent = v === '' ? f.blankLabel : v;
                select.appendChild(o);
                if (selected[f.key] === v) select.value = String(i);
            });

            select.addEventListener('change', function () {
                if (select.value === '') delete selected[f.key];
                else selected[f.key] = values[Number(select.value)];
                render();
            });
            wrap.appendChild(select);
            filtersBox.appendChild(wrap);
        });

        [['From', from, function (v) { from = v; }], ['To', to, function (v) { to = v; }]].forEach(function (d) {
            var wrap = document.createElement('label');
            wrap.className = 'filter';
            wrap.appendChild(document.createTextNode('Bill date ' + d[0].toLowerCase()));
            var input = document.createElement('input');
            input.type = 'date';
            input.value = d[1];
            input.setAttribute('aria-label', 'Bill date ' + d[0].toLowerCase());
            input.addEventListener('change', function () { d[2](input.value); render(); });
            wrap.appendChild(input);
            filtersBox.appendChild(wrap);
        });
    }

    clearFiltersBtn.addEventListener('click', function () {
        selected = {};
        from = '';
        to = '';
        buildFilters();
        render();
    });

    // ---------- table ----------
    function actionButton(label, className, handler) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'mini ' + className;
        b.textContent = label;
        b.addEventListener('click', handler);
        return b;
    }

    function render() {
        body.textContent = '';
        var shown = groups.filter(matches);

        var count = shown.length + ' of ' + groups.length + ' invoices';
        note.textContent = (window.isSuperUser ? 'Showing bills of all users. ' : '') + count;

        if (!shown.length) {
            var tr = document.createElement('tr');
            var td = cell(groups.length ? 'No bills match the filters' : 'No saved bills yet', 'empty');
            td.colSpan = COLUMNS;
            tr.appendChild(td);
            body.appendChild(tr);
            return;
        }

        shown.forEach(function (group, index) {
            var span = group.lines.length;
            var h = group.head;

            group.lines.forEach(function (line, i) {
                var tr = document.createElement('tr');
                var edge = i === 0 ? ' first-line' : '';

                if (i === 0) {
                    [
                        [String(index + 1), 'serial merged'],
                        [text(h.createdDate).slice(0, 10), 'merged'],
                        [text(h.name), 'merged'],
                        [text(h.billDate), 'merged'],
                        [text(h.medicalShop), 'merged'],
                        [text(h.invoiceNumber), 'merged']
                    ].forEach(function (c) {
                        var td = cell(c[0], c[1]);
                        td.rowSpan = span;
                        tr.appendChild(td);
                    });
                }

                tr.appendChild(cell(text(line.product), edge.trim()));
                tr.appendChild(cell(quantity(line.quantity), 'num' + edge));
                tr.appendChild(cell(money(line.price), 'num' + edge));
                tr.appendChild(cell(money(line.lineTotal), 'num' + edge));

                if (i === 0) {
                    var discount = money(h.discountAmount) +
                        (h.discountType === 'PERCENT' && h.discountValue ? ' (' + Number(h.discountValue) + '%)' : '');
                    var merged = [
                        [money(subTotalOf(group)), 'num merged'],
                        [discount, 'num merged'],
                        [h.gstPercent === null || h.gstPercent === undefined ? '' : String(Number(h.gstPercent)), 'num merged'],
                        [money(h.gstAmount), 'num merged'],
                        [money(h.totalAmount), 'num merged total-cell']
                    ];
                    merged.forEach(function (c) {
                        var td = cell(c[0], c[1]);
                        td.rowSpan = span;
                        tr.appendChild(td);
                    });

                    // status, update date and update by stay empty until the invoice is edited
                    var statusTd = cell('', 'merged');
                    statusTd.rowSpan = span;
                    if (h.status) {
                        var badge = document.createElement('span');
                        badge.className = 'badge';
                        badge.textContent = h.status;
                        statusTd.appendChild(badge);
                    }
                    tr.appendChild(statusTd);
                    [dateTime(h.updatedDate), text(h.updatedBy)].forEach(function (v) {
                        var td = cell(v, 'merged');
                        td.rowSpan = span;
                        tr.appendChild(td);
                    });

                    var file = document.createElement('td');
                    file.className = 'merged';
                    file.rowSpan = span;
                    if (h.billFileName) {
                        var link = document.createElement('button');
                        link.type = 'button';
                        link.className = 'file-link';
                        link.textContent = h.billFileName;
                        link.title = h.billFileName;
                        link.addEventListener('click', function () { openPreview(h.billId, h.billFileName); });
                        file.appendChild(link);
                    } else {
                        var none = document.createElement('span');
                        none.className = 'none';
                        none.textContent = 'no image';
                        file.appendChild(none);
                    }
                    tr.appendChild(file);

                    var actions = document.createElement('td');
                    actions.className = 'merged';
                    actions.rowSpan = span;
                    var box = document.createElement('div');
                    box.className = 'row-actions';
                    box.appendChild(actionButton('Edit', 'edit', function () { window.BillForm.startEdit(group); }));
                    box.appendChild(actionButton('Delete', 'del', function () { askDelete(group); }));
                    actions.appendChild(box);
                    tr.appendChild(actions);
                }
                body.appendChild(tr);
            });
        });
    }

    async function load() {
        msg.textContent = '';
        try {
            var res = await fetch('/api/bills', { cache: 'no-store' });
            if (res.status === 401) {
                window.handleUnauthorized();
                return;
            }
            if (!res.ok) throw new Error('bad status');
            groups = groupByBill(await res.json());
            buildFilters();
            render();
        } catch (err) {
            msg.textContent = 'Could not load the saved bills';
        }
    }

    // ---------- Delete ----------
    function askDelete(group) {
        var h = group.head;
        pendingDelete = group;
        deleteText.textContent = 'Delete the invoice' + (h.invoiceNumber ? ' ' + h.invoiceNumber : '') + ' of "' + h.name +
            '" (' + group.lines.length + (group.lines.length === 1 ? ' product' : ' products') + ', total ₹ ' +
            money(h.totalAmount) + ')? It is removed from this list, and a copy is kept in the deleted records for tracking.';
        deleteModal.classList.add('open');
        deleteModal.setAttribute('aria-hidden', 'false');
        deleteNo.focus();
    }

    function closeDelete() {
        pendingDelete = null;
        deleteModal.classList.remove('open');
        deleteModal.setAttribute('aria-hidden', 'true');
    }

    deleteNo.addEventListener('click', closeDelete);
    deleteModal.addEventListener('click', function (e) { if (e.target === deleteModal) closeDelete(); });

    deleteYes.addEventListener('click', async function () {
        if (!pendingDelete) return;
        var id = pendingDelete.head.billId;
        deleteYes.disabled = true;
        try {
            var res = await fetch('/api/bills/' + encodeURIComponent(id), { method: 'DELETE' });
            if (res.status === 401) {
                window.handleUnauthorized();
                return;
            }
            var data = {};
            try { data = await res.json(); } catch (err) { /* empty body */ }
            closeDelete();
            if (res.ok && data.success) {
                if (window.BillForm.editingId() === id) window.BillForm.cancelEdit(); // it was open in the form
                window.showToast('Invoice deleted');
            } else if (res.status !== 404) {
                msg.textContent = data.message || 'Could not delete the invoice';
            }
            load();
        } catch (err) {
            closeDelete();
            msg.textContent = 'Cannot reach server';
        } finally {
            deleteYes.disabled = false;
        }
    });

    // ---------- Download the table as shown (CSV opens in Excel) ----------
    // One row per product with the invoice columns repeated, plain numbers, so Excel can sort and add them up.
    var CSV_HEADINGS = ['Sr No', 'Recorded Date', 'Name', 'Date', 'Medical Shop', 'Invoice Number', 'Product', 'Quantity',
        'Price', 'Line Total', 'Sub Total', 'Discount', 'GST %', 'GST Amount', 'Total Amount', 'Status', 'Update Date',
        'Update By', 'Captured Bill'];

    function csvCell(value) {
        var t = value === null || value === undefined ? '' : String(value);
        if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; // stop Excel from running typed text as a formula
        return '"' + t.replace(/"/g, '""') + '"';
    }

    function plain(value) {
        return Number(value || 0).toFixed(2);
    }

    function safeFilePart(t) {
        return String(t || 'user').replace(/[^A-Za-z0-9_-]/g, '_');
    }

    function downloadCsv() {
        var shown = groups.filter(matches);
        if (!shown.length) {
            window.showToast('No bills to download');
            return;
        }
        var lines = [CSV_HEADINGS.map(csvCell).join(',')];
        shown.forEach(function (g, index) {
            var h = g.head;
            g.lines.forEach(function (line) {
                lines.push([
                    index + 1, text(h.createdDate).slice(0, 10), h.name, h.billDate, h.medicalShop, h.invoiceNumber, line.product,
                    Number(line.quantity), plain(line.price), plain(line.lineTotal), plain(subTotalOf(g)),
                    plain(h.discountAmount),
                    h.gstPercent === null || h.gstPercent === undefined ? '' : Number(h.gstPercent),
                    plain(h.gstAmount), plain(h.totalAmount), h.status, dateTime(h.updatedDate), h.updatedBy,
                    h.billFileName
                ].map(csvCell).join(','));
            });
        });

        // BOM so Excel reads UTF-8 correctly
        var blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = safeFilePart(window.loggedInUser) + '_MediBills.csv'; // e.g. Sai_MediBills.csv
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    downloadBtn.addEventListener('click', downloadCsv);

    // ---------- Captured bill preview popup ----------
    function openPreview(billId, fileName) {
        var url = imageUrl(billId);
        previewTitle.textContent = fileName;
        previewDownload.href = url + '?download=true';
        previewDownload.setAttribute('download', fileName);
        previewBody.textContent = '';
        var img = document.createElement('img');
        img.alt = fileName;
        img.src = url;
        previewBody.appendChild(img);
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        previewClose.focus();
    }

    function closePreview() {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        previewBody.textContent = '';
    }

    previewClose.addEventListener('click', closePreview);
    modal.addEventListener('click', function (e) { if (e.target === modal) closePreview(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closePreview(); closeDelete(); }
    });

    window.addEventListener('bill-saved', load);
    load();
})();
