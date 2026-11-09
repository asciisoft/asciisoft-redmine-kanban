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
        $$('.kb-lane', board).forEach(function (ln) { var t = ln.previousElementSibling; if (t && t.classList.contains('kb-lane-title')) { var em = $('em', t); if (em) em.textContent = $$('.kb-card', ln).length; } });
        if (over && !h.classList.contains('kb-over')) toast(board.dataset.msgWip, true);
        h.classList.toggle('kb-over', over);
      });
    }

    /* ---- 끌어 놓기 (마우스 · 펜) ---- */
    var SWIM = board.dataset.swimlane || 'none';
    var pd = null, justDragged = false;
    function laneOf(el) { var l = el.closest('.kb-lane'); return l ? l.dataset.lane : ''; }
    function laneOk(card, cell) { return SWIM === 'assignee' || laneOf(card) === laneOf(cell); }
    function clearMarks() { $$('.kb-cell', board).forEach(function (c) { c.classList.remove('kb-allowed', 'kb-denied', 'kb-hover'); }); $$('.kb-placeholder', board).forEach(function (p) { p.remove(); }); }
    function cellOk(card, cell, ids) {
      if (!laneOk(card, cell)) return false;
      return cell.dataset.status === card.dataset.status || (ids || []).indexOf(parseInt(cell.dataset.status, 10)) > -1;
    }
    function markCells(card, ids) {
      $$('.kb-cell', board).forEach(function (c) { c.classList.add(cellOk(card, c, ids) ? 'kb-allowed' : 'kb-denied'); });
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
    function startDrag(x, y) {
      var card = pd.card, r = card.getBoundingClientRect();
      pd.started = true; pd.dx = x - r.left; pd.dy = y - r.top;
      pd.from = card.parentNode; pd.next = card.nextSibling; pd.oldStatus = card.dataset.status; pd.oldLane = laneOf(card);
      var g = card.cloneNode(true); g.classList.add('kb-ghost'); g.style.width = r.width + 'px';
      D.body.appendChild(g); pd.ghost = g;
      card.classList.add('kb-dragging'); D.body.classList.add('kb-dragging-on');
      var c0 = card;
      allowed(card.dataset.id).then(function (ids) { if (pd && pd.card === c0) { pd.ids = ids; markCells(c0, ids); } });
      moveDrag(x, y);
    }
    function moveDrag(x, y) {
      pd.ghost.style.left = (x - pd.dx) + 'px'; pd.ghost.style.top = (y - pd.dy) + 'px';
      // 가장자리에 닿으면 자동 스크롤
      var sc = $('.kb-scroll', board), sr = sc.getBoundingClientRect();
      if (x > sr.right - 40) sc.scrollLeft += 18; else if (x < sr.left + 40) sc.scrollLeft -= 18;
      if (y > W.innerHeight - 40) W.scrollBy(0, 18); else if (y < 40) W.scrollBy(0, -18);
      var under = D.elementFromPoint(x, y), cell = under && under.closest && under.closest('.kb-cell');
      $$('.kb-cell.kb-hover', board).forEach(function (c) { if (c !== cell) c.classList.remove('kb-hover'); });
      var ph = $('.kb-placeholder', board);
      if (!cell || !board.contains(cell) || (pd.ids && !cellOk(pd.card, cell, pd.ids)) || !laneOk(pd.card, cell)) { if (ph) ph.remove(); return; }
      cell.classList.add('kb-hover');
      ph = ph || Object.assign(D.createElement('div'), { className: 'kb-placeholder' });
      var after = afterEl(cell, y);
      if (after) cell.insertBefore(ph, after); else cell.appendChild(ph);
    }
    function endDrag() {
      var d = pd, card = d.card, ph = $('.kb-placeholder', board);
      var cell = ph ? ph.parentNode : null, before = ph ? ph.nextSibling : null;
      d.ghost.remove(); D.body.classList.remove('kb-dragging-on'); card.classList.remove('kb-dragging');
      clearMarks();
      justDragged = true; setTimeout(function () { justDragged = false; }, 50);
      if (!cell) return;
      (d.ids ? Promise.resolve(d.ids) : allowed(card.dataset.id)).then(function (ids) {
        if (!cellOk(card, cell, ids)) { toast(board.dataset.msgDenied, true); return; }
        if (cell === d.from && (before === card || before === card.nextSibling)) return;   // 제자리
        finishDrop(card, cell, before && before.parentNode === cell ? before : null, d);
      });
    }
    function finishDrop(card, cell, before, d) {
      cell.insertBefore(card, before);
      var newStatus = cell.dataset.status, newLane = laneOf(cell);
      card.dataset.status = newStatus;
      var order = $$('.kb-card', cell).map(function (c) { return c.dataset.id; });
      refreshCounts();
      post(URL_MOVE, { issue_id: card.dataset.id, status_id: newStatus, order: order, swimlane: SWIM, lane: newLane }).then(function (res) {
        if (!res.ok) {
          d.from.insertBefore(card, d.next && d.next.parentNode === d.from ? d.next : null);  // 되돌리기
          card.dataset.status = d.oldStatus; refreshCounts();
          toast(res.j.error || board.dataset.msgDenied, true);
          return;
        }
        delete allowedCache[card.dataset.id];
        if (res.j.html) {
          var tmp = D.createElement('div'); tmp.innerHTML = res.j.html.trim();
          var fresh = tmp.firstElementChild; if (fresh) { card.replaceWith(fresh); card = fresh; }
        } else card.classList.toggle('kb-is-closed', !!(res.j.status && res.j.status.closed));
        if (newStatus !== d.oldStatus || newLane !== d.oldLane) toast(board.dataset.msgSaved);
      });
    }
    board.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch' || e.button !== 0) return;          // 휴대폰은 카드 팝업의 상태 버튼 사용
      if (e.target.closest('a, button, input, textarea, select')) return;
      var card = e.target.closest('.kb-card.kb-movable');
      if (!card) return;
      allowed(card.dataset.id);
      pd = { card: card, x: e.clientX, y: e.clientY, started: false };
    });
    D.addEventListener('pointermove', function (e) {
      if (!pd) return;
      if (!pd.started) { if (Math.hypot(e.clientX - pd.x, e.clientY - pd.y) > 6) startDrag(e.clientX, e.clientY); return; }
      e.preventDefault(); moveDrag(e.clientX, e.clientY);
    });
    D.addEventListener('pointerup', function () { if (pd && pd.started) endDrag(); pd = null; });
    D.addEventListener('pointercancel', function () {
      if (pd && pd.started) { pd.ghost.remove(); pd.card.classList.remove('kb-dragging'); D.body.classList.remove('kb-dragging-on'); clearMarks(); }
      pd = null;
    });
    board.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('.kb-card')) e.preventDefault(); });

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
      if (justDragged || e.target.closest('a, button, input')) return;
      var card = e.target.closest('.kb-card');
      if (card) openPopup(card.dataset.id);
    });
    if (popBg) {
      var pend = { status: '', assignee: null, due: null, notes: '' };
      function syncConfirm() {
        var cf = $('.kb-pop-confirm', pop);
        if (cf) cf.disabled = !(pend.status || pend.assignee !== null || pend.due !== null || pend.notes);
      }
      popBg.addEventListener('input', function (e) {
        if (e.target.classList && e.target.classList.contains('kb-note')) { pend.notes = e.target.value.trim(); syncConfirm(); }
      });
      popBg.addEventListener('change', function (e) {
        var di = e.target.closest && e.target.closest('.kb-due-input');
        if (di) {
          pend.due = di.value === (di.getAttribute('data-orig') || '') ? null : di.value;
          di.closest('.kb-pop-due').classList.toggle('kb-changed', pend.due !== null);
          syncConfirm(); return;
        }
        var sel = e.target.closest && e.target.closest('.kb-assign-select');
        if (!sel) return;
        var row = sel.closest('.kb-pop-assignee'), nm = $('.kb-assignee-name', row);
        var orig = sel.getAttribute('data-orig');
        pend.assignee = sel.value === orig ? null : sel.value;
        if (nm) nm.textContent = sel.value === '0' ? '-' : sel.options[sel.selectedIndex].text;
        row.classList.toggle('kb-changed', pend.assignee !== null);
        syncConfirm();
      });
      popBg.addEventListener('click', function (e) {
        if (e.target === popBg || e.target.closest('.kb-pop-close')) { closePopup(); return; }
        // 담당자: 이름 또는 [선택]을 누르면 선택박스 표시
        var pick = e.target.closest('.kb-assign-btn, .kb-assignee-name[role="button"]');
        if (pick) {
          var sel = $('.kb-assign-select', pick.closest('.kb-pop-assignee'));
          if (sel) { if (!sel.hasAttribute('data-orig')) sel.setAttribute('data-orig', sel.value); sel.hidden = false; pick.closest('.kb-pop-assignee').classList.add('kb-editing'); sel.focus(); }
          return;
        }
        var st = e.target.closest('.kb-pop-st');
        if (st) {                                                     // 상태는 고르기만 하고 [확인]에서 함께 저장
          $$('.kb-pop-st', pop).forEach(function (b) { b.classList.remove('kb-sel'); });
          var same = st.classList.contains('kb-cur');
          if (!same) st.classList.add('kb-sel');
          pend.status = same ? '' : st.dataset.status;
          syncConfirm();
          return;
        }
        var ok = e.target.closest('.kb-pop-confirm');
        if (!ok || ok.disabled) return;
        var id = pop.dataset.id, card = $('.kb-card[data-id="' + id + '"]', board);
        var sid = pend.status || ok.dataset.status || (card && card.dataset.status) || '';
        var data = { issue_id: id, status_id: sid };
        if (pend.assignee !== null) data.assigned_to_id = pend.assignee;
        if (pend.due !== null) data.due_date = pend.due;
        if (pend.notes) data.notes = pend.notes;
        var lane = card ? card.closest('.kb-lane') : null;
        var tcell = lane && pend.status ? $('.kb-cell[data-status="' + pend.status + '"]', lane) : null;
        if (tcell) data.order = $$('.kb-card', tcell).map(function (c) { return c.dataset.id; }).concat([id]);
        ok.disabled = true;
        post(URL_MOVE, data).then(function (res) {
          if (!res.ok) { ok.disabled = false; toast(res.j.error || board.dataset.msgDenied, true); return; }
          delete allowedCache[id];
          if (SWIM === 'assignee' && pend.assignee !== null) { W.location.reload(); return; }   // 다른 담당자 줄로 이동
          var newSid = String(res.j.status && res.j.status.id || sid);
          var cell = lane ? $('.kb-cell[data-status="' + newSid + '"]', lane) : null;
          if (card && cell) {
            if (card.parentNode !== cell) cell.appendChild(card);
            card.dataset.status = newSid;
            if (res.j.html) { var tmp = D.createElement('div'); tmp.innerHTML = res.j.html.trim(); var fresh = tmp.firstElementChild; if (fresh) card.replaceWith(fresh); }
            else card.classList.toggle('kb-is-closed', !!(res.j.status && res.j.status.closed));
          } else if (card) card.remove();                       // 숨긴 열로 옮긴 경우
          refreshCounts(); toast(board.dataset.msgSaved);
          openPopup(id);
        });
      });
      var _open = openPopup;
      openPopup = function (id) { pend = { status: '', assignee: null, due: null, notes: '' }; _open(id); };
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

    /* ---- 가로줄 · 열 설정: 테마의 [검색조건] 버튼이 있으면 그 오른쪽으로 ---- */
    var tools = $('.kb-tools');
    function placeTools() {
      var r = $('.as-toolbar-r');
      if (tools && r && !r.contains(tools)) { r.appendChild(tools); return true; }
      return !!(r && r.contains(tools));
    }
    if (!placeTools()) { var tries = 0, iv = setInterval(function () { if (placeTools() || ++tries > 20) clearInterval(iv); }, 150); }

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
