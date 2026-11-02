/* Capitalises the first letter of every word in text inputs marked data-case="title"
   (names, shop, hospital, address, product ...): "sri sai medicals" -> "Sri Sai Medicals".
   Not used for codes (invoice number) or free text (details). */
(function () {
    var UNITS = /^(mg|ml|g|gm|kg|mcg|iu|l)$/i;   // 500 mg, 100 ml ... stay in small letters

    function capitalise(word) {
        return word.replace(/(^|[-\/(])([a-z])/g, function (m, before, letter) { return before + letter.toUpperCase(); });
    }

    // Text typed in capital letters only (common on printed bills) is turned into normal words.
    // Mixed text keeps what was typed ("McDonald", "ENT Clinic"), only words starting with a small letter are fixed.
    window.toTitleCase = function (text) {
        var t = String(text === null || text === undefined ? '' : text).replace(/\s+/g, ' ').trim();
        if (!t) return '';
        var letters = t.replace(/[^A-Za-z]/g, '');
        var allCaps = letters.length > 1 && letters === letters.toUpperCase();

        return t.split(' ').map(function (word) {
            if (UNITS.test(word)) return word.toLowerCase();
            if (allCaps && !/\d/.test(word)) word = word.toLowerCase(); // codes like B12 stay as they are
            return capitalise(word);
        }).join(' ');
    };

    function normalise(input) {
        if (input.dataset.case !== 'title') return;
        var fixed = window.toTitleCase(input.value);
        if (fixed !== input.value) {
            input.value = fixed;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // When the user leaves a field ...
    document.addEventListener('focusout', function (e) {
        if (e.target && e.target.dataset) normalise(e.target);
    });

    // ... and before a form is sent (Enter key), ahead of the page's own submit handler
    document.addEventListener('submit', function (e) {
        Array.prototype.forEach.call(e.target.querySelectorAll('[data-case="title"]'), normalise);
    }, true);
})();
