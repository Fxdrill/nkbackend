// Admin Dashboard JavaScript

let currentSection = 'products';
let products = [];
let courses = [];
let editingId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupNavigation();
    setupEventListeners();
    loadData();
});

// Check authentication
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/admin-login.html';
            return;
        }
    } catch (err) {
        window.location.href = '/admin-login.html';
    }
}

// Setup navigation
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const section = item.dataset.section;
            
            // Update active nav item
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Show corresponding section
            document.querySelectorAll('.section-content').forEach(sec => sec.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
            
            currentSection = section;
        });
    });
}

// Setup event listeners
function setupEventListeners() {
    // Logout button
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/admin-login.html';
        } catch (err) {
            showToast('Logout failed', 'error');
        }
    });

    // Image preview
    document.getElementById('itemImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('imagePreview').innerHTML = `
                    <img src="${e.target.result}" alt="Preview">
                `;
            };
            reader.readAsDataURL(file);
        }
    });

    // Close modal on overlay click
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closeModal();
        }
    });
}

// Load data from API
async function loadData() {
    try {
        // Load products
        const productsResponse = await fetch('/api/products');
        products = await productsResponse.json();
        renderProducts();

        // Load courses
        const coursesResponse = await fetch('/api/courses');
        courses = await coursesResponse.json();
        renderCourses();
    } catch (err) {
        showToast('Failed to load data', 'error');
    }
}

// Render products table
function renderProducts() {
    const tbody = document.getElementById('productsTable');
    const emptyState = document.getElementById('productsEmpty');
    
    if (products.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = products.map(product => `
        <tr>
            <td>
                <img src="${product.image || '/uploads/placeholder.jpg'}" 
                     alt="${product.title}" 
                     class="item-image"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22><rect fill=%22%23eee%22 width=%2260%22 height=%2240%22/><text fill=%22%23999%22 font-size=%2210%22 x=%2250%22 y=%2225%22 text-anchor=%22middle%22>No Image</text></svg>'">
            </td>
            <td><strong>${escapeHtml(product.title)}</strong></td>
            <td>${escapeHtml(product.price || 'N/A')}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit-btn" onclick="editItem('product', '${product.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteItem('product', '${product.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Render courses table
function renderCourses() {
    const tbody = document.getElementById('coursesTable');
    const emptyState = document.getElementById('coursesEmpty');
    
    if (courses.length === 0) {
        tbody.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }
    
    emptyState.style.display = 'none';
    tbody.innerHTML = courses.map(course => `
        <tr>
            <td>
                <img src="${course.image || '/uploads/placeholder.jpg'}" 
                     alt="${course.title}" 
                     class="item-image"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2260%22 height=%2240%22><rect fill=%22%23eee%22 width=%2260%22 height=%2240%22/><text fill=%22%23999%22 font-size=%2210%22 x=%2250%22 y=%2225%22 text-anchor=%22middle%22>No Image</text></svg>'">
            </td>
            <td><strong>${escapeHtml(course.title)}</strong></td>
            <td>${escapeHtml(course.date)}</td>
            <td>
                <div class="action-btns">
                    <button class="action-btn edit-btn" onclick="editItem('course', '${course.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteItem('course', '${course.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Open modal for adding/editing
function openModal(type, id = null) {
    editingId = id;
    const modal = document.getElementById('modalOverlay');
    const title = document.getElementById('modalTitle');
    const priceGroup = document.getElementById('priceGroup');
    const contentGroup = document.getElementById('contentGroup');
    const itemType = document.getElementById('itemType');
    
    document.getElementById('itemForm').reset();
    document.getElementById('imagePreview').innerHTML = '';
    document.getElementById('itemId').value = '';
    
    if (type === 'product') {
        title.textContent = id ? 'Edit Product' : 'Add New Product';
        priceGroup.style.display = 'block';
        contentGroup.style.display = 'none';
        itemType.value = 'product';
        
        if (id) {
            const product = products.find(p => p.id === id);
            if (product) {
                document.getElementById('itemId').value = product.id;
                document.getElementById('itemTitle').value = product.title;
                document.getElementById('itemPrice').value = product.price || '';
                document.getElementById('itemDescription').value = product.description || '';
                
                if (product.image) {
                    document.getElementById('imagePreview').innerHTML = `
                        <img src="${product.image}" alt="Current image">
                    `;
                }
            }
        }
    } else {
        title.textContent = id ? 'Edit Course' : 'Add New Course';
        priceGroup.style.display = 'none';
        contentGroup.style.display = 'block';
        itemType.value = 'course';
        
        if (id) {
            const course = courses.find(c => c.id === id);
            if (course) {
                document.getElementById('itemId').value = course.id;
                document.getElementById('itemTitle').value = course.title;
                document.getElementById('itemDescription').value = course.description || '';
                document.getElementById('itemContent').value = course.content || '';
                
                if (course.image) {
                    document.getElementById('imagePreview').innerHTML = `
                        <img src="${course.image}" alt="Current image">
                    `;
                }
            }
        }
    }
    
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
    editingId = null;
}

// Edit item
function editItem(type, id) {
    openModal(type, id);
}

// Delete item
async function deleteItem(type, id) {
    const item = type === 'product' 
        ? products.find(p => p.id === id)
        : courses.find(c => c.id === id);
    
    const confirmDelete = confirm(`Are you sure you want to delete "${item?.title}"?`);
    
    if (!confirmDelete) return;
    
    try {
        const response = await fetch(`/api/${type}s/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${type === 'product' ? 'Product' : 'Course'} deleted successfully`, 'success');
            loadData(); // Reload data
        } else {
            showToast(data.error || 'Failed to delete', 'error');
        }
    } catch (err) {
        showToast('Failed to delete item', 'error');
    }
}

// Save item
async function saveItem() {
    const type = document.getElementById('itemType').value;
    const id = document.getElementById('itemId').value;
    const title = document.getElementById('itemTitle').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const imageFile = document.getElementById('itemImage').files[0];
    
    // Validation
    if (!title || !description) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const saveBtn = document.getElementById('saveBtn');
    const btnText = saveBtn.querySelector('.btn-text');
    btnText.innerHTML = '<span class="loading-spinner"></span> Saving...';
    saveBtn.disabled = true;
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    
    if (type === 'product') {
        formData.append('price', document.getElementById('itemPrice').value.trim());
    } else {
        formData.append('content', document.getElementById('itemContent').value.trim());
        formData.append('date', new Date().toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        }));
        formData.append('comments', 0);
    }
    
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const url = id ? `/api/${type}s/${id}` : `/api/${type}s`;
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`${type === 'product' ? 'Product' : 'Course'} ${id ? 'updated' : 'added'} successfully`, 'success');
            closeModal();
            loadData(); // Reload data
        } else {
            showToast(data.error || 'Failed to save', 'error');
        }
    } catch (err) {
        showToast('Failed to save item', 'error');
    } finally {
        btnText.textContent = 'Save';
        saveBtn.disabled = false;
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
