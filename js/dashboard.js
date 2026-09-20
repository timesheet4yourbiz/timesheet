import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. Muatkan Sidebar
        loadSidebar();

        // 2. Semak Sesi Log Masuk (Auth)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = '../pages/login.html';
            return;
        }

        // 3. (Pilihan) Muatkan profil pengguna jika ada elemen userEmail di Dashboard
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // Hilangkan status "Loading..." jika ada
        console.log("Enjin Dashboard berjaya dimuatkan!");

    } catch (error) {
        console.error("Ralat memuatkan Dashboard:", error);
    }
});
