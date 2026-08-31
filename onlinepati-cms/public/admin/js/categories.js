/**
 * Online Pati News CMS — Category Management
 * Handles category listing, creation, editing, and deletion
 */

let editingCategoryId = null;

// ─── Load Categories ────────────────────────────────────────

async function loadCategories() {
  const listEl = document.getElementById('categoryList');
  if (!listEl) return;

  listEl.innerHTML = '<div class="loading-spinner"></div>';

  try {
    const categories = await apiGet('/categories');
    
    if (!categories || !categories.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-folder-open"></i>
          <h3>No categories found</h3>
          <p>Create a new category using the form on the left</p>
        </div>`;
      return;
    }

    listEl.innerHTML = categories.map(cat => `
      <div class="category-item" data-id="${cat.id}">
        <div class="category-info">
          <div class="category-icon"><i class="fas fa-tag"></i></div>
          <div>
            <div class="category-name">${escapeHtml(cat.name)}</div>
            <div class="category-slug">/${escapeHtml(cat.slug)}</div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="category-count">${cat.count || 0} posts</span>
          <div class="action-group">
            <button class="btn btn-ghost btn-icon" onclick="editCategory(${cat.id}, '${escapeAttr(cat.name)}', '${escapeAttr(cat.slug)}', '${escapeAttr(cat.description || '')}')" title="Edit">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-danger btn-icon" onclick="deleteCategory(${cat.id}, '${escapeAttr(cat.name)}')" title="Delete">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Save Category (Create or Update) ──────────────────────

async function saveCategory(e) {
  e.preventDefault();

  const name = document.getElementById('catName').value.trim();
  const slug = document.getElementById('catSlug').value.trim();
  const description = document.getElementById('catDescription').value.trim();

  if (!name) {
    showToast('Category name is required', 'error');
    return;
  }

  const data = {
    name,
    slug: slug || undefined,
    description
  };

  try {
    if (editingCategoryId) {
      await apiPut(`/categories/admin/${editingCategoryId}`, data);
      showToast('Category updated successfully!', 'success');
    } else {
      await apiPost('/categories/admin', data);
      showToast('Category created successfully!', 'success');
    }

    // Reset form
    resetCategoryForm();
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Edit Category ──────────────────────────────────────────

function editCategory(id, name, slug, description) {
  editingCategoryId = id;
  document.getElementById('catName').value = name;
  document.getElementById('catSlug').value = slug;
  document.getElementById('catDescription').value = description;
  
  document.getElementById('catFormTitle').textContent = 'Edit Category';
  document.getElementById('catSubmitBtn').innerHTML = '<i class="fas fa-save"></i> Update Category';
  
  // Show cancel button
  const cancelBtn = document.getElementById('catCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';
  
  // Scroll to form
  document.getElementById('catName').focus();
}

// ─── Delete Category ────────────────────────────────────────

async function deleteCategory(id, name) {
  const confirmed = await showConfirm(
    'Delete Category?',
    `Are you sure you want to delete the "${name}" category? Posts in this category will become uncategorized.`
  );

  if (!confirmed) return;

  try {
    await apiDelete(`/categories/admin/${id}`);
    showToast('Category deleted', 'success');
    
    if (editingCategoryId === id) {
      resetCategoryForm();
    }
    
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Reset Form ─────────────────────────────────────────────

function resetCategoryForm() {
  editingCategoryId = null;
  document.getElementById('catName').value = '';
  document.getElementById('catSlug').value = '';
  document.getElementById('catDescription').value = '';
  document.getElementById('catFormTitle').textContent = 'New Category';
  document.getElementById('catSubmitBtn').innerHTML = '<i class="fas fa-plus"></i> Save Category';
  
  const cancelBtn = document.getElementById('catCancelBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ─── Helpers ────────────────────────────────────────────────

function escapeAttr(text) {
  if (!text) return '';
  return text.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}
