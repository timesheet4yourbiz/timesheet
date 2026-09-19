import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Muatkan Sidebar
    loadSidebar();

    // Semak Auth (Log Masuk)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    // Papar E-mel Pengguna
    const userEmailEl = document.getElementById('userEmail');
    if (userEmailEl) userEmailEl.textContent = session.user.email;
    
    // Fungsi Log Keluar
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            supabase.auth.signOut().then(() => {
                window.location.href = '../pages/login.html';
            });
        });
    }

    // Fungsi tarikh dinamik dan penyimpanan jadual Timesheet akan ditambah di sini kelak
});
