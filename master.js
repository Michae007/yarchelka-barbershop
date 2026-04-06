document.addEventListener('DOMContentLoaded', function() {
    const savedPass = localStorage.getItem('masterAuth');
    if (savedPass !== MASTER_PASSWORD) {
        const enteredPass = prompt('Введите пароль для доступа к панели мастера:');
        if (enteredPass === MASTER_PASSWORD) {
            localStorage.setItem('masterAuth', enteredPass);
        } else {
            alert('Неверный пароль!');
            window.location.href = 'index.html';
            return;
        }
    }

    // Элементы DOM
    const tabLinks = document.querySelectorAll('.master-nav a[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    const appointmentsTable = document.querySelector('#appointmentsTable tbody');
    const clientsTable = document.querySelector('#clientsTable tbody');
    const filterDate = document.getElementById('filterDate');
    const filterStatus = document.getElementById('filterStatus');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchClient = document.getElementById('searchClient');
    const addClientBtn = document.getElementById('addClientBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const statusIndicator = document.getElementById('statusIndicator');
    const workStartInput = document.getElementById('workStart');
    const workEndInput = document.getElementById('workEnd');
    const slotDurationInput = document.getElementById('slotDuration');
    const priceInput = document.getElementById('price');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const settingsMessage = document.getElementById('settingsMessage');
    const modal = document.getElementById('clientModal');
    const modalClientName = document.getElementById('modalClientName');
    const modalClientPhone = document.getElementById('modalClientPhone');
    const modalHaircutCount = document.getElementById('modalHaircutCount');
    const modalRemaining = document.getElementById('modalRemaining');
    const addHaircutBtn = document.getElementById('addHaircutBtn');
    const resetCounterBtn = document.getElementById('resetCounterBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    let selectedClientId = null;

    async function ensureSettings() {
        let { data: settings, error } = await supabaseClient
            .from('master_settings')
            .select('*')
            .maybeSingle();
        if (error) return null;
        if (!settings) {
            const { data: newSettings, error: insertError } = await supabaseClient
                .from('master_settings')
                .insert([{ work_start: '10:00', work_end: '19:00', slot_duration: 30, price: 600 }])
                .select()
                .single();
            if (insertError) return null;
            settings = newSettings;
        }
        return settings;
    }

    async function loadAppointments() {
        appointmentsTable.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
        let query = supabaseClient.from('appointments').select('*').order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
        if (filterDate.value) query = query.eq('appointment_date', filterDate.value);
        if (filterStatus.value) query = query.eq('status', filterStatus.value);

        const { data: appointments, error: appsError } = await query;
        if (appsError) { appointmentsTable.innerHTML = '<tr><td colspan="7">Ошибка загрузки</td></tr>'; return; }
        if (!appointments.length) { appointmentsTable.innerHTML = '<tr><td colspan="7">Нет записей</td></tr>'; return; }

        const clientIds = [...new Set(appointments.map(a => a.client_id))];
        const { data: clients, error: clientsError } = await supabaseClient.from('clients').select('id, name, phone, haircut_count').in('id', clientIds);
        if (clientsError) { appointmentsTable.innerHTML = '<tr><td colspan="7">Ошибка загрузки клиентов</td></tr>'; return; }

        const clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
        appointmentsTable.innerHTML = '';
        appointments.forEach(app => {
            const client = clientsMap[app.client_id] || { name: 'Неизвестно', phone: '', haircut_count: 0 };
            const row = appointmentsTable.insertRow();
            row.innerHTML = `
                <td>${formatDate(app.appointment_date)}</td>
                <td>${app.appointment_time}</td>
                <td>${escapeHtml(client.name)}</td>
                <td>${escapeHtml(client.phone)}</td>
                <td>${client.haircut_count}</td>
                <td><span class="status-badge status-${app.status}">${getStatusText(app.status)}</span></td>
                <td class="actions">
                    ${app.status === 'active' ? `<button class="btn-small btn-complete" data-id="${app.id}" data-action="complete"><i class="fas fa-check"></i></button>
                    <button class="btn-small btn-cancel" data-id="${app.id}" data-action="cancel"><i class="fas fa-times"></i></button>` : ''}
                    <button class="btn-small btn-delete" data-id="${app.id}" data-action="delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
        document.querySelectorAll('#appointmentsTable button').forEach(btn => btn.addEventListener('click', handleAppointmentAction));
        updateStatusIndicator();
    }

    async function handleAppointmentAction(e) {
        const btn = e.currentTarget;
        const id = parseInt(btn.getAttribute('data-id'));
        const action = btn.getAttribute('data-action');
        if (!id) return;
        if (action === 'complete') await supabaseClient.from('appointments').update({ status: 'completed' }).eq('id', id);
        else if (action === 'cancel') await supabaseClient.from('appointments').update({ status: 'cancelled' }).eq('id', id);
        else if (action === 'delete' && confirm('Удалить запись?')) await supabaseClient.from('appointments').delete().eq('id', id);
        loadAppointments();
    }

    async function loadClients() {
        clientsTable.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        let query = supabaseClient.from('clients').select('*').order('name', { ascending: true });
        if (searchClient.value) {
            const term = `%${searchClient.value}%`;
            query = query.or(`name.ilike.${term},phone.ilike.${term}`);
        }
        const { data, error } = await query;
        if (error) { clientsTable.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>'; return; }
        if (data.length === 0) { clientsTable.innerHTML = '<tr><td colspan="6">Клиенты не найдены</td></tr>'; return; }
        clientsTable.innerHTML = '';
        data.forEach(client => {
            const remaining = 6 - (client.haircut_count % 6);
            const row = clientsTable.insertRow();
            row.innerHTML = `
                <td>${escapeHtml(client.name)}</td>
                <td>${escapeHtml(client.phone)}</td>
                <td>${client.haircut_count}</td>
                <td><strong>${remaining}</strong> до бесплатной</td>
                <td>${client.notes || '-'}</td>
                <td>
                    <button class="btn-small btn-complete" data-client='${JSON.stringify(client)}'><i class="fas fa-edit"></i> Акция</button>
                    <button class="btn-small btn-delete" data-id="${client.id}" data-action="deleteClient"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
        document.querySelectorAll('#clientsTable .btn-complete').forEach(btn => btn.addEventListener('click', (e) => {
            const client = JSON.parse(e.currentTarget.getAttribute('data-client'));
            openClientModal(client.id, client.name, client.phone, client.haircut_count);
        }));
        document.querySelectorAll('#clientsTable .btn-delete').forEach(btn => btn.addEventListener('click', async (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            if (confirm('Удалить клиента и все его записи?')) {
                await supabaseClient.from('appointments').delete().eq('client_id', id);
                await supabaseClient.from('clients').delete().eq('id', id);
                loadClients();
                loadAppointments();
            }
        }));
    }

    function openClientModal(id, name, phone, count) {
        selectedClientId = id;
        modalClientName.textContent = name;
        modalClientPhone.textContent = phone;
        modalHaircutCount.textContent = count;
        modalRemaining.textContent = 6 - (count % 6);
        modal.style.display = 'flex';
    }

    async function loadSettings() {
        const settings = await ensureSettings();
        if (settings) {
            workStartInput.value = settings.work_start;
            workEndInput.value = settings.work_end;
            slotDurationInput.value = settings.slot_duration;
            priceInput.value = settings.price;
        }
    }

    saveSettingsBtn.addEventListener('click', async () => {
        const settings = await ensureSettings();
        if (!settings) { showSettingsMessage('Не удалось загрузить настройки', 'error'); return; }
        const { error } = await supabaseClient.from('master_settings').update({
            work_start: workStartInput.value,
            work_end: workEndInput.value,
            slot_duration: parseInt(slotDurationInput.value),
            price: parseInt(priceInput.value)
        }).eq('id', settings.id);
        if (error) showSettingsMessage('Ошибка сохранения: ' + error.message, 'error');
        else showSettingsMessage('Настройки сохранены!', 'success');
    });

    addHaircutBtn.addEventListener('click', async () => {
        if (!selectedClientId) return;
        const { data: client, error } = await supabaseClient.from('clients').select('haircut_count').eq('id', selectedClientId).single();
        if (error) { alert('Ошибка: ' + error.message); return; }
        const newCount = client.haircut_count + 1;
        const { error: updateError } = await supabaseClient.from('clients').update({ haircut_count: newCount }).eq('id', selectedClientId);
        if (updateError) alert('Ошибка: ' + updateError.message);
        else {
            modalHaircutCount.textContent = newCount;
            modalRemaining.textContent = 6 - (newCount % 6);
            loadClients();
            loadAppointments();
        }
    });

    resetCounterBtn.addEventListener('click', async () => {
        if (!selectedClientId) return;
        if (confirm('Сбросить счетчик стрижек на 0?')) {
            const { error } = await supabaseClient.from('clients').update({ haircut_count: 0 }).eq('id', selectedClientId);
            if (error) alert('Ошибка: ' + error.message);
            else {
                modalHaircutCount.textContent = 0;
                modalRemaining.textContent = 6;
                loadClients();
                loadAppointments();
            }
        }
    });

    closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; selectedClientId = null; });

    function formatDate(dateStr) { return new Date(dateStr).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }); }
    function getStatusText(status) { return { active: 'Активна', completed: 'Завершена', cancelled: 'Отменена' }[status] || status; }
    function updateStatusIndicator() {
        const now = new Date();
        const hours = now.getHours();
        const isWorking = hours >= 10 && hours < 19 && now.getDay() !== 0;
        statusIndicator.textContent = isWorking ? 'Работаю' : 'Не работаю';
        statusIndicator.style.color = isWorking ? '#4caf50' : '#ff9800';
    }
    function showSettingsMessage(text, type) {
        settingsMessage.textContent = text;
        settingsMessage.className = `message ${type}`;
        setTimeout(() => settingsMessage.className = 'message', 3000);
    }
    function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m])); }
    function debounce(func, wait) { let timeout; return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }

    tabLinks.forEach(link => link.addEventListener('click', (e) => {
        e.preventDefault();
        const tabId = link.getAttribute('data-tab');
        tabLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) content.classList.add('active');
        });
        if (tabId === 'appointments') loadAppointments();
        if (tabId === 'clients') loadClients();
        if (tabId === 'settings') loadSettings();
    }));

    filterDate.addEventListener('change', loadAppointments);
    filterStatus.addEventListener('change', loadAppointments);
    refreshBtn.addEventListener('click', loadAppointments);
    searchClient.addEventListener('input', debounce(loadClients, 300));
    logoutBtn.addEventListener('click', () => { localStorage.removeItem('masterAuth'); window.location.href = 'index.html'; });
    if (addClientBtn) {
        addClientBtn.addEventListener('click', async () => {
            const name = prompt('Введите имя клиента:'); if (!name) return;
            const phone = prompt('Введите телефон:'); if (!phone) return;
            await supabaseClient.from('clients').insert([{ name, phone, haircut_count: 0 }]);
            loadClients();
        });
    }

    loadAppointments();
    updateStatusIndicator();
    setInterval(updateStatusIndicator, 60000);
});
         
           
   
