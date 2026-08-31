/**
 * Online Pati News CMS — Post Management
 * Handles post listing, creation, editing, and deletion
 */

// ─── Load Posts List ──────────────────────────────────────────

async function loadPosts(status = '') {
  const tableBody = document.getElementById('postsTableBody');
  if (!tableBody) return;

  tableBody.innerHTML = '<tr><td colspan="6"><div class="loading-spinner"></div></td></tr>';

  try {
    const query = status ? `?status=${status}&per_page=50` : '?per_page=50';
    const data = await apiGet(`/posts/admin/list${query}`);
    
    if (!data || !data.posts.length) {
      tableBody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state">
            <i class="fas fa-newspaper"></i>
            <h3>No posts found</h3>
            <p>Use the button above to create a new post</p>
          </div>
        </td></tr>`;
      return;
    }

    tableBody.innerHTML = data.posts.map(post => {
      // Handle multiple categories display
      const categories = post.categories || [];
      const categoryNames = categories.length 
        ? categories.map(c => c.name).join(', ') 
        : '—';

      return `
        <tr>
          <td class="td-title">
            <a href="posts.html?edit=${post.id}">${escapeHtml(post.title)}</a>
          </td>
          <td>
            <span class="badge badge-category">${escapeHtml(categoryNames)}</span>
          </td>
          <td>
            <span class="badge badge-${post.status}">
              <i class="fas fa-circle" style="font-size:0.4rem"></i>
              ${post.status === 'published' ? 'Published' : post.status === 'draft' ? 'Draft' : 'Archived'}
            </span>
          </td>
          <td>${escapeHtml(post.author)}</td>
          <td>${formatDate(post.updated_at)}</td>
          <td>
            <div class="action-group">
              <a href="posts.html?edit=${post.id}" class="btn btn-ghost btn-icon" title="Edit">
                <i class="fas fa-pen-to-square"></i>
              </a>
              <button class="btn btn-danger btn-icon" onclick="deletePost(${post.id}, '${escapeHtml(post.title)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');
    
    const totalEl = document.getElementById('postsTotalCount');
    if (totalEl) totalEl.textContent = data.total;
    
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePost(id, title) {
  const confirmed = await showConfirm(
    'Delete Post?',
    `Are you sure you want to delete "${title}"? This action cannot be undone.`
  );
  
  if (!confirmed) return;

  try {
    await apiDelete(`/posts/admin/${id}`);
    showToast('Post deleted successfully', 'success');
    loadPosts();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Load Post for Editing ──────────────────────────────────

async function loadPostForEdit(postId) {
  try {
    const post = await apiGet(`/posts/admin/${postId}`);
    if (!post) return;

    document.getElementById('postId').value = post.id;
    document.getElementById('postTitle').value = post.title;
    document.getElementById('postSlug').value = post.slug;
    document.getElementById('postExcerpt').value = post.excerpt || '';
    document.getElementById('postImage').value = post.featured_image || '';
    document.getElementById('postAuthor').value = post.author || 'Online Pati';
    
    // Set categories (Checkboxes)
    const categoryList = document.getElementById('categoryList');
    if (categoryList && post.category_ids) {
      const checks = categoryList.querySelectorAll('input[type="checkbox"]');
      checks.forEach(check => {
        check.checked = post.category_ids.includes(parseInt(check.value));
      });
    }

    setPostStatus(post.status);
    document.getElementById('postShowImage').checked = post.show_image !== undefined ? !!post.show_image : true;

    if (window.editor) {
      window.editor.commands.setContent(post.content || '');
    }

    const deleteBtn = document.getElementById('btnDeletePostEditor');
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';

  } catch (err) {
    showToast('Failed to load post: ' + err.message, 'error');
  }
}

window.deletePostFromEditor = async function() {
  const postId = document.getElementById('postId').value;
  const title = document.getElementById('postTitle').value;
  if (!postId) return;

  const confirmed = await showConfirm(
    'Delete Post?',
    `Are you sure you want to delete "${escapeHtml(title)}"? This action cannot be undone.`
  );
  
  if (!confirmed) return;

  try {
    await apiDelete(`/posts/admin/${postId}`);
    showToast('Post deleted successfully', 'success');
    setTimeout(() => {
      window.location.href = 'posts.html';
    }, 1000);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Save Post ──────────────────────────────────────────────

async function savePost() {
  const postId = document.getElementById('postId')?.value;
  const title = document.getElementById('postTitle').value.trim();
  const slug = document.getElementById('postSlug').value.trim();
  const excerpt = document.getElementById('postExcerpt').value.trim();
  const featuredImage = document.getElementById('postImage').value.trim();
  const author = document.getElementById('postAuthor').value.trim();
  
  // Collect multiple category selections (from checkboxes)
  const categoryList = document.getElementById('categoryList');
  const categoryIds = Array.from(categoryList.querySelectorAll('input[type="checkbox"]:checked'))
    .map(cb => parseInt(cb.value));

  const status = document.querySelector('.status-option.active')?.dataset.status || 'draft';

  if (!title) {
    showToast('Title is required', 'error');
    return;
  }

  const content = window.editor ? window.editor.getHTML() : '';
  const shareFacebook = document.getElementById('shareFacebook')?.checked;
  const shareInstagram = document.getElementById('shareInstagram')?.checked;

  const postData = {
    title,
    slug: slug || undefined,
    content,
    excerpt,
    featured_image: featuredImage,
    author: author || 'Online Pati',
    status,
    category_ids: categoryIds,
    show_image: !!document.getElementById('postShowImage')?.checked,
    share_fb: shareFacebook,
    share_ig: shareInstagram
  };

  try {
    if (postId) {
      await apiPut(`/posts/admin/${postId}`, postData);
      showToast('Post updated successfully!', 'success');
    } else {
      const data = await apiPost('/posts/admin', postData);
      showToast('Post created successfully!', 'success');
      if (data && data.id) {
        window.history.replaceState({}, '', `posts.html?edit=${data.id}`);
        document.getElementById('postId').value = data.id;
        document.getElementById('postSlug').value = data.slug;
        const deleteBtn = document.getElementById('btnDeletePostEditor');
        if (deleteBtn) deleteBtn.style.display = 'inline-flex';
      }
    }
  } catch (err) {
    showToast('Failed to save: ' + err.message, 'error');
  }
}

// ─── Slug Automation ──────────────────────────────────────────

function generateSlugFromTitle(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    // Support Nepali Unicode + Latin Alphanumeric
    .replace(/[^\u0900-\u097F\u0966-\u096Fa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

let slugManuallyEdited = false;

function initSlugAutomation() {
  const titleInput = document.getElementById('postTitle');
  const slugInput = document.getElementById('postSlug');
  
  if (!titleInput || !slugInput) return;

  titleInput.addEventListener('input', () => {
    if (!slugManuallyEdited) {
      slugInput.value = generateSlugFromTitle(titleInput.value);
    }
  });

  slugInput.addEventListener('input', () => {
    slugManuallyEdited = true;
  });
}

// ─── Helpers ────────────────────────────────────────────────

function setPostStatus(status) {
  document.querySelectorAll('.status-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
}

function updateImagePreview(url) {
  const wrapper = document.getElementById('imagePreview');
  if (!wrapper) return;
  
  if (url) {
    wrapper.innerHTML = `<img src="${escapeHtml(url)}" alt="Featured Image" />`;
  } else {
    wrapper.innerHTML = `
      <div class="image-placeholder">
        <i class="fas fa-image"></i>
        <span>Enter Featured Image URL</span>
      </div>`;
  }
}

// ─── Load Categories Checkboxes ───────────────────────────

async function loadCategoryOptions() {
  const container = document.getElementById('categoryList');
  if (!container) return;

  try {
    const categories = await apiGet('/categories');
    if (!categories) return;
    
    container.innerHTML = categories.map(cat => `
      <label class="category-item">
        <input type="checkbox" value="${cat.id}">
        <span>${escapeHtml(cat.name)}</span>
      </label>
    `).join('');
  } catch (err) {
    console.error('Failed to load categories:', err);
    container.innerHTML = '<p style="color:var(--danger); padding:10px;">Failed to load categories</p>';
  }
}

// ─── Init Post Filters ─────────────────────────────────────

function initPostFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadPosts(btn.dataset.status || '');
    });
  });
}

// ─── Media Picker Logic ──────────────────────────────────────

let mediaPickerTarget = null; // 'editor' or 'featured'
let selectedMediaUrl = null;
let pickerMediaList = [];

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
    pickerMediaList = await apiGet('/media');
    
    if (!pickerMediaList.length) {
      grid.innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted)">No media found. Upload something new.</p>';
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
  
  if (mediaPickerTarget === 'featured') {
    const input = document.getElementById('postImage');
    if (input) {
      input.value = selectedMediaUrl;
      updateImagePreview(selectedMediaUrl);
    }
  } else if (mediaPickerTarget === 'editor') {
    if (window.editor) {
      window.editor.chain().focus().setImage({ src: selectedMediaUrl }).run();
    }
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
    const res = await apiPost('/media/upload', formData, true);
    showToast('Upload successful!', 'success');
    refreshMediaPicker();
  } catch (e) {
    showToast('Upload failed', 'error');
  }
};
