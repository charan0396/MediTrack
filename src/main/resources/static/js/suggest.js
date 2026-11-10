/* Suggestions from the values you entered recently.
   Inputs marked data-suggest="<key>" show a list of the last values saved with that key (the browser's own dropdown
   while typing). The list is kept in this browser, separately for each logged-in user, and is filled when a form is
   submitted. Nothing is sent to the server. */
(function () {
    var MAX = 15;

    function storageKey(key) {
        return 'meditrack.recent.' + String(window.loggedInUser || '').toLowerCase() + '.' + key;
    }

    function load(key) {
        try {
            var list = JSON.parse(localStorage.getItem(storageKey(key)) || '[]');
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function remember(key, value) {
        var v = String(value || '').trim();
        if (!v) return;
        var list = load(key).filter(function (x) { return String(x).toLowerCase() !== v.toLowerCase(); });
        list.unshift(v);
        try {
            localStorage.setItem(storageKey(key), JSON.stringify(list.slice(0, MAX)));
        } catch (e) { /* storage full or blocked: suggestions simply stay as they were */ }
    }

    function datalistFor(key) {
        var id = 'recent-' + key;
        var dl = document.getElementById(id);
        if (!dl) {
            dl = document.createElement('datalist');
            dl.id = id;
            document.body.appendChild(dl);
        }
        dl.textContent = '';
        load(key).forEach(function (v) {
            var o = document.createElement('option');
            o.value = v;
            dl.appendChild(o);
        });
        return id;
    }

    // Attach the list when a field is used (works for rows added later, such as products)
    document.addEventListener('focusin', function (e) {
        var el = e.target;
        if (el && el.dataset && el.dataset.suggest && el.tagName === 'INPUT') {
            el.setAttribute('list', datalistFor(el.dataset.suggest));
            el.setAttribute('autocomplete', 'off');
        }
    });

    // Remember what was entered when a form is submitted (runs after format.js has tidied the text)
    document.addEventListener('submit', function (e) {
        Array.prototype.forEach.call(e.target.querySelectorAll('input[data-suggest]'), function (el) {
            remember(el.dataset.suggest, el.value);
        });
    }, true);

    window.rememberSuggestion = remember;
})();
