import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');
    const regBtn = document.getElementById('regBtn');
    const regMessage = document.getElementById('regMessage');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Kunci butang elak spam
            regBtn.disabled = true;
            regBtn.textContent = 'Registering...';

            const email = regEmail.value.trim();
            const password = regPassword.value;

            // Hantar data ke Supabase
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
            });

            if (error) {
                alert('Pendaftaran Gagal: ' + error.message);
                regBtn.disabled = false;
                regBtn.textContent = 'Register Account';
            } else {
                // Berjaya didaftarkan
                registerForm.style.display = 'none';
                regMessage.style.display = 'block';
                regMessage.innerHTML = `Pendaftaran berjaya!<br><br>Sila semak peti masuk (inbox/spam) e-mel <b>${email}</b> untuk pautan pengesahan akaun sebelum anda boleh login.`;
            }
        });
    }
});
