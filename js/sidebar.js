import { supabase } from './supabase.js';

export async function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const currentPath = window.location.pathname;

    // Semak ingatan (Local Storage) jika pengguna pernah tutup mata
    const isCollapsed = localStorage.getItem('sidebarState') === 'collapsed';
    if (isCollapsed) {
        document.body.classList.add('sidebar-collapsed');
    }

    // --- RBAC: AMBIL DATA PENGGUNA DARI SUPABASE ---
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const email = session.user.email;

    // Menarik data mengikut nama lajur 'system_role' di Supabase
    const { data: emp } = await supabase
        .from('employees')
        .select('name, system_role')
        .eq('email', email)
        .maybeSingle();

    // Semak role tanpa mengira huruf besar/kecil ('Admin', 'admin', 'ADMIN')
    const roleText = (emp && emp.system_role) ? emp.system_role.toLowerCase() : 'employee';
    const isAdmin = roleText === 'admin';
    const nameStr = (emp && emp.name) ? emp.name : email.split('@')[0];

    // Sembunyikan menu 'EMPLOYEES' sepenuhnya jika BUKAN Admin
    const employeesMenuHTML = isAdmin ? `
                <a href="employees.html" class="nav-item ${currentPath.includes('employees.html') ? 'active' : ''}" title="EMPLOYEES">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    <span class="hide-on-collapse">EMPLOYEES</span>
                </a>
    ` : '';

    const sidebarHTML = `
        <aside class="sidebar">
            <div class="sidebar-header" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <div class="hide-on-collapse">
                        <h2 style="line-height: 1.2;">WORKTIME</h2>
                        <span style="font-size: 0.55rem; color: #64748b; letter-spacing: 0.5px;">TIME MANAGEMENT SYSTEM</span>
                    </div>
                </div>

                <button id="toggleSidebarBtn" style="background:none; border:none; color:#64748b; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; margin-left: 10px;" title="Toggle Sidebar">
                    <svg class="eye-open" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    <svg class="eye-closed" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                </button>
            </div>

            <div class="sidebar-profile">
                <div class="avatar" id="sidebarInitials" style="flex-shrink:0;">--</div>
                <div class="sidebar-profile-info hide-on-collapse">
                    <span class="sidebar-profile-name" id="sidebarName">Loading...</span>
                    <!-- Status dan Paparan Pangkat -->
                    <span class="sidebar-profile-role" id="sidebarRole" style="${isAdmin ? 'color:#0ea5e9;' : 'color:#34d399;'}">
                        ${isAdmin ? 'ADMIN' : 'STAFF'}
                    </span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section-title hide-on-collapse">ANALYZE</div>
                <a href="tracker.html" class="nav-item ${currentPath.includes('tracker.html') ? 'active' : ''}" title="TIME CLOCK">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span class="hide-on-collapse">TIME TRACKER</span>
                </a>
                <a href="timesheet.html" class="nav-item ${currentPath.includes('timesheet.html') ? 'active' : ''}" title="TIMESHEET">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span class="hide-on-collapse">TIMESHEET</span>
                </a>
                <a href="dashboard.html" class="nav-item ${currentPath.includes('dashboard.html') ? 'active' : ''}" title="DASHBOARD">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                    <span class="hide-on-collapse">OVERVIEW</span>
                </a>
                <a href="reports.html" class="nav-item ${currentPath.includes('reports.html') ? 'active' : ''}" title="REPORTS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    <span class="hide-on-collapse">REPORTS</span>
                </a>

                <div class="nav-section-title hide-on-collapse">MANAGE</div>
                <a href="projects.html" class="nav-item ${currentPath.includes('projects.html') ? 'active' : ''}" title="PROJECTS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span class="hide-on-collapse">PROJECTS</span>
                </a>
                <a href="tags.html" class="nav-item ${currentPath.includes('tags.html') ? 'active' : ''}" title="TAGS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    <span class="hide-on-collapse">TAGS</span>
                </a>

                <!-- MENU EMPLOYEES HANYA DIPAPARKAN JIKA ADMIN -->
                ${employeesMenuHTML}

                <a href="clients.html" class="nav-item ${currentPath.includes('clients.html') ? 'active' : ''}" title="CLIENTS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    <span class="hide-on-collapse">CLIENTS</span>
                </a>

                <div class="nav-section-title hide-on-collapse">WORKFORCE</div>
                <a href="attendance.html" class="nav-item ${currentPath.includes('attendance.html') ? 'active' : ''}" title="ATTENDANCE">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    <span class="hide-on-collapse">ATTENDANCE</span>
                </a>
                <a href="approvals.html" class="nav-item ${currentPath.includes('approvals.html') ? 'active' : ''}" title="APPROVALS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>
                    <span class="hide-on-collapse">APPROVALS</span>
                </a>

                <div class="nav-section-title hide-on-collapse">ACCOUNT</div>
                <a href="profile.html" class="nav-item ${currentPath.includes('profile.html') ? 'active' : ''}" title="MY PROFILE">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span class="hide-on-collapse">MY PROFILE</span>
                </a>
                <a href="settings.html" class="nav-item ${currentPath.includes('settings.html') ? 'active' : ''}" title="SETTINGS">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    <span class="hide-on-collapse">SETTINGS</span>
                </a>
            </nav>

            <div class="sidebar-footer">
                <button id="logoutBtn" class="btn-logout" title="LOGOUT">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    <span class="hide-on-collapse">LOGOUT</span>
                </button>
            </div>
        </aside>
    `;

    container.innerHTML = sidebarHTML;

    // --- RENDER PROFIL & INISIAL PADA SIDEBAR ---
    const nameEl = document.getElementById('sidebarName');
    const initEl = document.getElementById('sidebarInitials');
    if (nameEl) nameEl.textContent = nameStr.toUpperCase();
    if (initEl) {
        const parts = nameStr.split(/[\s.@]+/);
        let init = parts[0].charAt(0).toUpperCase();
        if (parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
        initEl.textContent = init;
    }

    // --- LOGIK TOGGLE BUTANG MATA ---
    const toggleBtn = document.getElementById('toggleSidebarBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const collapsed = document.body.classList.toggle('sidebar-collapsed');
            localStorage.setItem('sidebarState', collapsed ? 'collapsed' : 'expanded');
        });
    }

    // --- LOGIK LOGOUT ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    // --- SIMPAN STATUS KELAYAKAN PADA GLOBAL WINDOW ---
    window.currentUserIsAdmin = isAdmin;
}
