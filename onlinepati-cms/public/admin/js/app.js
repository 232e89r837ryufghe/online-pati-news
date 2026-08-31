/**
 * Online Pati News CMS — Admin App Core
 * Handles routing, auth state, and shared utilities
 */

const isSubPath = window.location.pathname.startsWith('/admin');
const API_BASE = '/api';
const BASE_URL = isSubPath ? '/admin/' : '/';

// ─── Auth State ─────────────────────────────────────────────
let currentUser = null;

async function checkAuth() {
  try {
    const token = localStorage.getItem('cms_token');
    const res = await fetch(`${API_BASE}/auth/me`, { 
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated) {
        currentUser = data.user;
        return true;
      }
    }
  } catch (e) {}
  currentUser = null;
  return false;
}

async function login(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  
  currentUser = data.user;
  // Also store token for API calls
  localStorage.setItem('cms_token', data.token);
  return data;
}

async function logout() {
  await fetch(`${API_BASE}/auth/logout`, { 
    method: 'POST', 
    credentials: 'include' 
  });
  currentUser = null;
  localStorage.removeItem('cms_token');
  window.location.href = 'login.html';
}

// ─── API Helpers ────────────────────────────────────────────

async function apiGet(path) {
  const token = localStorage.getItem('cms_token');
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

async function apiPost(path, body, isFormData = false) {
  const token = localStorage.getItem('cms_token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: isFormData ? body : JSON.stringify(body)
  });
  
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiPut(path, body) {
  const token = localStorage.getItem('cms_token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiDelete(path) {
  const token = localStorage.getItem('cms_token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  });
  if (res.status === 401) {
    window.location.href = 'login.html';
    return null;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Toast Notifications ────────────────────────────────────

function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? 'fa-check-circle' : 
               type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
  
  toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ─── Slug Generation (Client-side) ─────────────────────────

function generateSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0900-\u097F\u0966-\u096Fa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ─── Confirm Modal ──────────────────────────────────────────

function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="modalCancel">Cancel</button>
          <button class="btn btn-danger" id="modalConfirm">
            <i class="fas fa-trash"></i> Delete
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#modalConfirm').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector('#modalCancel').onclick = () => {
      overlay.remove();
      resolve(false);
    };
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    };
  });
}

// ─── Format Date ────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric' 
  });
}

function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { 
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Sidebar Active State ───────────────────────────────────

function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.page === page) {
      item.classList.add('active');
    }
  });
}

// ─── Mobile Sidebar Toggle ─────────────────────────────────

function initMobileToggle() {
  const toggle = document.getElementById('mobileMenuToggle');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
  }
}
// ─── Deployment Logic ────────────────────────────────────────

async function triggerDeploy(btnElement) {
  const btn = btnElement || document.getElementById('sidebarDeployBtn') || document.querySelector('.admin-header .btn-success');
  if (!btn) return;

  const originalHtml = btn.innerHTML;
  
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    
    await apiPost('/admin/settings/deploy', {});
    showToast('Deployment triggered! Your site will be updated in a few minutes.', 'success');
  } catch (err) {
    showToast('Deployment failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalHtml;
  }
}

// ─── Shared Utilities ──────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
