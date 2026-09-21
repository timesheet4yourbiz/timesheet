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
        <aside class="sidebar" style="width: 250px; background: white; height: 100vh; position: fixed; left: 0; top: 0; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; z-index: 100;">
            
            <!-- PROFIL COMEL (SEBELAH-MENYEBELAH) -->
            <div class="sidebar-header" style="padding: 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; display: flex; align-items: center; gap: 12px;">
                <img src="${avatarUrl}" alt="Profile" onclick="showMiniAvatar('${avatarUrl}')" style="width: 45px; height: 45px; min-width: 45px; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;">
                <div style="overflow: hidden;">
                    <div style="font-size: 0.9rem; font-weight: 700; color: #0f172a; text-transform: capitalize; white-space: normal; line-height: 1.2; margin-bottom: 4px;">${userName}</div>
                    <span style="background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: 600; display: inline-block;">${userRole}</span>
                </div>
            </div>

            <!-- MENU NAVIGASI (Dengan Gaya CSS Khas) -->
            <style>
                .sidebar-link {
                    display: block;
                    padding: 10px 20px;
                    color: #475569;
                    text-decoration: none;
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                    text-transform: none; /* MEMASTIKAN IA TIDAK MENJADI HURUF BESAR */
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
                    font-size: 0.7rem; 
                    font-weight: 700; 
                    color: #94a3b8; 
                    margin: 20px 0 10px 0; 
                    text-transform: uppercase; 
                    letter-spacing: 0.5px;
                }
            </style>
            
            <nav class="sidebar-nav" style="padding: 10px 0; flex: 1; overflow-y: auto;">
                <div class="sidebar-category" style="margin-top: 10px;">Analyze</div>
                <a href="dashboard.html" class="sidebar-link ${currentPath.includes('dashboard.html') ? 'active' : ''}">Dashboard</a>
                <a href="#" class="sidebar-link">Time Tracker</a>
                <a href="#" class="sidebar-link">Timesheet</a>
                
                <div class="sidebar-category">Manage</div>
                <a href="employees.html" class="sidebar-link ${currentPath.includes('employees.html') ? 'active' : ''}">Team</a>
                <a href="#" class="sidebar-link">Projects</a>
                
                <div class="sidebar-category">Others</div>
                <a href="profile.html" class="sidebar-link ${currentPath.includes('profile.html') ? 'active' : ''}">My Profile</a>
                <a href="settings.html" class="sidebar-link ${currentPath.includes('settings.html') ? 'active' : ''}">Settings</a>
            </nav>

            <div class="sidebar-footer" style="padding: 20px; border-top: 1px solid #e2e8f0;">
                <button id="logoutBtn" style="width: 100%; padding: 10px; background: transparent; border: 1px solid #cbd5e1; border-radius: 4px; color: #475569; font-weight: 600; cursor: pointer; transition: 0.2s;">Logout</button>
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

    // Fungsi Pop-up Gambar Simple (Tak ganggu 1 skrin)
    window.showMiniAvatar = function(url) {
        let modal = document.getElementById('miniAvatarModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'miniAvatarModal';
            // Transparent background, just to catch the click to close
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; z-index:1000;';
            modal.onclick = () => modal.style.display = 'none';
            
            const img = document.createElement('img');
            img.src = url;
            // Gambar saiz passport terapung dekat bucu atas kiri
            img.style.cssText = 'position:absolute; top:80px; left:20px; width:120px; height:160px; object-fit:cover; border-radius:6px; border:3px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.2);';
            
            modal.appendChild(img);
            document.body.appendChild(modal);
        } else {
            modal.querySelector('img').src = url;
            modal.style.display = 'block';
        }
    };
}
