/* ASCII SOFT Kanban — 끌어 놓기 · 순서 저장 · 상세 팝업 · 빠른 추가 · 스윔레인 · 열 설정 */
(function () {
  'use strict';
  var D = document, W = window;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function csrf() { var m = $('meta[name="csrf-token"]'); return m ? m.getAttribute('content') : ''; }
  function post(url, data) {
    var body = new URLSearchParams();
    Object.keys(data).forEach(function (k) {
      var v = data[k];
      if (Array.isArray(v)) v.forEach(function (x) { body.append(k + '[]', x); }); else body.append(k, v);
    });
    return fetch(url, {
      method: 'POST', credentials: 'same-origin', body: body,
      headers: { 'X-CSRF-Token': csrf(), 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }, function () { return { ok: r.ok, j: {} }; }); });
  }
  function toast(msg, err) {
    var t = D.createElement('div'); t.className = 'kb-toast' + (err ? ' kb-err' : ''); t.textContent = msg;
    D.body.appendChild(t); setTimeout(function () { t.remove(); }, err ? 5000 : 2600);
  }

  function init() {
    var board = $('.kb-board');
    if (!board) return;
    var URL_MOVE = board.dataset.moveUrl, URL_CREATE = board.dataset.createUrl,
        URL_CARD = board.dataset.cardUrl, URL_ALLOWED = board.dataset.allowedUrl;
    var allowedCache = {};

    /* ---- 열 개수 · WIP ---- */
    function refreshCounts() {
      var total = $$('.kb-card', board).length, sum = $('.kb-summary');
      if (sum) { var tb = $('.kb-sum-total', sum); if (tb) tb.textContent = total; }
      $$('.kb-col-head', board).forEach(function (h) {
        var sid = h.dataset.status, n = $$('.kb-cell[data-status="' + sid + '"] .kb-card', board).length;
        var b = $('.kb-col-count b', h); if (b) b.textContent = n;
        if (sum) {
          var seg = $('.kb-sum-bar i[data-status="' + sid + '"]', sum); if (seg) seg.style.width = (total ? n * 100 / total : 0) + '%';
          var lg = $('.kb-sum-legend span[data-status="' + sid + '"] b', sum); if (lg) lg.textContent = n;
        }
        var lim = parseInt(h.dataset.wip || '0', 10);
        var wb = $('.kb-wipbar b', h); if (wb && lim) wb.style.width = Math.min(100, n * 100 / lim) + '%';
        var over = lim > 0 && n > lim;
        if (over && !h.classList.contains('kb-over')) toast(board.dataset.msgWip, true);
        h.classList.toggle('kb-over', over);
      });
    }

    /* ---- 끌어 놓기 ---- */
    var drag = null;
    function laneOf(el) { var l = el.closest('.kb-lane'); return l ? l.dataset.lane : ''; }
    function clearMarks() { $$('.kb-cell', board).forEach(function (c) { c.classList.remove('kb-allowed', 'kb-denied', 'kb-hover'); }); $$('.kb-placeholder', board).forEach(function (p) { p.remove(); }); }
    function markCells(card, ids) {
      var lane = laneOf(card), cur = card.dataset.status;
      $$('.kb-cell', board).forEach(function (c) {
        if (laneOf(c) !== lane) { c.classList.add('kb-denied'); return; }
        var ok = c.dataset.status === cur || ids.indexOf(parseInt(c.dataset.status, 10)) > -1;
        c.classList.add(ok ? 'kb-allowed' : 'kb-denied');
      });
    }
    function allowed(id) {
      if (allowedCache[id]) return Promise.resolve(allowedCache[id]);
      return fetch(URL_ALLOWED + id, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
        .then(function (r) { return r.json(); }).then(function (d) { allowedCache[id] = d.ids || []; return allowedCache[id]; })
        .catch(function () { return []; });
    }
    function afterEl(cell, y) {
      var cards = $$('.kb-card:not(.kb-dragging)', cell), best = null, off = -Infinity;
      cards.forEach(function (c) { var r = c.getBoundingClientRect(), o = y - r.top - r.height / 2; if (o < 0 && o > off) { off = o; best = c; } });
      return best;
    }
    board.addEventListener('dragstart', function (e) {
      var card = e.target.closest && e.target.closest('.kb-card.kb-movable');
      if (!card) return;
      drag = { card: card, from: card.parentNode, next: card.nextSibling, ids: null };
      card.classList.add('kb-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (er) { }
      allowed(card.dataset.id).then(function (ids) { if (drag && drag.card === card) { drag.ids = ids; markCells(card, ids); } });
    });
    board.addEventListener('dragend', function () {
      if (drag) drag.card.classList.remove('kb-dragging');
      clearMarks(); drag = null;
    });
    board.addEventListener('dragover', function (e) {
      if (!drag) return;
      var cell = e.target.closest && e.target.closest('.kb-cell');
      if (!cell || cell.classList.contains('kb-denied')) return;
      if (laneOf(cell) !== laneOf(drag.card)) return;
      e.preventDefault();
      $$('.kb-cell.kb-hover', board).forEach(function (c) { if (c !== cell) c.classList.remove('kb-hover'); });
      cell.classList.add('kb-hover');
      var ph = $('.kb-placeholder', board) || Object.assign(D.createElement('div'), { className: 'kb-placeholder' });
      var after = afterEl(cell, e.clientY);
      if (after) cell.insertBefore(ph, after); else cell.appendChild(ph);
    });
    board.addEventListener('drop', function (e) {
      if (!drag) return;
      var cell = e.target.closest && e.target.closest('.kb-cell');
      var ph = $('.kb-placeholder', board);
      if (!cell || cell.classList.contains('kb-denied') || !ph) { clearMarks(); return; }
      e.preventDefault();
      var card = drag.card, from = drag.from, next = drag.next, oldStatus = card.dataset.status, d = drag;
      var phNext = ph.nextSibling;
      clearMarks(); drag = null;
      (d.ids ? Promise.resolve(d.ids) : allowed(card.dataset.id)).then(function (ids) {
        var target = cell.dataset.status;
        if (target !== oldStatus && ids.indexOf(parseInt(target, 10)) < 0) { card.classList.remove('kb-dragging'); toast(board.dataset.msgDenied, true); return; }
        finishDrop(card, cell, phNext && phNext.parentNode === cell ? phNext : null, from, next, oldStatus);
      });
    });
    function finishDrop(card, cell, before, from, next, oldStatus) {
      cell.insertBefore(card, before);
      card.classList.remove('kb-dragging');
      var newStatus = cell.dataset.status;
      card.dataset.status = newStatus;
      var order = $$('.kb-card', cell).map(function (c) { return c.dataset.id; });
      refreshCounts();
      post(URL_MOVE, { issue_id: card.dataset.id, status_id: newStatus, order: order }).then(function (res) {
        if (!res.ok) {
          from.insertBefore(card, next && next.parentNode === from ? next : null);  // 되돌리기
          card.dataset.status = oldStatus; refreshCounts();
          toast(res.j.error || board.dataset.msgDenied, true);
          return;
        }
        delete allowedCache[card.dataset.id];
        card.classList.toggle('kb-is-closed', !!(res.j.status && res.j.status.closed));
        if (newStatus !== oldStatus) toast(board.dataset.msgSaved);
      });
    }
    // 끌기 전에 옮길 수 있는 상태를 미리 받아 둡니다
    board.addEventListener('pointerdown', function (e) {
      var card = e.target.closest && e.target.closest('.kb-card.kb-movable');
      if (card) allowed(card.dataset.id);
    });

    /* ---- 상세 팝업 ---- */
    var popBg = $('.kb-popup-bg'), pop = popBg && $('.kb-popup', popBg);
    function openPopup(id) {
      if (!pop) return;
      pop.innerHTML = '<p style="color:var(--kb-dim)">\u2026</p>'; popBg.hidden = false;
      fetch(URL_CARD + id, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.text(); }).then(function (html) { pop.innerHTML = html; pop.dataset.id = id; })
        .catch(function () { popBg.hidden = true; });
    }
    function closePopup() { if (popBg) { popBg.hidden = true; pop.innerHTML = ''; } }
    board.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input')) return;
      var card = e.target.closest('.kb-card');
      if (card) openPopup(card.dataset.id);
    });
    if (popBg) {
      popBg.addEventListener('click', function (e) {
        if (e.target === popBg || e.target.closest('.kb-pop-close')) { closePopup(); return; }
        var st = e.target.closest('.kb-pop-st');
        if (!st || st.classList.contains('kb-cur')) return;
        var id = pop.dataset.id, card = $('.kb-card[data-id="' + id + '"]', board);
        var lane = card ? card.closest('.kb-lane') : null;
        var cell = lane ? $('.kb-cell[data-status="' + st.dataset.status + '"]', lane) : null;
        var order = cell ? $$('.kb-card', cell).map(function (c) { return c.dataset.id; }).concat([id]) : [id];
        post(URL_MOVE, { issue_id: id, status_id: st.dataset.status, order: order }).then(function (res) {
          if (!res.ok) { toast(res.j.error || board.dataset.msgDenied, true); return; }
          if (card && cell) { cell.appendChild(card); card.dataset.status = st.dataset.status; card.classList.toggle('kb-is-closed', !!res.j.status.closed); }
          else if (card) card.remove();                     // 숨긴 열로 옮긴 경우
          delete allowedCache[id]; refreshCounts(); toast(board.dataset.msgSaved);
          openPopup(id);
        });
      });
    }
    D.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closePopup(); closeConfig(); } });

    /* ---- 열에서 바로 새 요청 추가 ---- */
    board.addEventListener('click', function (e) {
      var btn = e.target.closest('.kb-add');
      if (!btn) return;
      var sid = btn.dataset.status, cell = $('.kb-lane .kb-cell[data-status="' + sid + '"]', board);
      if (!cell) return;
      var box = $('.kb-quick', cell);
      if (box) { $('input', box).focus(); return; }
      box = D.createElement('div'); box.className = 'kb-quick';
      box.innerHTML = '<input type="text" maxlength="255" placeholder="' + board.dataset.msgAdd + '"><div class="kb-quick-msg" hidden></div>';
      cell.insertBefore(box, cell.firstChild);
      var input = $('input', box), msg = $('.kb-quick-msg', box), busy = false;
      input.focus();
      input.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape') { box.remove(); return; }
        if (ev.key !== 'Enter' || ev.isComposing || busy) return;
        ev.preventDefault();
        var subject = input.value.trim(); if (!subject) return;
        busy = true;
        post(URL_CREATE, { subject: subject, status_id: sid }).then(function (res) {
          busy = false;
          if (!res.ok) {
            msg.hidden = false; msg.textContent = (res.j.error || '') + ' ';
            if (res.j.new_url) { var a = D.createElement('a'); a.href = res.j.new_url; a.textContent = board.dataset.msgDetail; msg.appendChild(a); }
            return;
          }
          var tmp = D.createElement('div'); tmp.innerHTML = res.j.html.trim();
          var card = tmp.firstElementChild;
          var target = $('.kb-lane .kb-cell[data-status="' + res.j.status_id + '"]', board) || cell;
          target.insertBefore(card, target === cell ? box.nextSibling : target.firstChild);
          input.value = ''; msg.hidden = true; refreshCounts();
        });
      });
      input.addEventListener('blur', function () { setTimeout(function () { if (!input.value.trim() && box.parentNode) box.remove(); }, 200); });
    });

    /* ---- 스윔레인 선택 ---- */
    var sel = $('#kb-swimlane');
    if (sel) sel.addEventListener('change', function () {
      try { localStorage.setItem('kb-swimlane', sel.value); } catch (er) { }
      var u = new URL(W.location.href); u.searchParams.set('swimlane', sel.value); W.location.href = u.toString();
    });
    var fld = D.getElementById('kb-swimlane-field');
    if (fld && sel) fld.value = sel.value;
    try {
      var saved = localStorage.getItem('kb-swimlane');
      if (saved && sel && !new URL(W.location.href).searchParams.get('swimlane') && saved !== sel.value) {
        var u2 = new URL(W.location.href); u2.searchParams.set('swimlane', saved); W.location.replace(u2.toString());
      }
    } catch (er) { }

    /* ---- 열 설정 ---- */
    var cfg = $('.kb-config');
    function closeConfig() { if (cfg) cfg.hidden = true; }
    var openBtn = $('.kb-config-open');
    if (openBtn && cfg) {
      openBtn.addEventListener('click', function () { cfg.hidden = false; });
      cfg.addEventListener('click', function (e) { if (e.target === cfg || e.target.closest('.kb-config-close')) closeConfig(); });
      $$('.kb-show', cfg).forEach(function (cb) {
        cb.addEventListener('change', function () {
          var h = cb.closest('td').querySelector('.kb-hidden'); if (h) h.disabled = cb.checked;
        });
      });
    }
  }

  if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', init); else init();
})();
