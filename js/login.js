import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Tarik tetapan gambar (Logo & Background) dari jadual 'settings'
    const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('logo_url, bg_url')
        .limit(1)
        .single();

    // Tukar gambar jika data wujud di pangkalan data
    if (settingsData) {
        if (settingsData.logo_url) {
            document.getElementById('companyLogo').src = settingsData.logo_url;
        }
        if (settingsData.bg_url) {
            document.getElementById('loginBg').style.backgroundImage = `url('${settingsData.bg_url}')`;
        }
    }

    // 2. Semak jika pengguna sudah login, hantar terus ke dashboard
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }

    // 3. Fungsi Log Masuk (Authentication)
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Elak halaman dari ter-refresh (reload)
        
        loginBtn.textContent = 'Signing in...';
        loginBtn.disabled = true;
        errorMessage.style.display = 'none';

        // Hantar e-mel dan password ke Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

        if (error) {
            // Jika salah password / e-mel tiada
            errorMessage.textContent = 'Invalid email or password. Please try again.';
            errorMessage.style.display = 'block';
            loginBtn.textContent = 'Sign In';
            loginBtn.disabled = false;
        } else {
            // Semak status kelulusan HR di jadual employees
            const userId = data.user.id;
            const { data: empData } = await supabase
                .from('employees')
                .select('status')
                .eq('id', userId)
                .single();

            // Sekat jika akaun masih PENDING
            if (empData && empData.status === 'PENDING') {
                await supabase.auth.signOut();
                errorMessage.textContent = 'Akses Ditolak: Akaun anda masih PENDING kelulusan Admin/HR.';
                errorMessage.style.display = 'block';
                loginBtn.textContent = 'Sign In';
                loginBtn.disabled = false;
                return;
            }

            // Jika ACTIVE, terus masuk ke Dashboard
            window.location.href = 'dashboard.html';
        }
    });
});
