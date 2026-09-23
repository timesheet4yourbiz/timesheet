import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Perisai Pintar: Cari elemen dengan ID atau fallback ke input jenis teks pertama
            const regName = document.getElementById('regName') || registerForm.querySelector('input[type="text"]');
            const regEmail = document.getElementById('regEmail') || registerForm.querySelector('input[type="email"]');
            const regPassword = document.getElementById('regPassword') || registerForm.querySelector('input[type="password"]');
            const regBtn = document.getElementById('regBtn') || registerForm.querySelector('button[type="submit"]');
            const regMessage = document.getElementById('regMessage');

            // Hentikan pendaftaran jika input nama tiada atau kosong
            if (!regName || !regName.value.trim()) {
                alert("Sila masukkan Nama Penuh anda. (Pastikan input HTML mempunyai id='regName')");
                return;
            }

            const fullName = regName.value.trim();
            const email = regEmail.value.trim();
            const password = regPassword.value;

            if (regBtn) {
                regBtn.disabled = true;
                regBtn.textContent = 'Registering...';
            }

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
                if (regBtn) {
                    regBtn.disabled = false;
                    regBtn.textContent = 'Register Account';
                }
                return; 
            } 
            
            // 2. Wajib: Masukkan data nama terus ke table employees
            if (authData && authData.user) {
                const payload = {
                    id: authData.user.id,
                    name: fullName,      // <-- Nama sebenar disalurkan terus ke sini!
                    email: email,
                    system_role: 'Employee',
                    status: 'PENDING',
                    billable_rate: 0
                };

                const { error: dbError } = await supabase.from('employees').upsert([payload]);
                if (dbError) console.error("Ralat pangkalan data:", dbError);
            }

            // 3. Log Keluar & Tunjuk Mesej
            await supabase.auth.signOut(); 
            registerForm.style.display = 'none';
            if (regMessage) {
                regMessage.style.display = 'block';
                regMessage.innerHTML = `Pendaftaran berjaya!<br><br>Akaun anda kini berstatus <b>PENDING</b>. Sila tunggu pengesahan daripada Admin sebelum anda log masuk.`;
            }
        });
    }
});
