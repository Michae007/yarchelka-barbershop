document.addEventListener('DOMContentLoaded', function() {
    // Проверка пароля
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
    const appointmentsTable = document.getElementById('appointmentsTable').getElementsByTagName('tbody')[0];
    const clientsTable = document.getElementById('clientsTable').getElementsByTagName('tbody')[0];
    const filterDate = document.getElementById('filterDate');
    const filterStatus = document.getElementById('filterStatus');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchClient = document.getElementById('searchClient');
    const addClientBtn = document.getElementById('addClientBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const statusIndicator = document.getElementById('statusIndicator');

    // Настройки
    const workStartInput = document.getElementById('workStart');
    const workEndInput = document.getElementById('workEnd');
    const slotDurationInput = document.getElementById('slotDuration');
    const priceInput = document.getElementById('price');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const settingsMessage = document.getElementById('settingsMessage');

    // Модальное окно
    const modal = document.getElementById('clientModal');
    const modalClientName = document.getElementById('modalClientName');
    const modalClientPhone = document.getElementById('modalClientPhone');
    const modalHaircutCount = document.getElementById('modalHaircutCount');
    const modalRemaining = document.getElementById('modalRemaining');
    const addHaircutBtn = document.getElementById('addHaircutBtn');
    const resetCounterBtn = document.getElementById('resetCounterBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');

    let selectedClientId = null;

    // ========== Вспомогательная функция: убедиться, что настройки существуют ==========
    async function ensureSettings() {
        let { data: settings, error } = await supabaseClient
            .from('master_settings')
            .select('*')
            .maybeSingle();

        if (error) {
            console.error('Ошибка загрузки настроек:', error);
            return null;
        }

        if (!settings) {
            console.log('Создаём настройки по умолчанию...');
            const { data: newSettings, error: insertError } = await supabaseClient
                .from('master_settings')
                .insert([{
                    work_start: '10:00',
                    work_end: '19:00',
                    slot_duration: 30,
                    price: 600
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Ошибка создания настроек:', insertError);
                return null;
            }
            settings = newSettings;
        }
        return settings;
    }

    // ========== Загрузка записей (исправлена: корректно обрабатывает клиентов) ==========
    async function loadAppointments() {
        appointmentsTable.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
        
        let query = supabaseClient
            .from('appointments')
            .select('*')
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        if (filterDate.value) query = query.eq('appointment_date', filterDate.value);
        if (filterStatus.value) query = query.eq('status', filterStatus.value);

        const { data: appointments, error: appsError } = await query;
        if (appsError) {
            console.error('Ошибка загрузки записей:', appsError);
            appointmentsTable.innerHTML = '<tr><td colspan="7">Ошибка загрузки</td></tr>';
            return;
        }

        if (!appointments.length) {
            appointmentsTable.innerHTML = '<tr><td colspan="7">Нет записей</td></tr>';
            return;
        }

        const clientIds = [...new Set(appointments.map(a => a.client_id))];
        const { data: clients, error: clientsError } = await supabaseClient
            .from('clients')
            .select('id, name, phone, haircut_count')
            .in('id', clientIds);

        if (clientsError) {
            console.error('Ошибка загрузки клиентов:', clientsError);
            appointmentsTable.innerHTML = '<tr><td colspan="7">Ошибка загрузки клиентов</td></tr>';
            return;
        }

        const clientsMap = Object.fromEntries(clients.map(c => [c.id, c]));
        appointmentsTable.innerHTML = '';

        appointments.forEach(app => {
            const client = clientsMap[app.client_id] || { name: 'Неизвестно', phone: '', haircut_count: 0 };
            const row = appointmentsTable.insertRow();
            row.innerHTML = `
                <td>${formatDate(app.appointment_date)}</td>
                <td>${app.appointment_time}</td>
                <td>${client.name}</td>
                <td>${client.phone}</td>
                <td>${client.haircut_count}</td>
                <td><span class="status-badge status-${app.status}">${getStatusText(app.status)}</span></td>
                <td class="actions">
                    ${app.status === 'active' ? `
                        <button class="btn-small btn-complete" data-id="${app.id}" data-action="complete"><i class="fas fa-check"></i></button>
                        <button class="btn-small btn-cancel" data-id="${app.id}" data-action="cancel"><i class="fas fa-times"></i></button>
                    ` : ''}
                    <button class="btn-small btn-delete" data-id="${app.id}" data-action="delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });

        // Навешиваем обработчики на кнопки (чтобы не использовать глобальные onclick)
        document.querySelectorAll('#appointmentsTable button').forEach(btn => {
            btn.removeEventListener('click', handleAppointmentAction);
            btn.addEventListener('click', handleAppointmentAction);
        });

        updateStatusIndicator();
    }

    async function handleAppointmentAction(e) {
        const btn = e.currentTarget;
        const id = parseInt(btn.getAttribute('data-id'));
        const action = btn.getAttribute('data-action');
        if (!id) return;

        if (action === 'complete') {
            await supabaseClient.from('appointments').update({ status: 'completed' }).eq('id', id);
            loadAppointments();
        } else if (action === 'cancel') {
            await supabaseClient.from('appointments').update({ status: 'cancelled' }).eq('id', id);
            loadAppointments();
        } else if (action === 'delete') {
            if (confirm('Удалить запись?')) {
                await supabaseClient.from('appointments').delete().eq('id', id);
                loadAppointments();
            }
        }
    }

    // ========== Загрузка клиентов ==========
    async function loadClients() {
        clientsTable.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        let query = supabaseClient.from('clients').select('*').order('name', { ascending: true });

        if (searchClient.value) {
            const term = `%${searchClient.value}%`;
            query = query.or(`name.ilike.${term},phone.ilike.${term}`);
        }

        const { data, error } = await query;
        if (error) {
            console.error(error);
            clientsTable.innerHTML = '<tr><td colspan="6">Ошибка загрузки</td></tr>';
            return;
        }

        clientsTable.innerHTML = '';
        if (data.length === 0) {
            clientsTable.innerHTML = '<tr><td colspan="6">Клиенты не найдены</td></tr>';
            return;
        }

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

        // Обработчики для кнопок клиентов
        document.querySelectorAll('#clientsTable .btn-complete').forEach(btn => {
            btn.removeEventListener('click', openClientModalFromBtn);
            btn.addEventListener('click', openClientModalFromBtn);
        });
        document.querySelectorAll('#clientsTable .btn-delete').forEach(btn => {
            btn.removeEventListener('click', deleteClientHandler);
            btn.addEventListener('click', deleteClientHandler);
        });
    }

    function openClientModalFromBtn(e) {
        const client = JSON.parse(e.currentTarget.getAttribute('data-client'));
        selectedClientId = client.id;
        modalClientName.textContent = client.name;
        modalClientPhone.textContent = client.phone;
        modalHaircutCount.textContent = client.haircut_count;
        modalRemaining.textContent = 6 - (client.haircut_count % 6);
        modal.style.display = 'flex';
    }

    async function deleteClientHandler(e) {
        const id = parseInt(e.currentTarget.getAttribute('data-id'));
        if (confirm('Удалить клиента и все его записи?')) {
            await supabaseClient.from('appointments').delete().eq('client_id', id);
            const { error } = await supabaseClient.from('clients').delete().eq('id', id);
            if (!error) {
                loadClients();
                loadAppointments();
            } else {
                alert('Ошибка: ' + error.message);
            }
        }
    }

    // ========== Загрузка и сохранение настроек ==========
    async function loadSettings() {
        const settings = await ensureSettings();
        if (settings) {
            workStartInput.value = settings.work_start;
            workEndInput.value = settings.work_end;
            slotDurationInput.value = settings.slot_duration;
            priceInput.value = settings.price;
        }
    }

    saveSettingsBtn.addEventListener('click', async function() {
        const settings = await ensureSettings();
        if (!settings) {
            showSettingsMessage('Не удалось загрузить настройки', 'error');
            return;
        }

        const { error } = await supabaseClient
            .from('master_settings')
            .update({
                work_start: workStartInput.value,
                work_end: workEndInput.value,
                slot_duration: parseInt(slotDurationInput.value),
                price: parseInt(priceInput.value)
            })
            .eq('id', settings.id);

        if (error) {
            showSettingsMessage('Ошибка сохранения: ' + error.message, 'error');
        } else {
            showSettingsMessage('Настройки успешно сохранены!', 'success');
        }
    });

    // ========== Работа с модальным окном (стрижки) ==========
    addHaircutBtn.addEventListener('click', async function() {
        if (!selectedClientId) return;
        const { data: client, error } = await supabaseClient
            .from('clients')
            .select('haircut_count')
            .eq('id', selectedClientId)
            .single();

        if (error) {
            alert('Ошибка: ' + error.message);
            return;
        }

        const newCount = client.haircut_count + 1;
        const { error: updateError } = await supabaseClient
            .from('clients')
            .update({ haircut_count: newCount })
            .eq('id', selectedClientId);

        if (updateError) {
            alert('Ошибка: ' + updateError.message);
        } else {
            modalHaircutCount.textContent = newCount;
            modalRemaining.textContent = 6 - (newCount % 6);
            loadClients();
            loadAppointments();
        }
    });

    resetCounterBtn.addEventListener('click', async function() {
        if (!selectedClientId) return;
        if (confirm('Сбросить счетчик стрижек на 0?')) {
            const { error } = await supabaseClient
                .from('clients')
                .update({ haircut_count: 0 })
                .eq('id', selectedClientId);
            if (error) {
                alert('Ошибка: ' + error.message);
            } else {
                modalHaircutCount.textContent = 0;
                modalRemaining.textContent = 6;
                loadClients();
                loadAppointments();
            }
        }
    });

    closeModalBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        selectedClientId = null;
    });

    // ========== Вспомогательные функции ==========
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function getStatusText(status) {
        const map = { 'active': 'Активна', 'completed': 'Завершена', 'cancelled': 'Отменена' };
        return map[status] || status;
    }

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

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ========== События интерфейса ==========
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');
            tabLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) content.classList.add('active');
            });
            if (tabId === 'appointments') loadAppointments();
            if (tabId === 'clients') loadClients();
            if (tabId === 'settings') loadSettings();
        });
    });

    filterDate.addEventListener('change', loadAppointments);
    filterStatus.addEventListener('change', loadAppointments);
    refreshBtn.addEventListener('click', loadAppointments);
    searchClient.addEventListener('input', debounce(loadClients, 300));
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('masterAuth');
        window.location.href = 'index.html';
    });

    // Добавление нового клиента (простая реализация)
    if (addClientBtn) {
        addClientBtn.addEventListener('click', async () => {
            const name = prompt('Введите имя клиента:');
            if (!name) return;
            const phone = prompt('Введите телефон:');
            if (!phone) return;
            const { error } = await supabaseClient.from('clients').insert([{ name, phone, haircut_count: 0 }]);
            if (error) alert('Ошибка: ' + error.message);
            else loadClients();
        });
    }

    // Инициализация
    loadAppointments();
    updateStatusIndicator();
    setInterval(updateStatusIndicator, 60000);
});
