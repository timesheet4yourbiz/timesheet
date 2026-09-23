import { supabase } from './supabase.js';

export function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    const currentPath = window.location.pathname;

    const sidebarHTML = `
        <aside class="sidebar">
            <div class="sidebar-header">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div>
                    <h2 style="line-height: 1.2;">WORKTIME</h2>
                    <span style="font-size: 0.55rem; color: #64748b; letter-spacing: 0.5px;">TIME MANAGEMENT SYSTEM</span>
                </div>
            </div>

            <div class="sidebar-profile">
                <div class="avatar" id="sidebarInitials">--</div>
                <div class="sidebar-profile-info">
                    <span class="sidebar-profile-name" id="sidebarName">Loading...</span>
                    <span class="sidebar-profile-role" id="sidebarRole">Online</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section-title">ANALYZE</div>
                <a href="tracker.html" class="nav-item ${currentPath.includes('tracker.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    TIME TRACKER
                </a>
                <a href="timesheet.html" class="nav-item ${currentPath.includes('timesheet.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    TIMESHEET
                </a>
                <a href="dashboard.html" class="nav-item ${currentPath.includes('dashboard.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                    DASHBOARD
                </a>
                <a href="reports.html" class="nav-item ${currentPath.includes('reports.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                    REPORTS
                </a>
                
                <div class="nav-section-title">MANAGE</div>
                <a href="projects.html" class="nav-item ${currentPath.includes('projects.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    PROJECTS
                </a>
                <a href="tags.html" class="nav-item ${currentPath.includes('tags.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                    TAGS
                </a>
                <a href="employees.html" class="nav-item ${currentPath.includes('employees.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    EMPLOYEES
                </a>
                <a href="clients.html" class="nav-item ${currentPath.includes('clients.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    CLIENTS
                </a>

                <div class="nav-section-title">WORKFORCE</div>
                <a href="attendance.html" class="nav-item ${currentPath.includes('attendance.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    ATTENDANCE
                </a>
                <a href="approvals.html" class="nav-item ${currentPath.includes('approvals.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><polyline points="9 15 11 17 15 13"></polyline></svg>
                    APPROVALS
                </a>

                <div class="nav-section-title">ACCOUNT</div>
                <a href="profile.html" class="nav-item ${currentPath.includes('profile.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    MY PROFILE
                </a>
                <a href="settings.html" class="nav-item ${currentPath.includes('settings.html') ? 'active' : ''}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    SETTINGS
                </a>
            </nav>

            <div class="sidebar-footer">
                <button id="logoutBtn" class="btn-logout">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                    LOGOUT
                </button>
            </div>
        </aside>
    `;

    container.innerHTML = sidebarHTML;

    // Logik Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    // Muat data profil ke Sidebar
    loadSidebarProfile();
}

async function loadSidebarProfile() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const email = session.user.email;
    const { data: emp } = await supabase.from('employees').select('name').eq('email', email).single();
    
    const nameStr = (emp && emp.name) ? emp.name : email.split('@')[0];
    
    const nameEl = document.getElementById('sidebarName');
    const initEl = document.getElementById('sidebarInitials');
    
    if (nameEl) nameEl.textContent = nameStr.toUpperCase();
    if (initEl) {
        const parts = nameStr.split(/[\s.@]+/);
        let init = parts[0].charAt(0).toUpperCase();
        if(parts.length > 1 && parts[1].length > 0) init += parts[1].charAt(0).toUpperCase();
        initEl.textContent = init;
    }
}
