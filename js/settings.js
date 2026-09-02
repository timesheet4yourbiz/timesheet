import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    // Auth Check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return window.location.href = '../pages/login.html';
    
    document.getElementById('userEmail').textContent = session.user.email;
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = '../pages/login.html';
    });

    const logoInput = document.getElementById('logoUrl');
    const bgInput = document.getElementById('bgUrl');
    const saveBtn = document.getElementById('saveSettingsBtn');
    let settingsId = null;

    // 1. Tarik data sedia ada
    const { data, error } = await supabase.from('settings').select('*').limit(1).single();
    if (data) {
        settingsId = data.id;
        logoInput.value = data.logo_url || '';
        bgInput.value = data.bg_url || '';
    }

    // 2. Simpan Data
    saveBtn.addEventListener('click', async () => {
        saveBtn.textContent = 'SAVING...';
        saveBtn.disabled = true;

        const { error: updateError } = await supabase.from('settings')
            .update({ 
                logo_url: logoInput.value.trim(), 
                bg_url: bgInput.value.trim() 
            })
            .eq('id', settingsId);

        if (updateError) {
            alert('Error saving settings!');
            console.error(updateError);
        } else {
            alert('Settings saved successfully!');
        }

        saveBtn.textContent = 'SAVE SETTINGS';
        saveBtn.disabled = false;
    });
});
