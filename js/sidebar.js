import { supabase } from './supabase.js';

export async function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    
    if (!container) {
        console.error("Sidebar container not found!");
        return;
    }

    let userName = "User";
    let userRole = "Employee";
    let avatarUrl = "https://ui-avatars.com/api/?name=User&background=e0f2fe&color=0284c7";

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            const { data: profile } = await supabase
                .from('employees')
                .select('name, system_role, avatar_url')
                .eq('id', session.user.id)
                .single();

            if (profile) {
                userName = profile.name || session.user.email.split('@')[0];
                userRole = profile.system_role || 'Employee';
                avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=e0f2fe&color=0284c7`;
            }
        }
    } catch (err) {
        console.error("Error loading profile for sidebar:", err);
    }

    const currentPath = window.location.pathname;
    
    const sidebarHTML = `
        <aside class="sidebar" style="width: 250px; background: white; height: 100%; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column;">
            
            <!-- PROFIL COMEL (SEBELAH-MENYEBELAH) -->
            <div class="sidebar-header" style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; gap: 12px;">
                <img src="${avatarUrl}" alt="Profile" onclick="showMiniAvatar('${avatarUrl}')" style="width: 42px; height: 42px; min-width: 42px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;">
                <div style="overflow: hidden;">
                    <div style="font-size: 0.88rem; font-weight: 700; color: #0f172a; text-transform: capitalize; white-space: normal; line-height: 1.2; margin-bottom: 3px;">${userName}</div>
                    <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; display: inline-block;">${userRole}</span>
                </div>
            </div>

            <!-- CSS KHAS MENU (ELAK UPPERCASE) -->
            <style>
                .sidebar-link {
                    display: block;
                    padding: 8px 20px;
                    color: #475569;
                    text-decoration: none;
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    text-transform: none !important;
                }
                .sidebar-link:hover {
                    background: #f1f5f9;
                    color: #0ea5e9;
                }
                .sidebar-link.active {
                    color: #0ea5e9;
                    font-weight: 600;
                    background: #f0f9ff;
                    border-left: 3px solid #0ea5e9;
                }
                .sidebar-category {
                    padding: 0 20px; 
                    font-size: 0.68rem; 
                    font-weight: 700; 
                    color: #94a3b8; 
                    margin: 14px 0 6px 0; 
                    text-transform: uppercase; 
                    letter-spacing: 0.5px;
                }
            </style>
            
            <!-- SENARAI MENU LENGKAP -->
            <nav class="sidebar-nav" style="padding: 8px 0; flex: 1; overflow-y: auto;">
                <div class="sidebar-category">ANALYZE</div>
                <a href="dashboard.html" class="sidebar-link ${currentPath.includes('dashboard.html') ? 'active' : ''}">DASHBOARD</a>
                <a href="tracker.html" class="sidebar-link ${currentPath.includes('time-tracker.html') ? 'active' : ''}">TIME TRACKER</a>
                <a href="timesheet.html" class="sidebar-link ${currentPath.includes('timesheet.html') ? 'active' : ''}">TIMESHEET</a>
                <a href="reports.html" class="sidebar-link ${currentPath.includes('reports.html') ? 'active' : ''}">REPORTS</a>
                
                <div class="sidebar-category">MANAGE</div>
                <a href="projects.html" class="sidebar-link ${currentPath.includes('projects.html') ? 'active' : ''}">PROJECTS</a>
                <a href="tags.html" class="sidebar-link ${currentPath.includes('tags.html') ? 'active' : ''}">TAGS</a>
                <a href="employees.html" class="sidebar-link ${currentPath.includes('employees.html') ? 'active' : ''}">EMPLOYEES</a>
                <a href="clients.html" class="sidebar-link ${currentPath.includes('clients.html') ? 'active' : ''}">CLIENTS</a>
                
                <div class="sidebar-category">OTHERS</div>
                <a href="attendance.html" class="sidebar-link ${currentPath.includes('attendance.html') ? 'active' : ''}">ATTENDANCE</a>
                <a href="approvals.html" class="sidebar-link ${currentPath.includes('approvals.html') ? 'active' : ''}">APPROVALS</a>
                <a href="departments.html" class="sidebar-link ${currentPath.includes('departments.html') ? 'active' : ''}">DEPARTMENTS</a>
                <a href="profile.html" class="sidebar-link ${currentPath.includes('profile.html') ? 'active' : ''}">MY PROFILE</a>
                <a href="settings.html" class="sidebar-link ${currentPath.includes('settings.html') ? 'active' : ''}">SETTINGS</a>
            </nav>

            <div class="sidebar-footer" style="padding: 16px 20px; border-top: 1px solid #e2e8f0;">
                <button id="logoutBtn" style="width: 100%; padding: 8px; background: transparent; border: 1px solid #cbd5e1; border-radius: 4px; color: #475569; font-weight: 600; cursor: pointer; transition: 0.2s;">Logout</button>
            </div>
        </aside>
    `;

    container.innerHTML = sidebarHTML;

    // Logika Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '../pages/login.html';
        });
    }

    // Fungsi Pop-up Gambar Simple
    window.showMiniAvatar = function(url) {
        let modal = document.getElementById('miniAvatarModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'miniAvatarModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:1000;';
            modal.onclick = () => modal.style.display = 'none';
            
            const img = document.createElement('img');
            img.src = url;
            img.style.cssText = 'position:absolute; top:70px; left:20px; width:120px; height:160px; object-fit:cover; border-radius:6px; border:3px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.2);';
            
            modal.appendChild(img);
            document.body.appendChild(modal);
        } else {
            modal.querySelector('img').src = url;
            modal.style.display = 'block';
        }
    };
}
