/**
 * Online Pati News CMS — Media Library Logic
 */

let allMedia = [];
let currentMediaItem = null;

async function initMediaPage() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = 'login.html';
    return;
  }

  initMobileToggle();
  setupUploadHandlers();
  loadMedia();
}

// ─── Data Loading ───────────────────────────────────────────

async function loadMedia() {
  const grid = document.getElementById('mediaGrid');
  grid.innerHTML = '<div class="loading-spinner"></div>';

  try {
    allMedia = await apiGet('/media');
    document.getElementById('mediaCount').textContent = `${allMedia.length} files`;

    if (!allMedia.length) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fas fa-images"></i>
          <h3>No media found</h3>
          <p>Upload your first file to get started.</p>
        </div>`;
      return;
    }

    grid.innerHTML = allMedia.map(item => `
      <div class="media-item" onclick="openMediaDetail(${item.id})">
        <img src="${item.url}" alt="${item.filename}" loading="lazy">
        <div class="media-item-info">
          <span class="media-item-name">${escapeHtml(item.filename)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error('Load media error:', e);
    showToast('Failed to load media', 'error');
  }
}

// ─── Upload Logic ───────────────────────────────────────────

function setupUploadHandlers() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  ['dragleave', 'drop'].forEach(event => {
    dropZone.addEventListener(event, () => dropZone.classList.remove('drag-over'));
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  });

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));
}

async function handleFiles(files) {
  if (!files.length) return;

  for (const file of files) {
    if (!file.type.startsWith('image/')) {
      showToast(`${file.name} is not an image file`, 'error');
      continue;
    }

    await uploadFile(file);
  }

  loadMedia();
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  showToast(`Uploading: ${file.name}...`, 'info');

  try {
    const res = await apiPost('/media/upload', formData, true); // true = isFormData
    showToast(`${file.name} uploaded successfully`, 'success');
  } catch (e) {
    console.error('Upload error:', e);
    showToast(`${file.name} failed to upload`, 'error');
  }
}

// ─── Modal Logic ────────────────────────────────────────────

function openMediaDetail(id) {
  const item = allMedia.find(m => m.id === id);
  if (!item) return;

  currentMediaItem = item;

  document.getElementById('detailImage').src = item.url;
  document.getElementById('detailFilename').value = item.filename;
  document.getElementById('detailUrl').value = item.url;
  document.getElementById('detailSize').textContent = formatBytes(item.size);
  document.getElementById('detailDate').textContent = formatDate(item.created_at);

  document.getElementById('mediaModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('mediaModal').style.display = 'none';
  currentMediaItem = null;
}

async function deleteMediaFromModal() {
  if (!currentMediaItem) return;

  if (!confirm('Are you sure? This image will be deleted.')) return;

  try {
    await apiDelete(`/media/${currentMediaItem.id}`);
    showToast('Image deleted successfully', 'success');
    closeModal();
    loadMedia();
  } catch (e) {
    showToast('Failed to delete', 'error');
  }
}

function copyUrl() {
  const urlInput = document.getElementById('detailUrl');
  urlInput.select();
  document.execCommand('copy');
  showToast('URL copied to clipboard', 'success');
}

// ─── Helpers ────────────────────────────────────────────────

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

if (window.location.pathname.includes('/media')) {
  initMediaPage();
}
