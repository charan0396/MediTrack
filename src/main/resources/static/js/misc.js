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

    var COLUMNS = ['Sr No', 'Recorded Date', 'Date', 'Name', 'Description', 'Amount'];
    if (window.isSuperUser) COLUMNS.splice(4, 0, 'Saved By');

    // The name starts as the logged-in user's own name and can be changed
    if (!window.isSuperUser) {
        nameInput.defaultValue = window.loggedInUser;
        nameInput.value = window.loggedInUser;
    }

    COLUMNS.forEach(function (label) {
        var th = document.createElement('th');
        th.textContent = label;
        if (label === 'Sr No') th.className = 'serial';
        head.appendChild(th);
    });

    function setMsg(text, ok) {
        msg.textContent = text || '';
        msg.classList.toggle('ok', !!ok);
    }

    function money(n) {
        return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function td(row, text, cls) {
        var cell = document.createElement('td');
        if (cls) cell.className = cls;
        if (text !== null && text !== undefined && text !== '') { cell.textContent = text; cell.title = text; }
        row.appendChild(cell);
    }

    function render(list) {
        body.textContent = '';
        var total = 0;
        if (!list.length) {
            var tr = document.createElement('tr');
            var cell = document.createElement('td');
            cell.colSpan = COLUMNS.length;
            cell.className = 'empty';
            cell.textContent = 'No entries saved yet.';
            tr.appendChild(cell);
            body.appendChild(tr);
            totalText.textContent = '';
            return;
        }
        list.forEach(function (e, i) {
            var tr = document.createElement('tr');
            td(tr, String(i + 1), 'serial');
            td(tr, e.recordedDate);
            td(tr, e.miscDate);
            td(tr, e.name);
            if (window.isSuperUser) td(tr, e.ownerName);
            td(tr, e.description);
            td(tr, money(e.amount));
            body.appendChild(tr);
            total += Number(e.amount || 0);
        });
        totalText.textContent = '· ' + list.length + (list.length === 1 ? ' entry' : ' entries') + ' · total ' + money(total);
    }

    async function load() {
        try {
            var res = await fetch('/api/misc');
            if (res.status === 401) { window.handleUnauthorized(); return; }
            if (!res.ok) throw new Error('bad status');
            render(await res.json());
        } catch (e) {
            setMsg('Could not load the saved entries from the server');
        }
    }

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

        submitBtn.disabled = true;
        try {
            var res = await fetch('/api/misc', {
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
                form.reset();
                window.showToast('Saved successfully');
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

    load();
})();
