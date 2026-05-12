const API_URL = 'http://localhost:8080/api';
let isLoginMode = true;
let currentProjectId = null;
let allUsers = [];
let selectedAuthRole = 'ROLE_U';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('token')) {
        applyRoleUI();
    } else {
        showPage('portal');
    }
});

function applyRoleUI() {
    const role = localStorage.getItem('role') || 'ROLE_U';

    // Toggle Nav Links based on role
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = role === 'ROLE_A' ? 'block' : 'none');
    document.querySelectorAll('.user-only').forEach(el => el.style.display = role === 'ROLE_U' ? 'block' : 'none');
    
    if (role === 'ROLE_A') {
        showPage('dashboard');
        fetchUsers(); // Pre-fetch users for task assignment dropdown
    } else {
        showPage('kanban');
    }
}

// Navigation
function showPage(pageId) {
    document.querySelectorAll('.page-view').forEach(p => p.style.display = 'none');
    
    if(pageId === 'portal') {
        document.getElementById('portal-page').style.display = 'flex';
        document.getElementById('navbar').style.display = 'none';
    } else if(pageId === 'auth') {
        document.getElementById('auth-page').style.display = 'flex';
        document.getElementById('navbar').style.display = 'none';
    } else {
        document.getElementById(`${pageId}-page`).style.display = 'block';
        document.getElementById('navbar').style.display = 'block';
        
        if(pageId === 'dashboard') loadDashboard();
        if(pageId === 'projects') loadProjects();
        if(pageId === 'users') loadUsers();
        if(pageId === 'kanban') loadKanban();
    }
}

function openAuth(role) {
    selectedAuthRole = role;
    showPage('auth');
    
    // Customize Auth Form UI based on role
    const iconClass = role === 'ROLE_A' ? 'bi-shield-lock text-danger' : 'bi-person-workspace text-primary';
    const roleName = role === 'ROLE_A' ? 'Admin' : 'Employee';
    
    document.getElementById('auth-icon').className = `bi ${iconClass}`;
    document.getElementById('auth-title').innerText = `${roleName} Login`;
    document.getElementById('auth-subtitle').innerText = `Login to your ${roleName} Portal`;
    document.getElementById('role').value = role; // Set hidden input
    
    isLoginMode = true; // reset to login
    updateAuthBtnUI();
    
    // CLEAR THE FORM WHEN SWITCHING PORTALS
    document.getElementById('auth-form').reset();
}

// Auth Logic
function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    const roleName = selectedAuthRole === 'ROLE_A' ? 'Admin' : 'User';
    
    document.getElementById('auth-title').innerText = isLoginMode ? `${roleName} Login` : `Register as ${roleName}`;
    document.getElementById('auth-subtitle').innerText = isLoginMode ? `Login to your ${roleName} Portal` : `Create a new ${roleName} account`;
    document.getElementById('auth-toggle').innerText = isLoginMode ? `New ${roleName}? Register Account` : 'Already have an account? Login';
    
    updateAuthBtnUI();
}

function updateAuthBtnUI() {
    document.getElementById('auth-btn').innerHTML = isLoginMode ? 'Login <i class="bi bi-arrow-right ms-1"></i>' : 'Register <i class="bi bi-person-plus ms-1"></i>';
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    const body = isLoginMode ? { username, password } : { username, password, role };

    try {
        const btn = document.getElementById('auth-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Please wait...';
        btn.disabled = true;

        const res = await fetch(API_URL + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        btn.innerHTML = originalText;
        btn.disabled = false;

        if (res.ok) {
            if (isLoginMode) {
                const data = await res.json();
                
                // Security check - don't let user login via admin portal and vice versa
                if (data.role !== selectedAuthRole) {
                    alert(`Access Denied! You are trying to login as ${selectedAuthRole} but your account role is ${data.role}. Please use the correct portal.`);
                    return;
                }
                
                localStorage.setItem('token', data.token);
                localStorage.setItem('username', data.username);
                localStorage.setItem('role', data.role);
                localStorage.setItem('userId', data.userId);
                applyRoleUI();
            } else {
                alert('Registration successful! Please login.');
                toggleAuthMode(); // switch back to login mode
            }
        } else {
            const err = await res.text();
            alert('Error: ' + err);
        }
    } catch (err) {
        alert('Server error. Is the Spring Boot backend running?');
    }
}

function logout() {
    localStorage.clear();
    showPage('portal');
}

// Fetch Helper
async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('token');
    if (!token) return logout();

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const res = await fetch(API_URL + endpoint, config);
    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error('Unauthorized');
    }
    return res;
}

// --- ADMIN FEATURES --- //

async function loadDashboard() {
    try {
        const res = await apiCall('/projects/dashboard');
        const stats = await res.json();
        
        animateValue('stat-projects', 0, stats.totalProjects, 1000);
        animateValue('stat-tasks', 0, stats.totalTasks, 1000);
        animateValue('stat-completed', 0, stats.completedTasks, 1000);
    } catch (e) { console.error(e); }
}

function animateValue(id, start, end, duration) {
    if (start === end) {
        document.getElementById(id).innerHTML = end;
        return;
    }
    let range = end - start;
    let current = start;
    let increment = end > start ? 1 : -1;
    let stepTime = Math.abs(Math.floor(duration / range));
    let obj = document.getElementById(id);
    let timer = setInterval(function() {
        current += increment;
        obj.innerHTML = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}

// Users Page
async function fetchUsers() {
    try {
        const res = await apiCall('/auth/users');
        allUsers = await res.json();
        
        // Populate assign dropdown in task modal
        const assignSelect = document.getElementById('task-assignee');
        if(assignSelect) {
            assignSelect.innerHTML = '<option value="">-- Unassigned --</option>';
            allUsers.filter(u => u.role === 'ROLE_U').forEach(u => {
                assignSelect.innerHTML += `<option value="${u.id}">${u.username}</option>`;
            });
        }
    } catch (e) { console.error(e); }
}

async function loadUsers() {
    await fetchUsers();
    const list = document.getElementById('users-list-table');
    list.innerHTML = '';
    
    allUsers.forEach(u => {
        const roleText = u.role === 'ROLE_A' ? 'Admin' : 'User';
        const roleBadge = u.role === 'ROLE_A' ? 'bg-danger' : 'bg-primary';
        const dateText = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '<span class="text-muted fst-italic">Older</span>';

        const deleteBtn = u.role === 'ROLE_A' ? 
            `<button class="btn btn-sm btn-light text-muted" disabled title="Cannot delete Admins"><i class="bi bi-trash"></i></button>` :
            `<button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id})" title="Delete User"><i class="bi bi-trash"></i></button>`;

        list.innerHTML += `
            <tr>
                <td>#${u.id}</td>
                <td class="fw-semibold">${u.username}</td>
                <td><span class="badge ${roleBadge}">${roleText}</span></td>
                <td>${dateText}</td>
                <td class="text-end">${deleteBtn}</td>
            </tr>
        `;
    });
}

async function deleteUser(id) {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    try {
        const res = await apiCall(`/auth/users/${id}`, 'DELETE');
        if (res.ok) {
            loadUsers(); // Refresh list after deletion
        } else {
            const data = await res.json();
            alert('Error: ' + (data.error || 'Failed to delete user'));
        }
    } catch (e) {
        console.error(e);
        alert('Failed to delete user due to a server error.');
    }
}

async function createUser(e) {
    e.preventDefault();
    const username = document.getElementById('new-username').value;
    const password = document.getElementById('new-password').value;
    const role = document.getElementById('new-role').value; // ROLE_A or ROLE_U

    try {
        const res = await fetch(API_URL + '/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });

        if (res.ok) {
            alert(`✅ User created successfully!\n\nShare these details with the user:\nUsername: ${username}\nPassword: ${password}`);
            const modal = bootstrap.Modal.getInstance(document.getElementById('userModal'));
            if(modal) modal.hide();
            document.getElementById('user-form').reset();
            loadUsers();
        } else {
            const err = await res.text();
            alert('Error: ' + err);
        }
    } catch (e) {
        alert('Error creating user');
    }
}

// Projects
async function loadProjects() {
    try {
        const res = await apiCall('/projects');
        const projects = await res.json();
        const list = document.getElementById('projects-list');
        list.innerHTML = '';
        
        if (projects.length === 0) {
            list.innerHTML = `<div class="col-12 text-center py-5"><h5 class="text-muted">No projects found. Click 'New Project'</h5></div>`;
            return;
        }

        projects.forEach(p => {
            const dateObj = new Date(p.deadline);
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            list.innerHTML += `
                <div class="col-md-6 col-lg-4 mb-3">
                    <div class="project-card d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <h5 class="card-title mb-0">${p.name}</h5>
                            <button class="btn btn-sm text-danger border-0 p-0" onclick="deleteProject(${p.id})">
                                <i class="bi bi-trash3 fs-5"></i>
                            </button>
                        </div>
                        <div class="card-subtitle text-primary mb-3">
                            <i class="bi bi-calendar-event me-1"></i> Due: ${formattedDate}
                        </div>
                        <p class="card-text flex-grow-1">${p.description}</p>
                        <div class="mt-4 pt-3 border-top">
                            <button class="btn btn-custom-outline w-100" onclick="openTasks(${p.id}, '${p.name}')">
                                <i class="bi bi-list-check me-1"></i> Manage Tasks
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (e) { console.error(e); }
}

async function createProject(e) {
    e.preventDefault();
    const project = {
        name: document.getElementById('proj-name').value,
        description: document.getElementById('proj-desc').value,
        deadline: document.getElementById('proj-deadline').value
    };

    try {
        await apiCall('/projects', 'POST', project);
        bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
        document.getElementById('project-form').reset();
        loadProjects();
    } catch (e) { alert('Error creating project'); }
}

async function deleteProject(id) {
    if(confirm('Delete this project?')) {
        await apiCall(`/projects/${id}`, 'DELETE');
        loadProjects();
    }
}

// Tasks for Admin
function openTasks(projectId, projectName) {
    currentProjectId = projectId;
    document.getElementById('task-project-title').innerHTML = `${projectName} <span class="text-muted fw-normal fs-5">/ Tasks</span>`;
    showPage('tasks');
    loadTasks();
}

async function loadTasks() {
    if (!currentProjectId) return;
    try {
        const res = await apiCall(`/tasks/project/${currentProjectId}`);
        const tasks = await res.json();
        const list = document.getElementById('tasks-list');
        list.innerHTML = '';
        
        if (tasks.length === 0) {
            list.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No tasks assigned yet.</td></tr>`;
            return;
        }

        tasks.forEach(t => {
            const badgeClass = t.status === 'Completed' ? 'bg-success' : (t.status === 'In Progress' ? 'bg-primary' : 'bg-warning');
            const assigneeName = t.assignedUser ? t.assignedUser.username : '<span class="text-muted fst-italic">Unassigned</span>';
            const dateObj = new Date(t.dueDate);
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            list.innerHTML += `
                <tr>
                    <td class="fw-semibold">${t.title}</td>
                    <td>${t.description}</td>
                    <td><i class="bi bi-calendar2 me-1 text-muted"></i> ${formattedDate}</td>
                    <td><i class="bi bi-person me-1"></i> ${assigneeName}</td>
                    <td><span class="badge ${badgeClass}">${t.status}</span></td>
                    <td class="text-end">
                        <button class="btn btn-action btn-outline-danger" onclick="deleteTask(${t.id})">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `;
        });
    } catch (e) { console.error(e); }
}

async function createTask(e) {
    e.preventDefault();
    if (!currentProjectId) return;

    const assigneeId = document.getElementById('task-assignee').value;
    const task = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-desc').value,
        dueDate: document.getElementById('task-date').value,
        status: document.getElementById('task-status').value,
        assignedUser: assigneeId ? { id: parseInt(assigneeId) } : null
    };

    try {
        await apiCall(`/tasks/project/${currentProjectId}`, 'POST', task);
        bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
        document.getElementById('task-form').reset();
        loadTasks();
    } catch (e) { alert('Error creating task'); }
}

async function deleteTask(id) {
    if(confirm('Delete this task?')) {
        await apiCall(`/tasks/${id}`, 'DELETE');
        loadTasks();
    }
}

// --- USER FEATURES (KANBAN) --- //

let userTasksData = [];

async function loadKanban() {
    try {
        const userId = localStorage.getItem('userId');
        const res = await apiCall(`/tasks/user/${userId}`);
        const tasks = await res.json();
        userTasksData = tasks;
        
        const total = tasks.length;
        const progress = tasks.filter(t => t.status === 'In Progress').length;
        const completed = tasks.filter(t => t.status === 'Completed').length;
        
        animateValue('user-stat-total', 0, total, 1000);
        animateValue('user-stat-progress', 0, progress, 1000);
        animateValue('user-stat-completed', 0, completed, 1000);
        
        // Clear columns
        document.getElementById('zone-Pending').innerHTML = '';
        document.getElementById('zone-In Progress').innerHTML = '';
        document.getElementById('zone-Completed').innerHTML = '';
        
        tasks.forEach(t => {
            const dateObj = new Date(t.dueDate);
            const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            const descPreview = t.description.length > 40 ? t.description.substring(0, 40) + '...' : t.description;
            
            const cardHTML = `
                <div class="kanban-card position-relative" id="task-${t.id}" draggable="true" ondragstart="drag(event, ${t.id})" data-status="${t.status}">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="fw-bold mb-0 pe-4 text-truncate">${t.title}</h6>
                        <button class="btn btn-sm text-primary p-0 position-absolute top-0 end-0 m-2" onclick="viewTaskDetails(${t.id})" title="View Details">
                            <i class="bi bi-arrows-angle-expand fs-5"></i>
                        </button>
                    </div>
                    <p class="text-muted small mb-3" style="min-height: 40px;">${descPreview}</p>
                    <div class="d-flex justify-content-between align-items-center border-top pt-2">
                        <span class="badge bg-light text-dark border"><i class="bi bi-calendar2 me-1"></i>${formattedDate}</span>
                    </div>
                </div>
            `;
            
            const zone = document.getElementById(`zone-${t.status}`);
            if(zone) zone.innerHTML += cardHTML;
        });
        
    } catch (e) { console.error(e); }
}

function viewTaskDetails(taskId) {
    const task = userTasksData.find(t => t.id === taskId);
    if(!task) return;
    
    document.getElementById('detail-task-title').innerText = task.title;
    document.getElementById('detail-task-desc').innerText = task.description;
    
    const dateObj = new Date(task.dueDate);
    document.getElementById('detail-task-date').innerHTML = `<i class="bi bi-calendar2 me-1"></i> ${dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    
    const badge = document.getElementById('detail-task-status');
    badge.innerText = task.status;
    badge.className = 'badge mb-2 fs-6 text-white ' + (task.status === 'Completed' ? 'bg-success' : (task.status === 'In Progress' ? 'bg-primary' : 'bg-warning text-dark'));

    new bootstrap.Modal(document.getElementById('taskDetailsModal')).show();
}

// Drag and Drop Logic
function drag(ev, taskId) {
    ev.dataTransfer.setData("taskId", taskId);
}

function allowDrop(ev) {
    ev.preventDefault();
    ev.currentTarget.classList.add('drag-over');
}

document.querySelectorAll('.kanban-dropzone').forEach(zone => {
    zone.addEventListener('dragleave', function() {
        this.classList.remove('drag-over');
    });
});

async function drop(ev, newStatus) {
    ev.preventDefault();
    const zone = ev.currentTarget;
    zone.classList.remove('drag-over');
    
    const taskId = ev.dataTransfer.getData("taskId");
    const card = document.getElementById(`task-${taskId}`);
    
    if(!card) return;

    // Optimistic UI update
    card.setAttribute('data-status', newStatus);
    zone.appendChild(card);
    
    try {
        await apiCall(`/tasks/${taskId}/status`, 'PUT', { status: newStatus });
        loadKanban();
    } catch (e) {
        alert('Failed to update status');
        loadKanban(); // revert if failed
    }
}
