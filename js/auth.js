import { supabase } from './supabase.js';
import { loadSidebar } from './sidebar.js';
document.addEventListener('DOMContentLoaded', async () => {
loadSidebar(); 
    
    const loginForm = document.getElementById('loginForm');
    
    // 1. Session Checking - Jika sudah login, bawa ke dashboard
    checkSession();

    // 2. Handle Login Form Submit
    if(loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginBtn = document.getElementById('loginBtn');
            const errorMsg = document.getElementById('errorMessage');

            // Reset error state & tunjukkan loading (Double click protection)
            errorMsg.style.display = 'none';
            errorMsg.textContent = '';
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';

            try {
                // Panggil Supabase Auth
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) {
                    throw error;
                }

                // Berjaya login, redirect ke dashboard
                window.location.href = '../pages/dashboard.html';
                
            } catch (error) {
                // Error handling mesra pengguna
                console.error("Login error:", error.message);
                errorMsg.textContent = "Login failed. Please check your email and password.";
                errorMsg.style.display = 'block';
                
                // Restore button state
                loginBtn.disabled = false;
                loginBtn.textContent = 'Login';
            }
        });
    }
});

// Fungsi semak session aktif
async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Jika ada session dan kita berada di halaman login, redirect
    if (session && window.location.pathname.includes('login.html')) {
        window.location.href = '../pages/dashboard.html';
    }
}
