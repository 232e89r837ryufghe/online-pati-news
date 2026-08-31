/**
 * Online Pati News CMS — Settings Management
 */

async function initSettingsPage() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = 'login.html';
    return;
  }

  initMobileToggle();
  loadSettings();
  check2FAStatus();

  // GitHub Settings Form
  const githubForm = document.getElementById('githubSettingsForm');
  if (githubForm) {
    githubForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveSettings();
    });
  }

  // Password Reset Form
  const passwordForm = document.getElementById('passwordResetForm');
  if (passwordForm) {
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      updatePassword();
    });
  }
}

async function loadSettings() {
  try {
    const settings = await apiGet('/admin/settings');
    if (settings) {
      if (settings.GITHUB_PAT) {
        document.getElementById('githubPat').value = '********'; // Masked
        document.getElementById('githubPat').placeholder = 'Saved (Token hidden)';
      }
      if (settings.GITHUB_REPO) {
        document.getElementById('githubRepo').value = settings.GITHUB_REPO;
      }
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

async function saveSettings() {
  const pat = document.getElementById('githubPat').value.trim();
  const repo = document.getElementById('githubRepo').value.trim();
  const btn = document.getElementById('saveGithubBtn');

  if (!repo) {
    showToast('Repository name is required', 'error');
    return;
  }

  const settingsToSave = {
    GITHUB_REPO: repo
  };

  // Only update PAT if the user entered something (not the masked placeholder)
  if (pat && pat !== '********') {
    settingsToSave.GITHUB_PAT = pat;
  }

  try {
    btn.disabled = true;
    showToast('Saving...', 'info');

    await apiPost('/admin/settings', settingsToSave);

    showToast('Settings saved successfully!', 'success');
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─── Security Feature Logic ──────────────────────────────────

async function updatePassword() {
  const newPassword = document.getElementById('newPassword').value;
  if (!newPassword || newPassword.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }

  try {
    showToast('Updating password...', 'info');
    await apiPost('/auth/change-password', { newPassword });
    showToast('Password updated successfully!', 'success');
    document.getElementById('newPassword').value = '';
  } catch (err) {
    showToast('Failed to update password: ' + err.message, 'error');
  }
}

async function check2FAStatus() {
  try {
    const res = await apiGet('/auth/2fa-status');
    update2FAUI(res.enabled);
  } catch (err) {
    console.error('Failed to check 2FA status:', err);
  }
}

function update2FAUI(enabled) {
  const badge = document.getElementById('twoFactorBadge');
  const btnInit = document.getElementById('btnInit2FA');
  const btnDisable = document.getElementById('btnDisable2FA');
  
  if (enabled) {
    badge.textContent = 'Enabled';
    badge.className = 'badge badge-success';
    btnInit.style.display = 'none';
    btnDisable.style.display = 'block';
  } else {
    badge.textContent = 'Disabled';
    badge.className = 'badge badge-warning';
    btnInit.style.display = 'block';
    btnDisable.style.display = 'none';
  }
}

let temp2FASecret = '';

async function init2FASetup() {
  try {
    showToast('Initializing setup...', 'info');
    const res = await apiGet('/auth/2fa-setup');
    temp2FASecret = res.secret;

    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: res.uri,
      width: 180,
      height: 180,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('twoFactorSetup').style.display = 'block';
    document.getElementById('btnInit2FA').style.display = 'none';
  } catch (err) {
    showToast('Failed to start 2FA setup: ' + err.message, 'error');
  }
}

async function enable2FA() {
  const code = document.getElementById('twoFactorCode').value.trim();
  if (code.length !== 6) {
    showToast('Enter 6-digit code', 'error');
    return;
  }

  try {
    await apiPost('/auth/2fa-enable', { secret: temp2FASecret, code });
    showToast('Two-Factor Authentication enabled!', 'success');
    document.getElementById('twoFactorSetup').style.display = 'none';
    document.getElementById('twoFactorCode').value = '';
    check2FAStatus();
  } catch (err) {
    showToast('Setup failed: ' + err.message, 'error');
  }
}

async function disable2FA() {
  if (!confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) return;

  try {
    await apiPost('/auth/2fa-disable');
    showToast('2FA disabled', 'success');
    check2FAStatus();
  } catch (err) {
    showToast('Failed to disable: ' + err.message, 'error');
  }
}

if (window.location.pathname.includes('/settings')) {
  initSettingsPage();
}
