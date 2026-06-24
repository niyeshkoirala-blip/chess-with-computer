(function () {
  const $ = id => document.getElementById(id);

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)   return 'just now';
    if (mins  < 60)  return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days  < 30)  return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  }

  // ── Result display ────────────────────────────────────────────────────────────
  function resultIcon(match) {
    const { reason, winner } = match.result || {};
    if (!reason) return { icon: '🏁', label: 'Ended' };
    if (reason === 'stalemate') return { icon: '🤝', label: 'Stalemate' };
    if (reason === 'draw')      return { icon: '🤝', label: 'Draw' };
    if (reason === 'checkmate') {
      return winner === match.myColor
        ? { icon: '🏆', label: 'Win — Checkmate' }
        : { icon: '❌', label: 'Loss — Checkmate' };
    }
    if (reason === 'resign') {
      return winner === match.myColor
        ? { icon: '🏆', label: 'Win — Resignation' }
        : { icon: '🏳️', label: 'Resigned' };
    }
    if (reason === 'disconnect') {
      return winner === match.myColor
        ? { icon: '🏆', label: 'Win — Opponent left' }
        : { icon: '📡', label: 'Loss — Disconnected' };
    }
    return { icon: '🏁', label: reason };
  }

  function modeLabel(match) {
    const opp = match.myColor === 'white' ? match.playerNames?.black : match.playerNames?.white;
    switch (match.mode) {
      case 'hvb':       return `vs Computer — ${escHtml(opp || 'Stockfish')}`;
      case 'hvh':       return `Online vs ${escHtml(opp || 'Opponent')}`;
      case 'hvh-local': return 'Local 2-Player';
      case 'bvb':       return 'Engine vs Engine';
      default:          return escHtml(match.mode || '');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  function renderMatches(matches) {
    const list = $('match-list');
    list.innerHTML = '';

    matches.forEach(match => {
      const { icon, label } = resultIcon(match);
      const card = document.createElement('div');
      card.className = 'match-card';
      card.dataset.id = match._id;

      const badgeClass = match.permanent ? 'pinned' : 'auto';
      const badgeText  = match.permanent ? 'Pinned' : 'Auto-saved';

      card.innerHTML = `
        <div class="match-result-icon">${icon}</div>
        <div class="match-info">
          <div class="match-title">
            ${escHtml(label)}
            <span class="match-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="match-meta">${modeLabel(match)} · ${timeAgo(match.date)} · ${match.moveHistory?.length ?? '?'} moves</div>
        </div>
        <div class="match-actions">
          ${!match.permanent ? `<button class="btn btn-sm btn-ghost btn-pin" data-id="${match._id}">Pin</button>` : ''}
          <a class="btn btn-sm btn-secondary" href="/replay.html?id=${match._id}">Replay</a>
          <button class="btn btn-sm btn-danger btn-delete" data-id="${match._id}">Delete</button>
        </div>
      `;
      list.appendChild(card);
    });

    // Wire up pin buttons
    list.querySelectorAll('.btn-pin').forEach(btn => {
      btn.addEventListener('click', () => pinMatch(btn.dataset.id, btn));
    });

    // Wire up delete buttons
    list.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteMatch(btn.dataset.id));
    });
  }

  // ── API calls ─────────────────────────────────────────────────────────────────
  async function pinMatch(id, btn) {
    btn.disabled = true;
    const res = await fetch(`/api/matches/${id}/pin`, { method: 'PATCH' }).then(r => r.json());
    if (res.ok) {
      showToast('Match pinned!');
      loadMatches();
    } else {
      btn.disabled = false;
      showToast(res.error || 'Failed to pin');
    }
  }

  async function deleteMatch(id) {
    if (!confirm('Delete this match? This cannot be undone.')) return;
    const res = await fetch(`/api/matches/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.ok) {
      showToast('Match deleted');
      loadMatches();
    } else {
      showToast(res.error || 'Failed to delete');
    }
  }

  async function loadMatches() {
    $('matches-loading').classList.remove('hidden');
    $('match-list').innerHTML = '';
    $('matches-empty').classList.add('hidden');

    const res = await fetch('/api/matches');
    $('matches-loading').classList.add('hidden');

    if (res.status === 401) {
      $('matches-auth-guard').classList.remove('hidden');
      return;
    }

    const matches = await res.json();
    if (!Array.isArray(matches) || matches.length === 0) {
      $('matches-empty').classList.remove('hidden');
      return;
    }

    renderMatches(matches);
  }

  loadMatches();
})();
