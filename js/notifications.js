import { supabase } from './supabase.js';

export async function initNotificationBell() {
    const bellBtn = document.getElementById('notifBellBtn');
    const badge = document.getElementById('notifBadge');
    const dropdown = document.getElementById('notifDropdown');
    const notifList = document.getElementById('notifList');
    const markAllBtn = document.getElementById('markAllReadBtn');

    if (!bellBtn) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const email = session.user.email;
    const { data: emp } = await supabase.from('employees').select('id').eq('email', email).maybeSingle();
    if (!emp) return;

    const empId = emp.id;

    async function loadNotifications() {
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('employee_id', empId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) {
            console.error("Error loading notifications:", error);
            return;
        }

        const unreadCount = notifications.filter(n => !n.is_read).length;

        if (unreadCount > 0) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }

        if (!notifications || notifications.length === 0) {
            notifList.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 0.825rem;">No notifications yet</div>';
            return;
        }

        notifList.innerHTML = notifications.map(n => `
            <div class="notif-item" data-id="${n.id}" style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9; background: ${n.is_read ? '#ffffff' : '#f0f9ff'}; cursor: pointer;">
                <div style="font-weight: 600; font-size: 0.825rem; color: #0f172a; margin-bottom: 2px;">${n.title || 'Notification'}</div>
                <div style="font-size: 0.78rem; color: #475569; line-height: 1.3;">${n.message}</div>
                <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 4px;">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        `).join('');

        document.querySelectorAll('.notif-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                const notifId = e.currentTarget.getAttribute('data-id');
                await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
                loadNotifications();
            });
        });
    }

    bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.notification-wrapper')) {
            dropdown.style.display = 'none';
        }
    });

    if (markAllBtn) {
        markAllBtn.addEventListener('click', async () => {
            await supabase.from('notifications').update({ is_read: true }).eq('employee_id', empId).eq('is_read', false);
            loadNotifications();
        });
    }

    await loadNotifications();
}
