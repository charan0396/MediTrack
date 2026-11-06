/* Home page summary: built from the records and bills the logged-in user is allowed to see. */
(function () {
    var $ = function (id) { return document.getElementById(id); };
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var rupees = function (n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    var monthKey = function (d) { return String(d || '').slice(0, 7); };            // "2026-11"
    var now = new Date();
    var thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    var h = now.getHours();
    $('hello').textContent = (h < 12 ? 'Good morning, ' : h < 17 ? 'Good afternoon, ' : 'Good evening, ') + window.loggedInUser;
    $('helloSub').textContent = window.isSuperUser ? 'Super user: the numbers below cover all users.' : 'Here is a quick look at your records and bills.';

    function li(list, left, right) {
        var item = document.createElement('li'), a = document.createElement('span'), b = document.createElement('small');
        a.textContent = left; b.textContent = right; item.appendChild(a); item.appendChild(b); list.appendChild(item);
    }
    function empty(el, text) { el.textContent = ''; var p = document.createElement('p'); p.className = 'empty'; p.textContent = text; el.appendChild(p); }
    function bars(el, entries, fmt) {
        el.textContent = '';
        var max = Math.max.apply(null, entries.map(function (e) { return e[1]; }).concat([1]));
        entries.forEach(function (e) {
            var row = document.createElement('div'), label = document.createElement('span'), track = document.createElement('div'),
                fill = document.createElement('div'), val = document.createElement('span');
            row.className = 'bar-row'; track.className = 'bar-track'; fill.className = 'bar-fill';
            label.textContent = e[0]; val.textContent = fmt(e[1]); fill.style.width = (e[1] / max * 100) + '%';
            track.appendChild(fill); row.appendChild(label); row.appendChild(track); row.appendChild(val); el.appendChild(row);
        });
    }
    async function get(url) {
        var res = await fetch(url);
        if (res.status === 401) { window.handleUnauthorized(); throw new Error('unauthorized'); }
        if (!res.ok) throw new Error('bad status');
        return res.json();
    }

    function showRecords(records) {
        $('tRecords').textContent = records.length;
        $('tRecordsMonth').textContent = records.filter(function (r) { return monthKey(r.createdDate) === thisMonth; }).length;
        var list = $('recentRecords'); list.textContent = '';
        var sorted = records.slice().sort(function (a, b) { return String(b.updatedDate || '').localeCompare(String(a.updatedDate || '')); });
        if (!sorted.length) empty(list, 'No records yet.');
        sorted.slice(0, 5).forEach(function (r) {
            li(list, (r.name || '-') + ' · ' + (r.medicalType || '-') + (r.hospitalName ? ' · ' + r.hospitalName : ''), String(r.createdDate || '').slice(0, 10));
        });
        var counts = {};
        records.forEach(function (r) { var t = r.medicalType || 'Other'; counts[t] = (counts[t] || 0) + 1; });
        var entries = Object.keys(counts).map(function (t) { return [t, counts[t]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
        if (entries.length) bars($('typeBars'), entries, String); else empty($('typeBars'), 'No records yet.');
    }

    function showBills(rows) {
        var bills = {};                                  // one entry per invoice (list rows repeat per product)
        rows.forEach(function (r) { if (!bills[r.billId]) bills[r.billId] = r; });
        var all = Object.keys(bills).map(function (k) { return bills[k]; });
        var spendMonth = 0, spendAll = 0, billsMonth = 0, perMonth = {};
        all.forEach(function (b) {
            var amt = Number(b.totalAmount || 0), m = monthKey(b.billDate);
            spendAll += amt; perMonth[m] = (perMonth[m] || 0) + amt;
            if (m === thisMonth) { spendMonth += amt; billsMonth++; }
        });
        $('tBills').textContent = all.length; $('tBillsMonth').textContent = billsMonth;
        $('tSpendMonth').textContent = rupees(spendMonth); $('tSpendAll').textContent = rupees(spendAll);

        var list = $('recentBills'); list.textContent = '';
        all.sort(function (a, b) { return b.billId - a.billId; });
        if (!all.length) empty(list, 'No bills yet.');
        all.slice(0, 5).forEach(function (b) { li(list, (b.medicalShop || '-') + ' · ' + (b.name || '-'), rupees(b.totalAmount)); });

        var months = [];
        for (var i = 5; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            var key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            months.push([MONTHS[d.getMonth()] + ' ' + d.getFullYear(), perMonth[key] || 0]);
        }
        bars($('spendBars'), months, rupees);
    }

    get('/api/records').then(showRecords).catch(function () { $('homeMsg').textContent = 'Could not load records from the server'; });
    get('/api/bills').then(showBills).catch(function () { $('homeMsg').textContent = 'Could not load bills from the server'; });
})();
