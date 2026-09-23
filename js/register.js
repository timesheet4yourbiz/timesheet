import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    
    // Tarik elemen input. Anggap bos guna id="regName" untuk input Nama Penuh
    const regName = document.getElementById('regName') || document.querySelector('input[type="text"]');
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

            // Dapatkan nilai dari borang
            const fullName = regName ? regName.value.trim() : 'Unknown Name';
            const email = regEmail.value.trim();
            const password = regPassword.value;

            // 1. Daftarkan akaun ke Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: { full_name: fullName } 
                }
            });

            if (authError) {
                alert('Pendaftaran Gagal: ' + authError.message);
                regBtn.disabled = false;
                regBtn.textContent = 'Register Account';
                return; // Berhenti di sini jika gagal
            } 
            
            // 2. Simpan profil lengkap (Nama & Emel) ke dalam jadual 'employees'
            if (authData && authData.user) {
                const payload = {
                    id: authData.user.id,
                    name: fullName,      // <-- PENTING: Data nama dimasukkan di sini
                    email: email,
                    system_role: 'Employee',
                    status: 'PENDING',
                    billable_rate: 0
                };

                const { error: dbError } = await supabase.from('employees').upsert([payload]);
                
                if (dbError) {
                    console.error('Ralat simpan ke profil pekerja:', dbError);
                }
            }

            // 3. Tendang keluar (Sign Out) serta-merta untuk elak auto-login
            await supabase.auth.signOut(); 

            registerForm.style.display = 'none';
            regMessage.style.display = 'block';
            regMessage.innerHTML = `Pendaftaran berjaya!<br><br>Akaun anda kini berstatus <b>PENDING</b>. Sila tunggu pengesahan dan kelulusan daripada Admin/HR sebelum anda boleh log masuk ke dalam sistem.`;
        });
    }
});
