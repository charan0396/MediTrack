(function () {
    // "Saved bills" table: one row per product, the invoice columns are merged over its products
    var body = document.getElementById('billRows');
    var msg = document.getElementById('savedMsg');
    var scopeNote = document.getElementById('savedNote');

    var modal = document.getElementById('previewModal');
    var previewTitle = document.getElementById('previewTitle');
    var previewBody = document.getElementById('previewBody');
    var previewDownload = document.getElementById('previewDownload');
    var previewClose = document.getElementById('previewClose');

    function imageUrl(billId) {
        return '/api/bills/' + encodeURIComponent(billId) + '/image';
    }

    function text(value) {
        return value === null || value === undefined || value === '' ? '' : String(value);
    }

    function money(value) {
        return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function quantity(value) {
        return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
        var groups = [], byId = {};
        rows.forEach(function (r) {
            if (!byId[r.billId]) {
                byId[r.billId] = { head: r, lines: [] };
                groups.push(byId[r.billId]);
            }
            byId[r.billId].lines.push(r);
        });
        return groups;
    }

    function render(rows) {
        body.textContent = '';
        if (!rows.length) {
            var tr = document.createElement('tr');
            var td = cell('No saved bills yet', 'empty');
            td.colSpan = 12;
            tr.appendChild(td);
            body.appendChild(tr);
            return;
        }

        groupByBill(rows).forEach(function (group, index) {
            var span = group.lines.length;
            var h = group.head;

            group.lines.forEach(function (line, i) {
                var tr = document.createElement('tr');

                if (i === 0) {
                    [
                        [String(index + 1), 'serial merged'],
                        [text(h.recordedDate), 'merged'],
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

                tr.appendChild(cell(text(line.product), i === 0 ? 'first-line' : ''));
                tr.appendChild(cell(quantity(line.quantity), 'num' + (i === 0 ? ' first-line' : '')));
                tr.appendChild(cell(money(line.price), 'num' + (i === 0 ? ' first-line' : '')));
                tr.appendChild(cell(money(line.lineTotal), 'num' + (i === 0 ? ' first-line' : '')));

                if (i === 0) {
                    var total = cell(money(h.totalAmount), 'num merged total-cell');
                    total.rowSpan = span;
                    tr.appendChild(total);

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
            render(await res.json());
            scopeNote.hidden = !window.isSuperUser;
            if (window.isSuperUser) scopeNote.textContent = 'Showing bills of all users.';
        } catch (err) {
            msg.textContent = 'Could not load the saved bills';
        }
    }

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
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePreview(); });

    window.addEventListener('bill-saved', load);
    load();
})();
