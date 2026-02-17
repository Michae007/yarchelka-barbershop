document.addEventListener('DOMContentLoaded', function() {
    // Проверка пароля (простая, для демо)
    const savedPass = localStorage.getItem('masterAuth');
    if (savedPass !== MASTER_PASSWORD) {
        const enteredPass = prompt('Введите пароль для доступа к панели мастера:');
        if (enteredPass === MASTER_PASSWORD) {
            localStorage.setItem('masterAuth', enteredPass);
        } else {
            alert('Неверный пароль!');
            window.location.href = 'index.html';
        }
    }

    // Элементы
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

    // Переключение вкладок
    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabId = this.getAttribute('data-tab');

            tabLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                    if (tabId === 'appointments') loadAppointments();
                    if (tabId === 'clients') loadClients();
                    if (tabId === 'settings') loadSettings();
                }
            });
        });
    });

    // Загрузка и отображение записей
    async function loadAppointments() {
        appointmentsTable.innerHTML = '<tr><td colspan="7">Загрузка...</td></tr>';
        let query = supabaseClient
            .from('appointments')
            .select(`
                id,
                appointment_date,
                appointment_time,
                status,
                clients (name, phone, haircut_count)
            `)
            .order('appointment_date', { ascending: true })
            .order('appointment_time', { ascending: true });

        if (filterDate.value) {
            query = query.eq('appointment_date', filterDate.value);
        }

        if (filterStatus.value) {
            query = query.eq('status', filterStatus.value);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Ошибка загрузки записей:', error);
            appointmentsTable.innerHTML = '<tr><td colspan="7">Ошибка загрузки</td></tr>';
            return;
        }

        appointmentsTable.innerHTML = '';
        if (data.length === 0) {
            appointmentsTable.innerHTML = '<tr><td colspan="7">Нет записей</td></tr>';
            return;
        }

        data.forEach(app => {
            const row = appointmentsTable.insertRow();
            row.innerHTML = `
                <td>${formatDate(app.appointment_date)}</td>
                <td>${app.appointment_time}</td>
                <td>${app.clients.name}</td>
                <td>${app.clients.phone}</td>
                <td>${app.clients.haircut_count}</td>
                <td><span class="status-badge status-${app.status}">${getStatusText(app.status)}</span></td>
                <td class="actions">
                    ${app.status === 'active' ? `
                        <button class="btn-small btn-complete" onclick="completeAppointment(${app.id})"><i class="fas fa-check"></i></button>
                        <button class="btn-small btn-cancel" onclick="cancelAppointment(${app.id})"><i class="fas fa-times"></i></button>
                    ` : ''}
                    <button class="btn-small btn-delete" onclick="deleteAppointment(${app.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });

        updateStatusIndicator();
    }

    // Загрузка клиентов
    async function loadClients() {
        clientsTable.innerHTML = '<tr><td colspan="6">Загрузка...</td></tr>';
        let query = supabaseClient
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        if (searchClient.value) {
            const searchTerm = `%${searchClient.value}%`;
            query = query.or(`name.ilike.${searchTerm},phone.ilike.${searchTerm}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Ошибка загрузки клиентов:', error);
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
                <td>${client.name}</td>
                <td>${client.phone}</td>
                <td>${client.haircut_count}</td>
                <td><strong>${remaining}</strong> до бесплатной</td>
                <td>${client.notes || '-'}</td>
                <td>
                    <button class="btn-small btn-complete" onclick="openClientModal(${client.id}, '${client.name}', '${client.phone}', ${client.haircut_count})"><i class="fas fa-edit"></i> Акция</button>
                    <button class="btn-small btn-delete" onclick="deleteClient(${client.id})"><i class="fas fa-trash"></i></button>
                </td>
            `;
        });
    }

    // Загрузка настроек
    async function loadSettings() {
        const { data, error } = await supabaseClient
            .from('master_settings')
            .select('*')
            .single();

        if (error) {
            console.error('Ошибка загрузки настроек:', error);
            return;
        }

        workStartInput.value = data.work_start;
        workEndInput.value = data.work_end;
        slotDurationInput.value = data.slot_duration;
        priceInput.value = data.price;
    }

    // Сохранение настроек
    saveSettingsBtn.addEventListener('click', async function() {
        const { error } = await supabaseClient
            .from('master_settings')
            .update({
                work_start: workStartInput.value,
                work_end: workEndInput.value,
                slot_duration: slotDurationInput.value,
                price: priceInput.value
            })
            .eq('id', 1);

        if (error) {
            showSettingsMessage('Ошибка сохранения: ' + error.message, 'error');
        } else {
            showSettingsMessage('Настройки успешно сохранены!', 'success');
        }
    });

    // Открытие модального окна клиента
    window.openClientModal = function(id, name, phone, count) {
        selectedClientId = id;
        modalClientName.textContent = name;
        modalClientPhone.textContent = phone;
        modalHaircutCount.textContent = count;
        modalRemaining.textContent = 6 - (count % 6);
        modal.style.display = 'flex';
    };

    // Добавление стрижки (отметка акции)
    addHaircutBtn.addEventListener('click', async function() {
        if (!selectedClientId) return;

        const { data: client, error: fetchError } = await supabaseClient
            .from('clients')
            .select('haircut_count')
            .eq('id', selectedClientId)
            .single();

        if (fetchError) {
            alert('Ошибка обновления: ' + fetchError.message);
            return;
        }

        const newCount = client.haircut_count + 1;

        const { error } = await supabaseClient
            .from('clients')
            .update({ haircut_count: newCount })
            .eq('id', selectedClientId);

        if (error) {
            alert('Ошибка обновления: ' + error.message);
        } else {
            modalHaircutCount.textContent = newCount;
            modalRemaining.textContent = 6 - (newCount % 6);
            loadClients();
            loadAppointments();
        }
    });

    // Сброс счетчика
    resetCounterBtn.addEventListener('click', async function() {
        if (!selectedClientId) return;

        if (confirm('Сбросить счетчик стрижек на 0?')) {
            const { error } = await supabaseClient
                .from('clients')
                .update({ haircut_count: 0 })
                .eq('id', selectedClientId);

            if (error) {
                alert('Ошибка сброса: ' + error.message);
            } else {
                modalHaircutCount.textContent = 0;
                modalRemaining.textContent = 6;
                loadClients();
                loadAppointments();
            }
        }
    });

    // Закрытие модального окна
    closeModalBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        selectedClientId = null;
    });

    // Функции действий с записями (глобальные для onclick)
    window.completeAppointment = async function(id) {
        const { error } = await supabaseClient
            .from('appointments')
            .update({ status: 'completed' })
            .eq('id', id);

        if (error) {
            alert('Ошибка: ' + error.message);
        } else {
            loadAppointments();
        }
    };

    window.cancelAppointment = async function(id) {
        const { error } = await supabaseClient
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) {
            alert('Ошибка: ' + error.message);
        } else {
            loadAppointments();
        }
    };

    window.deleteAppointment = async function(id) {
        if (confirm('Удалить запись?')) {
            const { error } = await supabaseClient
                .from('appointments')
                .delete()
                .eq('id', id);

            if (error) {
                alert('Ошибка: ' + error.message);
            } else {
                loadAppointments();
            }
        }
    };

    window.deleteClient = async function(id) {
        if (confirm('Удалить клиента и все его записи?')) {
            await supabaseClient.from('appointments').delete().eq('client_id', id);
            const { error } = await supabaseClient.from('clients').delete().eq('id', id);

            if (error) {
                alert('Ошибка: ' + error.message);
            } else {
                loadClients();
                loadAppointments();
            }
        }
    };

    // Вспомогательные функции
    function formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
        });
    }

    function getStatusText(status) {
        const statusMap = {
            'active': 'Активна',
            'completed': 'Завершена',
            'cancelled': 'Отменена'
        };
        return statusMap[status] || status;
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
        setTimeout(() => {
            settingsMessage.className = 'message';
        }, 3000);
    }

    // События
    filterDate.addEventListener('change', loadAppointments);
    filterStatus.addEventListener('change', loadAppointments);
    refreshBtn.addEventListener('click', loadAppointments);
    searchClient.addEventListener('input', debounce(loadClients, 300));
    logoutBtn.addEventListener('click', function() {
        localStorage.removeItem('masterAuth');
        window.location.href = 'index.html';
    });

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Инициализация
    loadAppointments();
    updateStatusIndicator();
    setInterval(updateStatusIndicator, 60000);
});
