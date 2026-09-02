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
                // [KOD BARU] Tendang keluar (Sign Out) serta-merta untuk elak auto-login
                await supabase.auth.signOut(); 

                registerForm.style.display = 'none';
                regMessage.style.display = 'block';
                regMessage.innerHTML = `Pendaftaran berjaya!<br><br>Akaun anda kini berstatus <b>PENDING</b>. Sila tunggu pengesahan dan kelulusan daripada Admin/HR sebelum anda boleh log masuk ke dalam sistem.`;
            }
        });
    }
});
