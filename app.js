document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('appointmentDate');
    const timeSelect = document.getElementById('appointmentTime');
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const submitBtn = document.getElementById('submitBooking');
    const messageDiv = document.getElementById('bookingMessage');

    // Установка минимальной даты (завтра)
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];

    dateInput.addEventListener('change', loadAvailableTimes);

    // Получение или создание настроек мастера
    async function getOrCreateSettings() {
        let { data: settings, error } = await supabaseClient
            .from('master_settings')
            .select('*')
            .maybeSingle();

        if (error) throw new Error('Ошибка загрузки настроек');

        if (!settings) {
            const { data: newSettings, error: insertError } = await supabaseClient
                .from('master_settings')
                .insert([{ work_start: '10:00', work_end: '19:00', slot_duration: 30, price: 600 }])
                .select()
                .single();
            if (insertError) throw new Error('Не удалось создать настройки');
            settings = newSettings;
        }
        return settings;
    }

    async function loadAvailableTimes() {
        const selectedDate = dateInput.value;
        if (!selectedDate) return;

        timeSelect.innerHTML = '<option value="">-- Загрузка... --</option>';
        try {
            const settings = await getOrCreateSettings();

            const { data: existingAppointments, error: appsError } = await supabaseClient
                .from('appointments')
                .select('appointment_time')
                .eq('appointment_date', selectedDate)
                .eq('status', 'active');

            if (appsError) throw appsError;

            const bookedTimes = existingAppointments ? existingAppointments.map(a => a.appointment_time) : [];
            const slots = [];
            const start = new Date(`${selectedDate}T${settings.work_start}`);
            const end = new Date(`${selectedDate}T${settings.work_end}`);
            const slotDuration = settings.slot_duration * 60000;
            let current = start;
            const now = new Date();

            while (current < end) {
                const timeString = current.toTimeString().slice(0,5);
                const slotDateTime = new Date(`${selectedDate}T${timeString}`);
                if (slotDateTime > now && !bookedTimes.includes(timeString)) {
                    slots.push(timeString);
                }
                current = new Date(current.getTime() + slotDuration);
            }

            timeSelect.innerHTML = '<option value="">-- Выберите время --</option>';
            if (slots.length === 0) {
                timeSelect.innerHTML += '<option value="">Нет свободных слотов</option>';
            } else {
                slots.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot;
                    option.textContent = slot;
                    timeSelect.appendChild(option);
                });
            }
        } catch (err) {
            console.error(err);
            timeSelect.innerHTML = '<option value="">Ошибка загрузки слотов</option>';
            showMessage('Не удалось загрузить доступное время', 'error');
        }
    }

    submitBtn.addEventListener('click', async function(e) {
        e.preventDefault();

        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const date = dateInput.value;
        const time = timeSelect.value;

        if (!name || !phone || !date || !time) {
            showMessage('Пожалуйста, заполните все поля!', 'error');
            return;
        }

        const selectedDateTime = new Date(`${date}T${time}`);
        if (selectedDateTime <= new Date()) {
            showMessage('Нельзя записаться на прошедшее время', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
            let clientId;
            const { data: existingClient, error: clientError } = await supabaseClient
                .from('clients')
                .select('id')
                .eq('phone', phone)
                .maybeSingle();

            if (clientError) throw new Error('Ошибка проверки клиента');

            if (existingClient) {
                clientId = existingClient.id;
            } else {
                const { data: newClient, error: newClientError } = await supabaseClient
                    .from('clients')
                    .insert([{ name, phone, haircut_count: 0 }])
                    .select('id')
                    .single();
                if (newClientError) throw new Error('Ошибка создания клиента');
                clientId = newClient.id;
            }

            // Проверка дубля
            const { data: duplicate, error: dupError } = await supabaseClient
                .from('appointments')
                .select('id')
                .eq('client_id', clientId)
                .eq('appointment_date', date)
                .eq('appointment_time', time)
                .eq('status', 'active')
                .maybeSingle();

            if (duplicate) throw new Error('Вы уже записаны на это время');

            const { error: appointmentError } = await supabaseClient
                .from('appointments')
                .insert([{ client_id: clientId, appointment_date: date, appointment_time: time, status: 'active' }]);

            if (appointmentError) throw new Error('Ошибка создания записи');

            showMessage(`Отлично, ${name}! Вы записаны на ${date} в ${time}. Мастер свяжется с вами.`, 'success');
            nameInput.value = '';
            phoneInput.value = '';
            dateInput.value = '';
            timeSelect.innerHTML = '<option value="">-- Выберите время --</option>';
        } catch (err) {
            showMessage(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Записаться за 600 ₽';
        }
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => messageDiv.className = 'message', 5000);
    }
});
