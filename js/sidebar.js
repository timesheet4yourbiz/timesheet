import { supabase } from './supabase.js';

export async function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    
    // Pastikan container ada (untuk mencegah error console yang bos alami)
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
                // Jika tidak ada gambar, gunakan inisial nama secara otomatis
                avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=e0f2fe&color=0284c7`;
            }
        }
    } catch (err) {
        console.error("Error loading profile for sidebar:", err);
    }

    const currentPath = window.location.pathname;
    
    const sidebarHTML = `
        <aside class="sidebar" style="width: 250px; background: white; height: 100vh; position: fixed; left: 0; top: 0; border-right: 1px solid #e2e8f0; display: flex; flex-direction: column; z-index: 100;">
            
            <!-- PROFIL MINI DI ATAS -->
            <div class="sidebar-header" style="padding: 24px 20px; text-align: center; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
                <img src="${avatarUrl}" alt="Profile" onclick="showEnlargedAvatar('${avatarUrl}')" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 3px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.1); cursor: pointer; transition: 0.2s; margin-bottom: 12px;">
                <h3 style="margin: 0 0 4px 0; font-size: 1rem; color: #0f172a; text-transform: capitalize;">${userName}</h3>
                <span style="background: #e0f2fe; color: #0284c7; padding: 3px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">${userRole}</span>
            </div>

            <!-- MENU NAVIGASI -->
            <nav class="sidebar-nav" style="padding: 20px 0; flex: 1; overflow-y: auto;">
                <div style="padding: 0 20px; font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Analyze</div>
                <a href="dashboard.html" class="nav-item ${currentPath.includes('dashboard.html') ? 'active' : ''}">Dashboard</a>
                <a href="#" class="nav-item">Time Tracker</a>
                <a href="#" class="nav-item">Timesheet</a>
                
                <div style="padding: 0 20px; font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Manage</div>
                <a href="employees.html" class="nav-item ${currentPath.includes('employees.html') ? 'active' : ''}">Team</a>
                <a href="#" class="nav-item">Projects</a>
                
                <div style="padding: 0 20px; font-size: 0.7rem; font-weight: 700; color: #94a3b8; margin: 20px 0 10px 0; text-transform: uppercase; letter-spacing: 0.5px;">Others</div>
                <a href="profile.html" class="nav-item ${currentPath.includes('profile.html') ? 'active' : ''}">My Profile</a>
                <a href="settings.html" class="nav-item ${currentPath.includes('settings.html') ? 'active' : ''}">Settings</a>
            </nav>

            <div class="sidebar-footer" style="padding: 20px; border-top: 1px solid #e2e8f0;">
                <button id="logoutBtn" style="width: 100%; padding: 10px; background: transparent; border: 1px solid #cbd5e1; border-radius: 4px; color: #475569; font-weight: 600; cursor: pointer;">Logout</button>
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

    // Fungsi Pop-up Gambar (Ukuran Paspor)
    window.showEnlargedAvatar = function(url) {
        let modal = document.getElementById('avatarModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'avatarModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000;';
            modal.onclick = () => modal.style.display = 'none';
            
            const img = document.createElement('img');
            img.src = url;
            // Ukuran paspor membesar saat diklik
            img.style.cssText = 'width: 150px; height: 200px; object-fit: cover; border-radius: 8px; border: 4px solid white; box-shadow: 0 10px 25px rgba(0,0,0,0.5);';
            
            modal.appendChild(img);
            document.body.appendChild(modal);
        } else {
            modal.querySelector('img').src = url;
            modal.style.display = 'flex';
        }
    };
}
