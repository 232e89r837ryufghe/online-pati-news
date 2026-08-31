/**
 * Online Pati News CMS — Advertisement Management
 * Handles ad listing, creation, editing, and deletion
 */

let editingAdId = null;

// ─── Load Ads ───────────────────────────────────────────────

async function loadAds() {
  const adListContainer = document.getElementById('adList');
  if (!adListContainer) return;

  adListContainer.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const data = await apiGet('/ads/manage?per_page=100');
    
    if (!data || !data.ads.length) {
      adListContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-ad"></i>
          <h3>No advertisements found</h3>
          <p>Create your first advertisement banner using the form.</p>
        </div>`;
      return;
    }

    adListContainer.innerHTML = data.ads.map(ad => `
      <div class="ad-card">
        <div class="ad-card-preview">
          <img src="${escapeHtml(ad.image_url)}" alt="${escapeHtml(ad.title)}">
        </div>
        <div class="ad-card-info">
          <div class="ad-card-title">
            ${escapeHtml(ad.title)}
            <span class="badge badge-${ad.status}">${ad.status}</span>
          </div>
          <div class="ad-card-meta">
             <span class="badge-position">${escapeHtml(ad.position.replace('_', ' '))}</span>
             ${ad.expiry_date ? `<span style="margin-left:10px; font-size:0.75rem; color:var(--text-muted)"><i class="fas fa-clock"></i> Expires: ${formatDate(ad.expiry_date)}</span>` : ''}
             ${ad.link_url ? `<br><a href="${escapeHtml(ad.link_url)}" target="_blank" style="font-size:0.75rem;"><i class="fas fa-link"></i> ${escapeHtml(ad.link_url)}</a>` : ''}
          </div>
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
    `).join('');

  } catch (err) {
    showToast('Failed to load advertisements: ' + err.message, 'error');
  }
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
