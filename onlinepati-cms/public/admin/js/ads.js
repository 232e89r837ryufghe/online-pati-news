/**
 * Online Pati News CMS — Advertisement Management
 * Handles ad listing, creation, editing, and deletion
 */

let editingAdId = null;
let allAds = [];

// ─── Load Ads ───────────────────────────────────────────────

async function loadAds() {
  const adGridContainer = document.getElementById('adGrid');
  if (!adGridContainer) return;

  adGridContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const data = await apiGet('/ads/manage?per_page=100');
    allAds = data?.ads || [];
    
    updateAdsStats();
    filterAds();
  } catch (err) {
    showToast('Failed to load advertisements: ' + err.message, 'error');
  }
}

function updateAdsStats() {
  const totalEl = document.getElementById('statTotalAds');
  const activeEl = document.getElementById('statActiveAds');
  const expiringEl = document.getElementById('statExpiringAds');
  const placementsEl = document.getElementById('statPlacements');

  if (!totalEl) return;

  const total = allAds.length;
  const active = allAds.filter(ad => ad.status === 'active').length;
  
  // Expiring count: check if expiry_date is set and within next 7 days, or already expired
  const now = new Date();
  const expiring = allAds.filter(ad => {
    if (!ad.expiry_date) return false;
    const expiry = new Date(ad.expiry_date);
    const diffTime = expiry - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7; // expired (<=0) or expiring within 7 days
  }).length;

  const placements = new Set(allAds.map(ad => ad.position)).size;

  totalEl.textContent = total;
  activeEl.textContent = active;
  expiringEl.textContent = expiring;
  placementsEl.textContent = placements;
}

function renderAdsGrid(adsList) {
  const adGridContainer = document.getElementById('adGrid');
  if (!adGridContainer) return;

  if (!adsList.length) {
    adGridContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
        <i class="fas fa-ad" style="font-size: 3rem; margin-bottom: 16px; color: var(--text-muted);"></i>
        <h3>No advertisements found</h3>
        <p>Try a different search or create a new banner using the form.</p>
      </div>`;
    return;
  }

  const now = new Date();

  adGridContainer.innerHTML = adsList.map(ad => {
    let statusClass = ad.status;
    let statusLabel = ad.status;
    
    // Check if expired
    if (ad.expiry_date) {
      const expiry = new Date(ad.expiry_date);
      if (expiry < now) {
        statusClass = 'expired';
        statusLabel = 'Expired';
      }
    }

    return `
      <div class="ad-card premium-card">
        <div class="ad-card-badge">
          <span class="badge badge-${statusClass}">${statusLabel}</span>
        </div>
        <div class="ad-card-banner">
          <img src="${escapeHtml(ad.image_url)}" alt="${escapeHtml(ad.title)}">
        </div>
        <div class="ad-card-body">
          <div class="ad-card-title" title="${escapeHtml(ad.title)}">
            ${escapeHtml(ad.title)}
          </div>
          <div class="ad-card-meta-grid">
            <div class="ad-card-meta-item">
              <i class="fas fa-map-marker-alt"></i>
              <span class="badge-position">${escapeHtml(ad.position.replace('_', ' '))}</span>
            </div>
            ${ad.expiry_date ? `
              <div class="ad-card-meta-item">
                <i class="fas fa-calendar-alt"></i>
                <span>Expires: ${formatDate(ad.expiry_date)}</span>
              </div>
            ` : ''}
            ${ad.link_url ? `
              <div class="ad-card-meta-item">
                <i class="fas fa-link"></i>
                <a href="${escapeHtml(ad.link_url)}" target="_blank" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;">
                  ${escapeHtml(ad.link_url)}
                </a>
              </div>
            ` : ''}
          </div>
          <div class="ad-card-actions">
            <button class="btn btn-ghost btn-icon btn-sm" onclick='editAd(${JSON.stringify(ad)})' title="Edit">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-ghost btn-icon btn-sm" style="color:var(--danger);" onclick="deleteAd(${ad.id}, '${escapeHtml(ad.title)}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function filterAds() {
  const query = (document.getElementById('adsSearchInput')?.value || '').toLowerCase().trim();
  
  if (!query) {
    renderAdsGrid(allAds);
    return;
  }

  const filtered = allAds.filter(ad => {
    const titleMatch = ad.title.toLowerCase().includes(query);
    const positionMatch = ad.position.toLowerCase().includes(query);
    return titleMatch || positionMatch;
  });

  renderAdsGrid(filtered);
}

// ─── Save Ad ────────────────────────────────────────────────

async function saveAd(event) {
  event.preventDefault();
  
  const title = document.getElementById('adTitle').value.trim();
  const position = document.getElementById('adPosition').value;
  const imageUrl = document.getElementById('adImageUrl').value.trim();
  const linkUrl = document.getElementById('adLinkUrl').value.trim();
  const status = document.getElementById('adStatus').value;

  if (!title || !position || !imageUrl) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const adData = {
    title,
    position,
    image_url: imageUrl,
    link_url: linkUrl,
    status,
    expiry_date: document.getElementById('adExpiryDate').value || null
  };

  try {
    const submitBtn = document.getElementById('adSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    if (editingAdId) {
      await apiPut(`/ads/${editingAdId}`, adData);
      showToast('Advertisement updated successfully', 'success');
    } else {
      await apiPost('/ads', adData);
      showToast('Advertisement created successfully', 'success');
    }

    resetAdForm();
    loadAds();
  } catch (err) {
    showToast('Error saving advertisement: ' + err.message, 'error');
  } finally {
    const submitBtn = document.getElementById('adSubmitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Advertisement';
  }
}

// ─── Delete Ad ──────────────────────────────────────────────

async function deleteAd(id, title) {
  const confirmed = await showConfirm(
    'Delete Advertisement?',
    `Are you sure you want to delete "${title}"?`
  );
  
  if (!confirmed) return;

  try {
    await apiDelete(`/ads/${id}`);
    showToast('Advertisement deleted', 'success');
    loadAds();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Edit Ad (Fill Form) ────────────────────────────────────

function editAd(ad) {
  editingAdId = ad.id;
  document.getElementById('adFormTitle').textContent = 'Edit Advertisement';
  document.getElementById('adId').value = ad.id;
  document.getElementById('adTitle').value = ad.title;
  document.getElementById('adPosition').value = ad.position;
  document.getElementById('adImageUrl').value = ad.image_url;
  document.getElementById('adLinkUrl').value = ad.link_url || '';
  document.getElementById('adStatus').value = ad.status;
  document.getElementById('adExpiryDate').value = ad.expiry_date ? ad.expiry_date.split('T')[0] : '';

  updateAdPreview(ad.image_url);
  
  document.getElementById('adSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update Advertisement';
  document.getElementById('adCancelBtn').style.display = 'inline-flex';
  
  // Scroll to form
  document.querySelector('.category-form-panel').scrollIntoView({ behavior: 'smooth' });
}

// ─── Form Helpers ───────────────────────────────────────────

function resetAdForm() {
  editingAdId = null;
  document.getElementById('adForm').reset();
  document.getElementById('adFormTitle').textContent = 'New Advertisement';
  document.getElementById('adSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Save Advertisement';
  document.getElementById('adCancelBtn').style.display = 'none';
  document.getElementById('adImagePreview').style.display = 'none';
}

function updateAdPreview(url) {
  const prevImg = document.getElementById('prevImg');
  const wrapper = document.getElementById('adImagePreview');
  if (url) {
    prevImg.src = url;
    wrapper.style.display = 'block';
  } else {
    wrapper.style.display = 'none';
  }
}

// ─── Media Picker Logic (Reused from posts.js) ─────────────

let mediaPickerTarget = null;
let selectedMediaUrl = null;

window.openMediaPicker = function(target) {
  mediaPickerTarget = target;
  document.getElementById('mediaPickerModal').style.display = 'flex';
  refreshMediaPicker();
};

window.closeMediaPicker = function() {
  document.getElementById('mediaPickerModal').style.display = 'none';
  mediaPickerTarget = null;
  selectedMediaUrl = null;
  document.getElementById('confirmMediaSelect').disabled = true;
};

window.refreshMediaPicker = async function() {
  const grid = document.getElementById('mediaPickerGrid');
  grid.innerHTML = '<div class="loading-spinner"></div>';
  
  try {
    const pickerMediaList = await apiGet('/media');
    
    if (!pickerMediaList.length) {
      grid.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted)">No media found.</p>';
      return;
    }
    
    grid.innerHTML = pickerMediaList.map(item => `
      <div class="media-picker-item" onclick="selectPickerMedia('${item.url}', this)">
        <img src="${item.url}" alt="${item.filename}">
      </div>
    `).join('');
  } catch (e) {
    showToast('Failed to load media', 'error');
  }
};

window.selectPickerMedia = function(url, el) {
  selectedMediaUrl = url;
  document.querySelectorAll('.media-picker-item').forEach(item => item.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('confirmMediaSelect').disabled = false;
};

window.confirmMediaSelection = function() {
  if (!selectedMediaUrl) return;
  
  const input = document.getElementById('adImageUrl');
  if (input) {
    input.value = selectedMediaUrl;
    updateAdPreview(selectedMediaUrl);
  }
  
  closeMediaPicker();
};

window.uploadFromPicker = async function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);
  showToast('Uploading...', 'info');
  
  try {
    await apiPost('/media/upload', formData, true);
    showToast('Upload successful!', 'success');
    refreshMediaPicker();
  } catch (e) {
    showToast('Upload failed', 'error');
  }
};

// Handle manual input preview
document.getElementById('adImageUrl').addEventListener('input', (e) => {
  updateAdPreview(e.target.value);
});
