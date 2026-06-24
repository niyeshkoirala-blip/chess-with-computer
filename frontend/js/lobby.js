// Lobby page logic
(function () {
  const socket = io();
  let currentUser = null;

  const $ = id => document.getElementById(id);

  // ── Auth ────────────────────────────────────────────────────────────────────
  async function checkAuth() {
    const r = await fetch('/api/auth/me').then(r => r.json());
    currentUser = r.loggedIn ? (r.displayName || r.username) : null;
    updateAuthUI();
  }

  function updateAuthUI() {
    const badge = $('user-badge');
    if (currentUser) {
      badge.innerHTML = `Signed in as <strong>${escHtml(currentUser)}</strong>`;
      $('btn-login')?.classList.add('hidden');
      $('btn-logout')?.classList.remove('hidden');
      $('btn-matches')?.classList.remove('hidden');

      // Hide name inputs in modals, show "playing as" labels
      document.querySelectorAll('.name-guest-field').forEach(el => el.classList.add('hidden'));
      document.querySelectorAll('.signed-in-username').forEach(el => el.textContent = currentUser);
      document.querySelectorAll('.name-signed-in').forEach(el => el.classList.remove('hidden'));
    } else {
      badge.innerHTML = '';
      $('btn-login')?.classList.remove('hidden');
      $('btn-logout')?.classList.add('hidden');
      $('btn-matches')?.classList.add('hidden');

      // Show name inputs, hide "playing as" labels
      document.querySelectorAll('.name-guest-field').forEach(el => el.classList.remove('hidden'));
      document.querySelectorAll('.name-signed-in').forEach(el => el.classList.add('hidden'));
    }
  }

  $('btn-login')?.addEventListener('click', () => openModal('auth-modal'));
  $('btn-logout')?.addEventListener('click', async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateAuthUI();
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.auth-form').forEach(f => {
        f.classList.toggle('hidden', f.id !== target);
      });
    });
  });

  // ── Password strength meter ──────────────────────────────────────────────────
  $('reg-password')?.addEventListener('input', () => {
    const val   = $('reg-password').value;
    const fill  = $('reg-strength-fill');
    const label = $('reg-strength-label');
    if (!fill) return;
    if (!val)  { fill.style.width = '0%'; label.textContent = ''; return; }

    const score = [
      val.length >= 8,
      /[A-Z]/.test(val),
      /[0-9]/.test(val),
      /[^a-zA-Z0-9]/.test(val) || val.length >= 12,
    ].filter(Boolean).length;

    const levels = ['', 'weak', 'fair', 'good', 'strong'];
    const names  = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    fill.className    = `strength-fill ${levels[score]}`;
    fill.style.width  = `${score * 25}%`;
    label.textContent = names[score];
    label.style.color = score >= 3 ? 'var(--green-dark)' : score === 2 ? '#a07c3a' : '#8B4A2A';
  });

  // ── Register: Step 1 — submit form, request OTP ───────────────────────────
  let _pendingEmail = null;  // held between step 1 and step 2

  $('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('reg-error');
    errEl.textContent = '';

    const username    = $('reg-username').value.trim();
    const displayName = $('reg-displayname')?.value.trim();
    const email       = $('reg-email').value.trim();
    const password    = $('reg-password').value;
    const confirm     = $('reg-confirm').value;

    // Client-side validation
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      errEl.textContent = 'Username may only contain letters, numbers, and underscores.'; return;
    }
    if (password !== confirm) {
      errEl.textContent = 'Passwords do not match.'; return;
    }
    if (password.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.'; return;
    }
    if (!/[A-Z]/.test(password)) {
      errEl.textContent = 'Password must contain at least one uppercase letter.'; return;
    }
    if (!/[0-9]/.test(password)) {
      errEl.textContent = 'Password must contain at least one number.'; return;
    }

    const btn = $('reg-submit-btn');
    btn.disabled = true;
    btn.textContent = 'Sending code…';

    const res = await fetch('/api/auth/register/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, email, password }),
    }).then(r => r.json());

    btn.disabled = false;
    btn.textContent = 'Send Verification Code';

    if (res.ok) {
      _pendingEmail = email;
      $('otp-email-hint').textContent = res.maskedEmail;
      $('otp-input').value = '';
      $('otp-error').textContent = '';
      $('register-form').classList.add('hidden');
      $('otp-step').classList.remove('hidden');
      setTimeout(() => $('otp-input').focus(), 80);
    } else {
      errEl.textContent = res.error;
    }
  });

  // ── Register: Step 2 — verify OTP ────────────────────────────────────────
  $('otp-verify-btn')?.addEventListener('click', async () => {
    const otp    = $('otp-input').value.trim();
    const errEl  = $('otp-error');
    errEl.textContent = '';

    if (!otp || otp.length !== 6) {
      errEl.textContent = 'Enter the 6-digit code from your email.'; return;
    }

    const btn = $('otp-verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';

    const res = await fetch('/api/auth/register/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _pendingEmail, otp }),
    }).then(r => r.json());

    btn.disabled = false;
    btn.textContent = 'Verify & Create Account';

    if (res.ok) {
      currentUser = res.displayName || res.username;
      _pendingEmail = null;
      updateAuthUI();
      closeModal('auth-modal');
      // Reset forms for next open
      $('register-form').reset();
      $('otp-step').classList.add('hidden');
      $('register-form').classList.remove('hidden');
    } else {
      errEl.textContent = res.error;
    }
  });

  // ── Resend OTP ────────────────────────────────────────────────────────────
  $('otp-resend-btn')?.addEventListener('click', async () => {
    const errEl = $('otp-error');
    const btn   = $('otp-resend-btn');
    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = 'Sending…';

    const res = await fetch('/api/auth/register/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _pendingEmail }),
    }).then(r => r.json());

    btn.disabled = false;
    btn.textContent = 'Resend code';

    if (res.ok) {
      showToast('New code sent!');
      $('otp-input').value = '';
      $('otp-input').focus();
    } else {
      errEl.textContent = res.error;
    }
  });

  // ── Back to form ──────────────────────────────────────────────────────────
  $('otp-back-btn')?.addEventListener('click', () => {
    _pendingEmail = null;
    $('otp-step').classList.add('hidden');
    $('register-form').classList.remove('hidden');
    $('otp-error').textContent = '';
  });

  $('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = $('login-username').value.trim();
    const password = $('login-password').value;
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json());
    if (res.ok) { currentUser = res.displayName || res.username; updateAuthUI(); closeModal('auth-modal'); }
    else $('login-error').textContent = res.error;
  });

  // ── Modal helpers ────────────────────────────────────────────────────────────
  function openModal(id) { $(id)?.classList.remove('hidden'); }
  function closeModal(id) { $(id)?.classList.add('hidden'); }

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay').classList.add('hidden');
      // Reset OTP step when auth modal is closed mid-flow
      if (btn.closest('#auth-modal')) resetOtpFlow();
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target !== overlay) return;
      overlay.classList.add('hidden');
      if (overlay.id === 'auth-modal') resetOtpFlow();
    });
  });

  function resetOtpFlow() {
    _pendingEmail = null;
    $('otp-step')?.classList.add('hidden');
    $('register-form')?.classList.remove('hidden');
    $('otp-error') && ($('otp-error').textContent = '');
  }

  // ── Color picker ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.color-picker').forEach(picker => {
    picker.querySelectorAll('.color-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        picker.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
  });

  // ── Difficulty pills ─────────────────────────────────────────────────────────
  document.querySelectorAll('.diff-pills').forEach(group => {
    group.querySelectorAll('.diff-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        group.querySelectorAll('.diff-pill').forEach(p => p.classList.remove('selected'));
        pill.classList.add('selected');
      });
    });
  });

  function getSelectedColor(pickerId) {
    const sel = document.querySelector(`#${pickerId} .color-opt.selected`);
    return sel ? sel.dataset.value : 'white';
  }
  function getSelectedDiff(pillGroupId) {
    const sel = document.querySelector(`#${pillGroupId} .diff-pill.selected`);
    return sel ? Number(sel.dataset.value) : 3;
  }

  // ── Socket: unified game-created handler ─────────────────────────────────────
  socket.on('game-created', ({ gameId, color, playerToken, gameState }) => {
    const mode = gameState.mode;

    if (mode === 'hvh') {
      // Show waiting room with shareable code
      $('waiting-code').textContent = gameId;
      $('waiting-color').textContent = color === 'white' ? '♙ White' : '♟ Black';
      closeModal('hvh-modal');
      openModal('waiting-modal');
      sessionStorage.setItem('chess-game', JSON.stringify({ gameId, color, mode, playerToken }));
      return;
    }

    // For all other modes, go straight to game page
    sessionStorage.setItem('chess-game', JSON.stringify({ gameId, color, mode, playerToken }));
    window.location.href = '/game.html';
  });

  socket.on('game-started', (gameState) => {
    // Only relevant for hvh: when opponent joins the waiting room
    if (gameState.mode !== 'hvh') return;
    const stored = JSON.parse(sessionStorage.getItem('chess-game') || '{}');
    if (stored.gameId === gameState.id) {
      closeModal('waiting-modal');
      window.location.href = '/game.html';
    }
  });

  // ── HvH Online ───────────────────────────────────────────────────────────────
  $('mode-hvh-online')?.addEventListener('click', () => openModal('hvh-modal'));

  $('btn-create-hvh')?.addEventListener('click', () => {
    const playerName = currentUser || $('hvh-player-name')?.value.trim() || 'Player 1';
    const preferredColor = getSelectedColor('hvh-color-picker');
    socket.emit('create-game', { mode: 'hvh', preferredColor, playerName });
  });

  $('btn-copy-code')?.addEventListener('click', () => {
    navigator.clipboard.writeText($('waiting-code').textContent);
    showToast('Code copied!');
  });

  $('btn-join-hvh')?.addEventListener('click', () => {
    closeModal('hvh-modal');
    openModal('join-modal');
  });

  $('btn-do-join')?.addEventListener('click', () => {
    const code = $('join-code-input').value.trim().toUpperCase();
    const playerName = currentUser || $('join-player-name')?.value.trim() || 'Player 2';
    if (!code) return;
    $('join-error').textContent = '';
    socket.emit('join-game', { code, playerName });
  });

  socket.on('game-joined', ({ gameId, color, playerToken, gameState }) => {
    sessionStorage.setItem('chess-game', JSON.stringify({ gameId, color, mode: 'hvh', playerToken }));
    closeModal('join-modal');
    window.location.href = '/game.html';
  });

  socket.on('join-error', (msg) => {
    $('join-error').textContent = msg;
  });

  // ── Local 2-player ───────────────────────────────────────────────────────────
  $('mode-hvh-local')?.addEventListener('click', () => {
    socket.emit('create-game', { mode: 'hvh-local', preferredColor: 'white', playerName: 'White' });
  });

  // ── Human vs Bot ─────────────────────────────────────────────────────────────
  $('mode-hvb')?.addEventListener('click', () => openModal('hvb-modal'));

  $('btn-start-hvb')?.addEventListener('click', () => {
    let preferredColor = getSelectedColor('hvb-color-picker');
    if (preferredColor === 'random') preferredColor = Math.random() < 0.5 ? 'white' : 'black';
    const botColor = preferredColor === 'white' ? 'black' : 'white';
    const difficulty = getSelectedDiff('hvb-diff-pills');
    socket.emit('create-game', { mode: 'hvb', preferredColor, botColor, difficulty, playerName: currentUser || 'You' });
    closeModal('hvb-modal');
  });

  // ── Bot vs Bot ───────────────────────────────────────────────────────────────
  $('mode-bvb')?.addEventListener('click', () => openModal('bvb-modal'));

  $('btn-start-bvb')?.addEventListener('click', () => {
    const difficulty = getSelectedDiff('bvb-diff-pills');
    socket.emit('create-game', { mode: 'bvb', difficulty });
    closeModal('bvb-modal');
  });

  // ── Open games ───────────────────────────────────────────────────────────────
  socket.on('lobby-state', (games) => {
    const list = $('open-game-list');
    const empty = $('no-open-games');
    list.innerHTML = '';
    if (!games.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    games.forEach(g => {
      const el = document.createElement('div');
      el.className = 'open-game-item';
      el.innerHTML = `
        <div class="game-info">
          <span>${escHtml(g.name)}'s game</span>
          <small>Code: <strong>${escHtml(g.id)}</strong></small>
        </div>
        <button class="btn btn-sm btn-primary">Join</button>
      `;
      el.querySelector('button').addEventListener('click', () => {
        $('join-code-input').value = g.id;
        openModal('join-modal');
      });
      list.appendChild(el);
    });
  });

  socket.emit('get-lobby');
  setInterval(() => socket.emit('get-lobby'), 10000);

  // ── Toast ────────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2500);
  }

  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
  }

  checkAuth();
})();
