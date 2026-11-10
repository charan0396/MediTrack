(function () {
    var MAX_FILE = 10 * 1024 * 1024;                    // same as the server limit
    var ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
    var OCR_BASE = new URL('vendor/tesseract/', window.location.href).href; // text reader, served by this app
    var MIN_CONFIDENCE = 15;                            // ignore words the reader is nearly sure are noise
    var DRAG_PIXELS = 5;                                // less movement than this is a click, not a drag
    var ROW_GAP = 1.2;                                  // a gap wider than this x text height starts a new value

    // ---------- page elements ----------
    var form = document.getElementById('billForm');
    var formMsg = document.getElementById('formMsg');
    var productsBox = document.getElementById('products');
    var addProductBtn = document.getElementById('addProductBtn');
    var totalOut = document.getElementById('totalAmount');
    var subTotalOut = document.getElementById('subTotalOut');
    var discountOut = document.getElementById('discountOut');
    var afterOut = document.getElementById('afterOut');
    var gstOut = document.getElementById('gstOut');
    var discountInput = document.getElementById('fDiscount');
    var discountType = document.getElementById('fDiscountType');
    var gstInput = document.getElementById('fGst');
    var printedInput = document.getElementById('fPrinted');
    var printedNote = document.getElementById('printedNote');
    var editBanner = document.getElementById('editBanner');
    var editText = document.getElementById('editText');
    var cancelEditBtn = document.getElementById('cancelEditBtn');
    var autoNext = document.getElementById('autoNext');
    var saveBtn = document.getElementById('saveBtn');
    var clearBtn = document.getElementById('clearBtn');

    var nameInput = document.getElementById('fName');
    var dateInput = document.getElementById('fDate');
    var shopInput = document.getElementById('fShop');
    var invoiceInput = document.getElementById('fInvoice');

    var uploadBtn = document.getElementById('uploadBtn');
    var addWordsBtn = document.getElementById('addWordsBtn');
    var boxesBtn = document.getElementById('boxesBtn');
    var zoomIn = document.getElementById('zoomIn');
    var zoomOut = document.getElementById('zoomOut');
    var zoomLabel = document.getElementById('zoomLabel');
    var fileInput = document.getElementById('fileInput');
    var ocrStatus = document.getElementById('ocrStatus');
    var guide = document.getElementById('guide');
    var stageScroll = document.getElementById('stageScroll');
    var emptyStage = document.getElementById('emptyStage');
    var stage = document.getElementById('stage');
    var billImg = document.getElementById('billImg');
    var overlay = document.getElementById('overlay');
    var marquee = document.getElementById('marquee');

    var wordModal = document.getElementById('wordModal');
    var wordInput = document.getElementById('wordInput');
    var wordYes = document.getElementById('wordYes');
    var wordNo = document.getElementById('wordNo');
    var confirmModal = document.getElementById('confirmModal');
    var confirmText = document.getElementById('confirmText');
    var confirmYes = document.getElementById('confirmYes');
    var confirmNo = document.getElementById('confirmNo');

    // ---------- state ----------
    var words = [];          // {id, text, x0, y0, x1, y1 (0..1 of the picture), line, manual, used}
    var wordEls = {};        // id -> element on the picture
    var nextWordId = 1;
    var selection = { ids: [], kind: '' };   // kind: 'tap' | 'drag' | 'seg'
    var active = null;       // the input that receives picked text
    var zoomIdx = 2;
    var objectUrl = null;
    var billFile = null;     // the uploaded picture, sent to the server on save
    var addMode = false;
    var pendingBox = null;   // box drawn in "Add words" mode, waiting for its text
    var ocrRun = 0;
    var workerPromise = null;
    var drag = null;
    var rowSeq = 0;
    var editingId = null;    // id of the invoice being edited, or null when adding a new one
    var printedMismatch = '';   // text of the printed-total warning while the totals disagree, else ''
    var imageChanged = false; // true when a new bill picture was chosen (an edited invoice keeps its old one otherwise)

    // The name can be changed (a bill may be for someone else). It starts as the logged-in user's own name.
    function defaultName() {
        return window.isSuperUser ? '' : window.loggedInUser;
    }
    nameInput.value = defaultName();

    // =====================================================================
    // Small helpers
    // =====================================================================
    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function setMsg(text, ok) {
        formMsg.textContent = text || '';
        formMsg.classList.toggle('ok', !!ok);
    }

    function setStatus(text, isError) {
        ocrStatus.textContent = text;
        ocrStatus.classList.toggle('err', !!isError);
    }

    function targets() {
        return Array.prototype.filter.call(form.querySelectorAll('[data-kind]'), function (el) { return !el.readOnly; });
    }

    function fieldOf(el) { return el.closest('.fld'); }

    function colorOf(el) {
        var f = el && fieldOf(el);
        return (f && f.style.getPropertyValue('--c').trim()) || '#5b8def';
    }

    // "Name", or "Product 2 - Quantity" for a product row
    function fieldName(el) {
        var label = fieldOf(el).querySelector('label').cloneNode(true);
        Array.prototype.forEach.call(label.querySelectorAll('.req, .dot'), function (n) { n.remove(); });
        var text = label.textContent.trim();
        var row = el.closest('.prod');
        if (row) {
            var index = Array.prototype.indexOf.call(productsBox.children, row) + 1;
            return el.dataset.role === 'product' ? 'Product ' + index : 'Product ' + index + ' ' + text.toLowerCase();
        }
        return text;
    }

    // =====================================================================
    // Money: exact decimal maths in cents (the server does the same, so totals always agree)
    // =====================================================================
    function toCents(value) {
        var s = String(value == null ? '' : value).trim().replace(/,/g, '');
        if (!/^\d+(\.\d+)?$/.test(s)) return null;
        var parts = s.split('.');
        var frac = parts[1] || '';
        var cents = BigInt(parts[0]) * 100n + BigInt((frac + '00').slice(0, 2));
        if (frac.length > 2 && frac.charCodeAt(2) >= 53) cents += 1n; // third decimal 5-9 rounds up
        return cents;
    }

    function formatCents(cents) {
        return '₹ ' + (Number(cents) / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }

    function lineCents(row) {
        var q = toCents(row.querySelector('[data-role="quantity"]').value);
        var p = toCents(row.querySelector('[data-role="price"]').value);
        if (q === null || p === null) return null;
        return (q * p + 50n) / 100n; // quantity x price, rounded half up to a paisa
    }

    // Percent values are read in hundredths of a percent (12.5% -> 1250), so the maths stays exact
    function amounts() {
        var sub = 0n;
        Array.prototype.forEach.call(productsBox.children, function (row) {
            var cents = lineCents(row);
            row.querySelector('.line-total').textContent = cents === null ? '\u2014' : formatCents(cents);
            if (cents !== null) sub += cents;
        });

        var typed = toCents(discountInput.value) || 0n;
        var discount = discountType.value === 'PERCENT' ? (sub * typed + 5000n) / 10000n : typed;
        var after = discount > sub ? 0n : sub - discount;          // an impossible discount is flagged on save

        var gstRate = toCents(gstInput.value) || 0n;
        var gst = (after * gstRate + 5000n) / 10000n;              // GST on the amount after discount
        return { sub: sub, discount: discount, after: after, gst: gst, total: after + gst };
    }

    function recalc() {
        var a = amounts();
        subTotalOut.textContent = formatCents(a.sub);
        discountOut.textContent = '\u2212 ' + formatCents(a.discount);
        afterOut.textContent = formatCents(a.after);
        gstOut.textContent = '+ ' + formatCents(a.gst);
        totalOut.textContent = formatCents(a.total);
        checkPrinted(a.total);
    }

    // Compares the total printed on the bill with the calculated total. Only a warning, saving is still possible.
    // Bills are often rounded to the nearest rupee, so a difference below one rupee is accepted.
    function checkPrinted(total) {
        var printed = toCents(printedInput.value);
        printedMismatch = '';
        printedNote.className = 'printed-note';
        if (printed === null) {
            printedNote.textContent = '';
            return;
        }
        var diff = total > printed ? total - printed : printed - total;
        if (diff === 0n) {
            printedNote.textContent = '\u2713 Matches the total printed on the bill.';
            printedNote.classList.add('ok');
        } else if (diff < 100n) {
            printedNote.textContent = '\u2713 Within \u20B91 of the printed total (calculated ' + formatCents(total) +
                ', printed ' + formatCents(printed) + '): normal rounding.';
            printedNote.classList.add('ok');
        } else {
            printedMismatch = 'The total printed on the bill (' + formatCents(printed) + ') is different from the calculated total.';
            printedNote.textContent = '\u26A0 Does not match: calculated ' + formatCents(total) + ', printed ' + formatCents(printed) +
                ' (difference ' + formatCents(diff) + '). Check the quantities, prices, discount and GST.';
            printedNote.classList.add('warn');
        }
    }

    // =====================================================================
    // Turning picked text into field values
    // =====================================================================
    function cleanText(text) {
        return String(text).replace(/\s+/g, ' ').replace(/^[\s:;,|]+|[\s:;,|]+$/g, '');
    }

    function ymd(y, m, d) {
        if (y < 100) y += 2000;
        var dt = new Date(Date.UTC(y, m - 1, d));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
        return y + '-' + pad(m) + '-' + pad(d);
    }

    var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

    // 27/10/2026, 27-10-26, 2026-10-27, 27 Oct 2026, Oct 27, 2026 ... (day first, as on Indian bills)
    function parseDate(text) {
        var s = String(text).replace(/\s+/g, ' ').trim();
        var attempts = [s, s.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1')]; // second try fixes 2O26 style misreads
        for (var i = 0; i < attempts.length; i++) {
            var t = attempts[i], m, r;
            if ((m = t.match(/(\d{4})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{1,2})/)) && (r = ymd(+m[1], +m[2], +m[3]))) return r;
            if ((m = t.match(/(\d{1,2})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(\d{4}|\d{2})(?!\d)/)) && (r = ymd(+m[3], +m[2], +m[1]))) return r;
            if ((m = t.match(/(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*([A-Za-z]{3,9})[\s\-\/.,]*(\d{4}|\d{2})(?!\d)/))
                && MONTHS[m[2].slice(0, 3).toLowerCase()] && (r = ymd(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]))) return r;
            if ((m = t.match(/([A-Za-z]{3,9})[\s\-\/.,]*(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]+(\d{4})(?!\d)/))
                && MONTHS[m[1].slice(0, 3).toLowerCase()] && (r = ymd(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]))) return r;
        }
        return null;
    }

    // "Rs. 1,180.00" -> "1180.00", "10 Tabs" -> "10"
    function parseNumber(text) {
        var s = String(text).replace(/rs\.?|inr|₹/ig, '').replace(/\s+/g, '');
        if (/^[\dOolI,.]+$/.test(s)) s = s.replace(/[Oo]/g, '0').replace(/[lI]/g, '1'); // common misreads inside numbers
        var m = s.match(/\d[\d,]*(?:\.\d+)?|\.\d+/);
        return m ? m[0].replace(/,/g, '') : null;
    }

    function convert(kind, text) {
        if (kind === 'date') return parseDate(text);
        if (kind === 'number') return parseNumber(text);
        var v = cleanText(text);
        return v || null;
    }

    // =====================================================================
    // Product rows
    // =====================================================================
    function addProductRow() {
        var n = ++rowSeq;
        var row = document.createElement('div');
        row.className = 'prod';
        row.innerHTML =
            '<div class="prod-head"><span class="prod-no"></span>' +
            '<button type="button" class="rm" title="Remove this product">&times;</button></div>' +
            '<div class="fld" style="--c:#f472b6">' +
            '<div class="fld-top"><label for="p' + n + 'n"><i class="dot"></i>Product</label><span class="here">Filling here</span></div>' +
            '<input type="text" id="p' + n + 'n" class="input" data-kind="text" data-case="title" data-suggest="product" data-role="product" maxlength="200" placeholder="e.g. medicine or item name">' +
            '</div>' +
            '<div class="trio">' +
            '<div class="fld" style="--c:#fbbf24">' +
            '<div class="fld-top"><label for="p' + n + 'q"><i class="dot"></i>Quantity</label><span class="here">Filling here</span></div>' +
            '<input type="number" id="p' + n + 'q" class="input" data-kind="number" data-role="quantity" min="0" step="any" inputmode="decimal" placeholder="0">' +
            '</div>' +
            '<div class="fld" style="--c:#34d399">' +
            '<div class="fld-top"><label for="p' + n + 'p"><i class="dot"></i>Price</label><span class="here">Filling here</span></div>' +
            '<input type="number" id="p' + n + 'p" class="input" data-kind="number" data-role="price" min="0" step="any" inputmode="decimal" placeholder="0.00">' +
            '</div>' +
            '<div class="fld"><div class="fld-top"><label>Total</label></div><div class="line-total">—</div></div>' +
            '</div>';
        productsBox.appendChild(row);
        renumberRows();
        recalc();
        return row;
    }

    function renumberRows() {
        var rows = productsBox.children;
        Array.prototype.forEach.call(rows, function (row, i) {
            row.querySelector('.prod-no').textContent = 'Product ' + (i + 1);
            row.querySelector('.rm').hidden = rows.length === 1;
            row.querySelector('.rm').setAttribute('aria-label', 'Remove product ' + (i + 1));
        });
    }

    function removeRow(row) {
        if (productsBox.children.length <= 1) return;
        var wasActive = active && row.contains(active);
        Array.prototype.forEach.call(row.querySelectorAll('[data-kind]'), clearUsed);
        var prev = row.previousElementSibling || row.nextElementSibling;
        row.remove();
        renumberRows();
        recalc();
        if (wasActive) setActive(prev.querySelector('[data-role="product"]'));
        else renderGuide();
    }

    addProductBtn.addEventListener('click', function () {
        var row = addProductRow();
        var input = row.querySelector('[data-role="product"]');
        setActive(input);
        row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    productsBox.addEventListener('click', function (e) {
        var rm = e.target.closest('.rm');
        if (rm) removeRow(rm.closest('.prod'));
    });

    form.addEventListener('input', function (e) {
        recalc();
        e.target.classList.remove('bad');
    });

    // =====================================================================
    // The field that receives picked text
    // =====================================================================
    function setActive(el) {
        if (!el) return;
        Array.prototype.forEach.call(form.querySelectorAll('.fld.active'), function (f) { f.classList.remove('active'); });
        active = el;
        fieldOf(el).classList.add('active');
        overlay.style.setProperty('--sc', colorOf(el));
        renderGuide();
    }

    // Clicking or tabbing into a field makes it the target (click also covers a field that already has focus)
    form.addEventListener('focusin', function (e) { if (e.target.dataset && e.target.dataset.kind && !e.target.readOnly) setActive(e.target); });
    form.addEventListener('click', function (e) { if (e.target.dataset && e.target.dataset.kind && !e.target.readOnly) setActive(e.target); });

    function advanceFrom(el) {
        var list = targets();
        var i = list.indexOf(el);
        if (i >= 0 && i < list.length - 1) setActive(list[i + 1]);
        if (document.activeElement && form.contains(document.activeElement)) document.activeElement.blur();
    }

    // =====================================================================
    // Showing the guide line above the picture
    // =====================================================================
    function selectedText() {
        return cleanText(sortedWords(selection.ids).map(function (w) { return w.text; }).join(' '));
    }

    function renderGuide() {
        guide.textContent = '';
        if (!billImg.src || stage.hidden) return;
        var name = active ? fieldName(active) : 'a field';

        if (!selection.ids.length) {
            var span = document.createElement('span');
            span.appendChild(document.createTextNode(addMode
                ? 'Draw a box where the text is, then type what it says.'
                : 'Drag across text on the bill, or tap a word. Double-click the highlight to fill '));
            if (!addMode) {
                var b = document.createElement('b');
                b.textContent = name;
                span.appendChild(b);
                span.appendChild(document.createTextNode('.'));
            }
            guide.appendChild(span);
            return;
        }

        var pick = document.createElement('span');
        pick.className = 'pick';
        pick.textContent = 'Selected: “' + selectedText() + '”';
        guide.appendChild(pick);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn small';
        btn.textContent = 'Fill ' + name;
        btn.addEventListener('click', function () { fillActive(selectedText(), selection.ids.slice()); });
        guide.appendChild(btn);
    }

    // =====================================================================
    // Words on the picture
    // =====================================================================
    function wordById(id) {
        for (var i = 0; i < words.length; i++) if (words[i].id === id) return words[i];
        return null;
    }

    function lineY(line) {
        var sum = 0, n = 0;
        words.forEach(function (w) { if (w.line === line) { sum += (w.y0 + w.y1) / 2; n++; } });
        return n ? sum / n : 0;
    }

    // reading order: top to bottom by line, then left to right
    function sortedWords(ids) {
        var list = ids.map(wordById).filter(Boolean);
        var cache = {};
        list.forEach(function (w) { if (!(w.line in cache)) cache[w.line] = lineY(w.line); });
        return list.sort(function (a, b) {
            return a.line === b.line ? a.x0 - b.x0 : cache[a.line] - cache[b.line];
        });
    }

    function drawWord(w) {
        var el = document.createElement('div');
        el.className = 'wbox' + (w.manual ? ' manual' : '');
        el.dataset.text = w.text;
        el.style.left = (w.x0 * 100) + '%';
        el.style.top = (w.y0 * 100) + '%';
        el.style.width = ((w.x1 - w.x0) * 100) + '%';
        el.style.height = ((w.y1 - w.y0) * 100) + '%';
        overlay.appendChild(el);
        wordEls[w.id] = el;
        paintWord(w);
    }

    function paintWord(w) {
        var el = wordEls[w.id];
        if (!el) return;
        el.classList.toggle('sel', selection.ids.indexOf(w.id) >= 0);
        el.classList.toggle('used', !!w.used);
        if (w.used) el.style.setProperty('--u', w.used.color);
        else el.style.removeProperty('--u');
    }

    function clearWords() {
        words = [];
        wordEls = {};
        overlay.textContent = '';
        selection = { ids: [], kind: '' };
    }

    function setSelection(ids, kind) {
        var old = selection.ids;
        selection = { ids: ids, kind: kind };
        old.concat(ids).forEach(function (id) { var w = wordById(id); if (w) paintWord(w); });
        renderGuide();
    }

    // Which word is under a point (fractions of the picture)? The smallest box wins.
    function wordAt(p) {
        var pad = 0.002, best = null, bestArea = Infinity;
        words.forEach(function (w) {
            if (p.x >= w.x0 - pad && p.x <= w.x1 + pad && p.y >= w.y0 - pad && p.y <= w.y1 + pad) {
                var area = (w.x1 - w.x0) * (w.y1 - w.y0);
                if (area < bestArea) { best = w; bestArea = area; }
            }
        });
        return best;
    }

    // Words touched by a dragged box: enough overlap across and along the line, so a neighbouring line is not picked up
    function wordsInBox(rect) {
        // a perfectly straight drag has no height: give the box a little thickness
        var m = 0.002;
        var box = { x0: rect.x0 - m, y0: rect.y0 - m, x1: rect.x1 + m, y1: rect.y1 + m };
        return words.filter(function (w) {
            var ox = Math.min(w.x1, box.x1) - Math.max(w.x0, box.x0);
            var oy = Math.min(w.y1, box.y1) - Math.max(w.y0, box.y0);
            if (ox <= 0 || oy <= 0) return false;
            return ox >= 0.35 * Math.min(w.x1 - w.x0, box.x1 - box.x0) &&
                oy >= 0.5 * Math.min(w.y1 - w.y0, box.y1 - box.y0);
        }).map(function (w) { return w.id; });
    }

    // The "whole value" around a word: "Anil Kumar Reddy" from "Customer name: Anil Kumar Reddy".
    // A new value starts after a label ending in ":" or after a wide gap (another column).
    function segmentOf(word) {
        var line = words.filter(function (w) { return w.line === word.line; }).sort(function (a, b) { return a.x0 - b.x0; });
        var aspect = (billImg.naturalWidth || 1) / (billImg.naturalHeight || 1);
        var height = line.reduce(function (s, w) { return s + (w.y1 - w.y0); }, 0) / line.length;

        var segments = [], current = [];
        line.forEach(function (w) {
            if (current.length) {
                var prev = current[current.length - 1];
                var gap = (w.x0 - prev.x1) * aspect / height;
                if (/:$/.test(prev.text) || gap > ROW_GAP) {
                    segments.push(current);
                    current = [];
                }
            }
            current.push(w);
        });
        if (current.length) segments.push(current);

        for (var i = 0; i < segments.length; i++) {
            if (segments[i].indexOf(word) >= 0) {
                var last = segments[i][segments[i].length - 1];
                // clicked on a label ("Customer name:") -> take the value next to it
                if (/:$/.test(last.text) && segments[i + 1]) return segments[i + 1];
                return segments[i];
            }
        }
        return [word];
    }

    // =====================================================================
    // Filling the active field
    // =====================================================================
    function markUsed(el, ids) {
        clearUsed(el);
        var color = colorOf(el);
        ids.forEach(function (id) {
            var w = wordById(id);
            if (w) { w.used = { el: el, color: color }; paintWord(w); }
        });
    }

    function clearUsed(el) {
        words.forEach(function (w) {
            if (w.used && w.used.el === el) { w.used = null; paintWord(w); }
        });
    }

    function fillActive(text, ids) {
        if (!active) {
            setStatus('Click a field on the left first, then pick text from the bill.', true);
            return false;
        }
        var el = active;
        var value = convert(el.dataset.kind, text);
        if (value !== null && el.dataset.case === 'title') value = window.toTitleCase(value); // SRI SAI -> Sri Sai
        if (value === null) {
            var what = el.dataset.kind === 'date' ? 'a date' : el.dataset.kind === 'number' ? 'a number' : 'text';
            setStatus('Could not read ' + what + ' from “' + cleanText(text) + '”. Pick a different part of the bill, or type it in.', true);
            return false;
        }
        el.value = value;
        el.classList.remove('bad');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.classList.remove('flash');
        void el.offsetWidth; // restart the little highlight animation
        el.classList.add('flash');

        markUsed(el, ids);
        setSelection([], '');
        setStatus('Filled ' + fieldName(el) + '.');
        if (autoNext.checked) advanceFrom(el);
        return true;
    }

    // =====================================================================
    // Picking text on the picture: tap, drag, double-click
    // =====================================================================
    function pointOf(ev) {
        var r = stage.getBoundingClientRect();
        return {
            x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
            y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))
        };
    }

    function boxOf(a, b) {
        return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
    }

    function showMarquee(box) {
        marquee.hidden = false;
        marquee.style.left = (box.x0 * 100) + '%';
        marquee.style.top = (box.y0 * 100) + '%';
        marquee.style.width = ((box.x1 - box.x0) * 100) + '%';
        marquee.style.height = ((box.y1 - box.y0) * 100) + '%';
    }

    stage.addEventListener('pointerdown', function (ev) {
        if (ev.button !== 0) return;
        var p = pointOf(ev);
        drag = { start: p, cur: p, moved: false, type: ev.pointerType, x: ev.clientX, y: ev.clientY };
        if (ev.pointerType !== 'touch') {          // touch keeps scrolling the picture; mouse and pen can drag
            try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
            ev.preventDefault();
        }
    });

    stage.addEventListener('pointermove', function (ev) {
        if (!drag || drag.type === 'touch') return;
        if (!drag.moved && Math.hypot(ev.clientX - drag.x, ev.clientY - drag.y) < DRAG_PIXELS) return;
        drag.moved = true;
        drag.cur = pointOf(ev);
        showMarquee(boxOf(drag.start, drag.cur));
    });

    stage.addEventListener('pointercancel', function () {
        drag = null;
        marquee.hidden = true;
    });

    stage.addEventListener('pointerup', function (ev) {
        if (!drag) return;
        var d = drag;
        drag = null;
        marquee.hidden = true;
        var end = pointOf(ev);

        if (addMode) {
            var box = boxOf(d.start, end);
            if (d.moved && box.x1 - box.x0 > 0.004 && box.y1 - box.y0 > 0.004) openWordModal(box);
            return;
        }
        if (d.moved) {
            var ids = wordsInBox(boxOf(d.start, end));
            setSelection(ids, ids.length ? 'drag' : '');
            return;
        }
        // a tap or click
        var w = wordAt(end);
        if (!w) { setSelection([], ''); return; }
        if (selection.kind === 'drag' && selection.ids.indexOf(w.id) >= 0) return; // keep the dragged highlight for a double-click
        setSelection([w.id], 'tap');
    });

    // Double-click: a dragged highlight fills exactly what it covers; a single word fills its whole value
    stage.addEventListener('dblclick', function (ev) {
        if (addMode) return;
        var w = wordAt(pointOf(ev));
        if (!w) return;
        if (selection.kind === 'drag' && selection.ids.indexOf(w.id) >= 0) {
            fillActive(selectedText(), selection.ids.slice());
            return;
        }
        var seg = sortedWords(segmentOf(w).map(function (x) { return x.id; }));
        var ids = seg.map(function (x) { return x.id; });
        fillActive(seg.map(function (x) { return x.text; }).join(' '), ids);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && selection.ids.length && !/^(INPUT|BUTTON|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
            e.preventDefault();
            fillActive(selectedText(), selection.ids.slice());
        } else if (e.key === 'Escape' && selection.ids.length) {
            setSelection([], '');
        }
    });

    // =====================================================================
    // Add words: draw a box and type text the reader missed
    // =====================================================================
    function setAddMode(on) {
        addMode = on;
        addWordsBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        stage.classList.toggle('adding', on);
        if (on) setSelection([], '');
        renderGuide();
    }

    addWordsBtn.addEventListener('click', function () { setAddMode(!addMode); });

    function openWordModal(box) {
        pendingBox = box;
        wordInput.value = '';
        wordModal.classList.add('open');
        wordModal.setAttribute('aria-hidden', 'false');
        wordInput.focus();
    }

    function closeWordModal() {
        pendingBox = null;
        wordModal.classList.remove('open');
        wordModal.setAttribute('aria-hidden', 'true');
    }

    function lineFor(box) {
        var best = null, bestRatio = 0, maxLine = -1;
        words.forEach(function (w) {
            maxLine = Math.max(maxLine, w.line);
            var oy = Math.min(w.y1, box.y1) - Math.max(w.y0, box.y0);
            var ratio = oy / Math.min(w.y1 - w.y0, box.y1 - box.y0);
            if (ratio > 0.5 && ratio > bestRatio) { best = w; bestRatio = ratio; }
        });
        return best ? best.line : maxLine + 1;
    }

    function confirmWord() {
        var text = cleanText(wordInput.value);
        if (!text || !pendingBox) { closeWordModal(); return; }
        var w = {
            id: nextWordId++, text: text, manual: true, used: null,
            x0: pendingBox.x0, y0: pendingBox.y0, x1: pendingBox.x1, y1: pendingBox.y1,
            line: lineFor(pendingBox)
        };
        words.push(w);
        drawWord(w);
        closeWordModal();
        setAddMode(false);
        setSelection([w.id], 'tap');
    }

    wordYes.addEventListener('click', confirmWord);
    wordNo.addEventListener('click', closeWordModal);
    wordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); confirmWord(); }
    });
    wordModal.addEventListener('click', function (e) { if (e.target === wordModal) closeWordModal(); });

    // =====================================================================
    // Boxes toggle and zoom
    // =====================================================================
    boxesBtn.addEventListener('click', function () {
        var on = boxesBtn.getAttribute('aria-pressed') !== 'true';
        boxesBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        boxesBtn.textContent = on ? 'Hide text boxes' : 'Show text boxes';
        stage.classList.toggle('show-boxes', on);
    });

    function setZoom(i) {
        zoomIdx = Math.max(0, Math.min(ZOOMS.length - 1, i));
        stage.style.setProperty('--zoom', ZOOMS[zoomIdx]);
        zoomLabel.textContent = Math.round(ZOOMS[zoomIdx] * 100) + '%';
        zoomOut.disabled = zoomIdx === 0;
        zoomIn.disabled = zoomIdx === ZOOMS.length - 1;
    }

    zoomIn.addEventListener('click', function () { setZoom(zoomIdx + 1); });
    zoomOut.addEventListener('click', function () { setZoom(zoomIdx - 1); });

    // =====================================================================
    // Uploading the bill picture and reading its text (runs in the browser, files are served by this app)
    // =====================================================================
    uploadBtn.addEventListener('click', function () { fileInput.click(); });

    fileInput.addEventListener('change', function () {
        var file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        var ext = (file.name.split('.').pop() || '').toLowerCase();
        if (['png', 'jpg', 'jpeg'].indexOf(ext) < 0 || (file.type && file.type.indexOf('image/') !== 0)) {
            setStatus('Please choose a PNG or JPG picture of the bill.', true);
            return;
        }
        if (file.size > MAX_FILE) {
            setStatus('"' + file.name + '" is larger than 10 MB.', true);
            return;
        }
        loadBill(file, false);
    });

    // fromServer: the picture already saved with an invoice being edited (not a new upload)
    function loadBill(file, fromServer) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(file);
        billFile = file;
        imageChanged = !fromServer;
        ocrRun++;
        clearWords();
        setAddMode(false);
        setStatus('Loading picture…');
        billImg.onload = function () {
            emptyStage.hidden = true;
            stage.hidden = false;
            addWordsBtn.disabled = false;
            boxesBtn.disabled = false;
            stageScroll.scrollTo(0, 0);
            renderGuide();
            readText(ocrRun);
        };
        billImg.onerror = function () {
            billFile = null;
            setStatus('That file could not be opened as a picture.', true);
        };
        billImg.src = objectUrl;
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (window.Tesseract) { resolve(); return; }
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = function () { reject(new Error('Could not load ' + src)); };
            document.head.appendChild(s);
        });
    }

    function getWorker() {
        if (!workerPromise) {
            workerPromise = loadScript(OCR_BASE + 'tesseract.min.js').then(function () {
                return window.Tesseract.createWorker('eng', 1, {
                    workerPath: OCR_BASE + 'worker.min.js',
                    corePath: OCR_BASE,
                    langPath: OCR_BASE + 'lang',
                    gzip: true,
                    logger: function (m) {
                        if (m.status === 'recognizing text') {
                            setStatus('Reading text from the bill… ' + Math.round(m.progress * 100) + '%');
                        }
                    }
                });
            }).catch(function (err) {
                workerPromise = null;
                throw err;
            });
        }
        return workerPromise;
    }

    // A copy of the picture at a size the reader likes (about 1600-2600 px on the long side)
    function pictureForReader() {
        var w = billImg.naturalWidth, h = billImg.naturalHeight, longest = Math.max(w, h);
        var k = Math.min(2600, Math.max(longest, 1600)) / longest;
        var canvas = document.createElement('canvas');
        canvas.width = Math.round(w * k);
        canvas.height = Math.round(h * k);
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(billImg, 0, 0, canvas.width, canvas.height);
        return canvas;
    }

    function linesOf(data) {
        if (data.lines && data.lines.length) return data.lines;
        var out = [];
        (data.blocks || []).forEach(function (b) {
            (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { out.push(l); }); });
        });
        return out;
    }

    async function readText(run) {
        setStatus('Preparing the text reader…');
        try {
            var worker = await getWorker();
            if (run !== ocrRun) return;
            setStatus('Reading text from the bill… 0%');
            var canvas = pictureForReader();
            var result = await worker.recognize(canvas);
            if (run !== ocrRun) return; // another picture was chosen meanwhile

            var found = 0;
            linesOf(result.data).forEach(function (line, li) {
                (line.words || []).forEach(function (w) {
                    var text = (w.text || '').trim();
                    if (!text || w.confidence < MIN_CONFIDENCE) return;
                    var word = {
                        id: nextWordId++, text: text, manual: false, used: null, line: li,
                        x0: w.bbox.x0 / canvas.width, y0: w.bbox.y0 / canvas.height,
                        x1: w.bbox.x1 / canvas.width, y1: w.bbox.y1 / canvas.height
                    };
                    words.push(word);
                    drawWord(word);
                    found++;
                });
            });
            if (found) {
                setStatus('Found ' + found + ' words. Pick a field on the left, then drag across text on the bill or tap a word.');
            } else {
                setStatus('No text could be read from this picture. Use “Add words” to type text onto the bill, or fill the fields by hand.', true);
            }
            renderGuide();
        } catch (err) {
            if (run !== ocrRun) return;
            setStatus('The text reader could not start, so words cannot be picked automatically. You can still use “Add words” or type the values in.', true);
        }
    }

    // =====================================================================
    // Clear, validate, save
    // =====================================================================
    function resetFields() {
        [nameInput, dateInput, shopInput, invoiceInput].forEach(function (el) {
            el.value = el === nameInput ? defaultName() : '';
            el.classList.remove('bad');
        });
        discountInput.value = '';
        discountType.value = 'AMOUNT';
        gstInput.value = '';
        printedInput.value = '';
        [discountInput, gstInput].forEach(function (el) { el.classList.remove('bad'); });
        words.forEach(function (w) { w.used = null; paintWord(w); });
        productsBox.textContent = '';
        addProductRow();
        recalc();
        setSelection([], '');
        setMsg('');
        var first = targets()[0];
        if (first) setActive(first);
    }

    function removeBillImage() {
        ocrRun++;
        clearWords();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = null;
        billFile = null;
        imageChanged = false;
        billImg.removeAttribute('src');
        stage.hidden = true;
        emptyStage.hidden = false;
        addWordsBtn.disabled = true;
        boxesBtn.disabled = true;
        setAddMode(false);
        setStatus('Upload a photo or scan of the bill (PNG or JPG). The text is read inside your browser; nothing leaves your computer until you save.');
        guide.textContent = '';
    }

    clearBtn.addEventListener('click', resetFields);

    // =====================================================================
    // Editing a saved invoice (started from the Saved bills table)
    // =====================================================================
    function leaveEditMode() {
        editingId = null;
        editBanner.hidden = true;
        saveBtn.textContent = 'Save invoice';
        resetFields();
        removeBillImage();
    }

    cancelEditBtn.addEventListener('click', leaveEditMode);

    function numberText(value) {
        return value === null || value === undefined || Number(value) === 0 ? '' : String(value);
    }

    // inv = { head: first row of the invoice, lines: one row per product }
    async function startEdit(inv) {
        var h = inv.head;
        resetFields();
        removeBillImage();
        editingId = h.billId;

        nameInput.value = h.name || '';
        dateInput.value = h.billDate || '';
        shopInput.value = h.medicalShop || '';
        invoiceInput.value = h.invoiceNumber || '';
        discountType.value = h.discountType === 'PERCENT' ? 'PERCENT' : 'AMOUNT';
        discountInput.value = numberText(h.discountValue);
        gstInput.value = numberText(h.gstPercent);

        productsBox.textContent = '';
        inv.lines.forEach(function (line) {
            var row = addProductRow();
            row.querySelector('[data-role="product"]').value = line.product || '';
            row.querySelector('[data-role="quantity"]').value = numberText(line.quantity);
            row.querySelector('[data-role="price"]').value = String(line.price);
        });
        recalc();

        editText.textContent = 'Editing the invoice of \u201C' + (h.name || '') + '\u201D' +
            (h.invoiceNumber ? ' (' + h.invoiceNumber + ')' : '') + '. Change what you need, then press Update invoice.';
        editBanner.hidden = false;
        saveBtn.textContent = 'Update invoice';
        var first = targets()[0];
        if (first) setActive(first);
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (h.billFileName) {                         // show the saved picture again (and read its text again)
            setStatus('Loading the saved bill image\u2026');
            try {
                var res = await fetch('/api/bills/' + encodeURIComponent(h.billId) + '/image', { cache: 'no-store' });
                if (res.status === 401) { window.handleUnauthorized(); return; }
                if (!res.ok) throw new Error('bad status');
                var blob = await res.blob();
                if (editingId !== h.billId) return;   // another invoice was opened meanwhile
                loadBill(new File([blob], h.billFileName, { type: blob.type }), true);
            } catch (err) {
                setStatus('The saved bill image could not be loaded. You can still change the other details.', true);
            }
        }
    }

    window.BillForm = {
        startEdit: startEdit,
        cancelEdit: leaveEditMode,
        editingId: function () { return editingId; }
    };

    function fail(el, text) {
        el.classList.add('bad');
        setMsg(text);
        el.focus();
        return false;
    }

    // Returns the product rows that have something typed in them, or false after showing the problem
    function checkForm() {
        setMsg('');
        Array.prototype.forEach.call(form.querySelectorAll('.bad'), function (el) { el.classList.remove('bad'); });

        if (!nameInput.value.trim()) return fail(nameInput, 'Name is required');
        if (!dateInput.value) return fail(dateInput, 'Date is required');

        var filled = [];
        var rows = Array.prototype.slice.call(productsBox.children);
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var product = row.querySelector('[data-role="product"]');
            var qty = row.querySelector('[data-role="quantity"]');
            var price = row.querySelector('[data-role="price"]');
            if (!product.value.trim() && !qty.value.trim() && !price.value.trim()) continue; // empty row
            var label = 'Product ' + (i + 1) + ': ';
            if (!product.value.trim()) return fail(product, label + 'product name is required');
            var q = toCents(qty.value);
            if (q === null) return fail(qty, label + 'enter the quantity');
            if (q <= 0n) return fail(qty, label + 'quantity must be more than 0');
            if (toCents(price.value) === null) return fail(price, label + 'enter the price');
            filled.push(row);
        }
        if (!filled.length) return fail(productsBox.querySelector('[data-role="product"]'), 'Add at least one product');

        var sub = 0n;
        filled.forEach(function (row) { sub += lineCents(row); });
        if (discountInput.value.trim()) {
            var d = toCents(discountInput.value);
            if (d === null) return fail(discountInput, 'Discount must be a number');
            if (discountType.value === 'PERCENT' ? d > 10000n : d > sub) {
                return fail(discountInput, discountType.value === 'PERCENT'
                    ? 'Discount cannot be more than 100%' : 'Discount cannot be more than the sub total');
            }
        }
        if (gstInput.value.trim()) {
            var g = toCents(gstInput.value);
            if (g === null) return fail(gstInput, 'GST must be a number');
            if (g > 10000n) return fail(gstInput, 'GST cannot be more than 100%');
        }
        return filled;
    }

    function openConfirm(filled) {
        var total = amounts().total;
        var verb = editingId ? 'Update' : 'Save';
        document.getElementById('confirmTitle').textContent = 'Confirm ' + verb.toLowerCase();
        confirmYes.textContent = 'Yes, ' + verb.toLowerCase();
        confirmText.textContent = verb + ' this invoice for "' + nameInput.value.trim() + '" with ' + filled.length +
            (filled.length === 1 ? ' product' : ' products') + ', total ' + formatCents(total) +
            (billFile ? '?' : ' (no bill image attached)?') + (printedMismatch ? ' ' + printedMismatch : '');
        confirmModal.classList.add('open');
        confirmModal.setAttribute('aria-hidden', 'false');
        confirmYes.focus();
    }

    function closeConfirm() {
        confirmModal.classList.remove('open');
        confirmModal.setAttribute('aria-hidden', 'true');
    }

    confirmNo.addEventListener('click', closeConfirm);
    confirmModal.addEventListener('click', function (e) { if (e.target === confirmModal) closeConfirm(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeConfirm(); closeWordModal(); }
    });

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        var filled = checkForm();
        if (filled) openConfirm(filled);
    });

    confirmYes.addEventListener('click', async function () {
        var filled = checkForm();
        if (!filled) { closeConfirm(); return; }

        var data = new FormData();
        data.append('name', nameInput.value.trim());
        data.append('billDate', dateInput.value);
        data.append('medicalShop', shopInput.value.trim());
        data.append('invoiceNumber', invoiceInput.value.trim());
        data.append('discountType', discountType.value);
        data.append('discountValue', discountInput.value.trim());
        data.append('gstPercent', gstInput.value.trim());
        filled.forEach(function (row) {            // one product / quantity / price entry per product row
            data.append('product', row.querySelector('[data-role="product"]').value.trim());
            data.append('quantity', row.querySelector('[data-role="quantity"]').value);
            data.append('price', row.querySelector('[data-role="price"]').value);
        });
        if (billFile && (!editingId || imageChanged)) data.append('image', billFile, billFile.name);
        var url = editingId ? '/api/bills/' + encodeURIComponent(editingId) + '/update' : '/api/bills';

        confirmYes.disabled = true;
        saveBtn.disabled = true;
        try {
            var res = await fetch(url, { method: 'POST', body: data });
            if (res.status === 401) {
                window.handleUnauthorized();
                return;
            }
            var body = {};
            try { body = await res.json(); } catch (err) { /* empty body */ }

            closeConfirm();
            if (res.ok && body.success) {
                var wasEdit = !!editingId;
                leaveEditMode();
                window.showToast(wasEdit ? 'Invoice updated successfully' : 'Invoice saved successfully');
                window.dispatchEvent(new Event('bill-saved')); // refreshes the Saved bills table
            } else {
                setMsg(body.message || (editingId ? 'Could not update the invoice' : 'Could not save the invoice'));
                if (res.status === 404) {                      // the invoice was deleted meanwhile
                    leaveEditMode();
                    window.dispatchEvent(new Event('bill-saved'));
                }
            }
        } catch (err) {
            closeConfirm();
            setMsg('Cannot reach server');
        } finally {
            confirmYes.disabled = false;
            saveBtn.disabled = false;
        }
    });

    // ---------- start ----------
    setZoom(zoomIdx);
    addProductRow();
    recalc();
    var firstTarget = targets()[0];
    if (firstTarget) setActive(firstTarget);
})();
