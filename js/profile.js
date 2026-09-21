import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSidebar();
        
        // 1. Semak Log Masuk
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session) return window.location.href = '../pages/login.html';

        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) userEmailEl.textContent = session.user.email;

        // 2. Tarik Data Profil dari Database
        const { data: profile } = await supabase
            .from('employees')
            .select('name, email, system_role')
            .eq('id', session.user.id)
            .single();

        if (profile) {
            document.getElementById('profileEmail').textContent = profile.email || session.user.email;
            document.getElementById('profileName').textContent = profile.name || 'Not Set';
            document.getElementById('profileRole').textContent = profile.system_role || 'Employee';
        }

    } catch (err) {
        console.error("Profile Init Error:", err);
    }
});

// 3. Fungsi Tukar Password
document.getElementById('changePwdForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnUpdatePwd');
    const pwd1 = document.getElementById('newPwd').value;
    const pwd2 = document.getElementById('confirmPwd').value;

    if (pwd1 !== pwd2) return alert("Passwords do not match!");

    btn.textContent = "Updating...";
    btn.disabled = true;

    const { error } = await supabase.auth.updateUser({ password: pwd1 });

    btn.textContent = "UPDATE PASSWORD";
    btn.disabled = false;

    if (error) {
        alert("Failed: " + error.message);
    } else {
        alert("Success! Password updated.");
        document.getElementById('changePwdForm').reset();
    }
});
