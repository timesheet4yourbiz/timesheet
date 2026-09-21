import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // KAWALAN KESELAMATAN: Semak Jawatan
        const { data: profile } = await supabase
            .from('employees')
            .select('system_role')
            .eq('id', session.user.id)
            .single();

        // JIKA BUKAN ADMIN, TENDANG KELUAR KE DASHBOARD
        if (!profile || profile.system_role !== 'Admin') {
            alert("Access Denied: You do not have permission to view System Settings.");
            window.location.href = 'dashboard.html';
            return;
        }

        document.getElementById('logoUrl').value = localStorage.getItem('worktime_logo') || '';
        document.getElementById('bgUrl').value = localStorage.getItem('worktime_bg') || '';

    } catch (err) {
        console.error("Settings Init Error:", err);
    }
});

// Fungsi Save Appearance Sahaja
const saveBtn = document.getElementById('saveSettingsBtn');
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        const logo = document.getElementById('logoUrl').value;
        const bg = document.getElementById('bgUrl').value;

        localStorage.setItem('worktime_logo', logo);
        localStorage.setItem('worktime_bg', bg);

        alert("Appearance settings saved successfully!");
    });
}
