import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Semak jika user belum login, tendang balik ke login.html
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = '../pages/login.html';
        return; // Hentikan script dari terus berjalan
    }

    // 2. Paparkan email user di topbar
    const userEmailSpan = document.getElementById('userEmail');
    if (userEmailSpan) {
        userEmailSpan.textContent = session.user.email;
    }

    // 3. Fungsi Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            // Disable button
            logoutBtn.disabled = true;
            logoutBtn.textContent = 'Logging out...';

            // Clear session di Supabase
            await supabase.auth.signOut();
            
            // Redirect ke login
            window.location.href = '../pages/login.html';
        });
    }
});
