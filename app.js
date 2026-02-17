document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.querySelector('.booking-form');
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

    async function loadAvailableTimes() {
        const selectedDate = dateInput.value;
        if (!selectedDate) return;

        timeSelect.innerHTML = '<option value="">-- Загрузка... --</option>';

        // Получаем настройки рабочего времени
        const { data: settings, error: settingsError } = await supabaseClient
            .from('master_settings')
            .select('*')
            .single();

        if (settingsError) {
            console.error('Ошибка загрузки настроек:', settingsError);
            timeSelect.innerHTML = '<option value="">Ошибка загрузки настроек</option>';
            return;
        }

        if (!settings) {
            console.error('Нет данных в таблице master_settings!');
            timeSelect.innerHTML = '<option value="">Настройки не найдены</option>';
            return;
        }

        // Получаем уже занятые слоты
        const { data: existingAppointments, error: appsError } = await supabaseClient
            .from('appointments')
            .select('appointment_time')
            .eq('appointment_date', selectedDate)
            .eq('status', 'active');

        const bookedTimes = existingAppointments ? existingAppointments.map(a => a.appointment_time) : [];

        // Генерация слотов с правильными именами полей
        const slots = [];
        const start = new Date(`${selectedDate}T${settings.work_start_time}`);
        const end = new Date(`${selectedDate}T${settings.work_end_time}`);
        const slotDuration = settings.slot_duration * 60000;

        let current = start;
        while (current < end) {
            const timeString = current.toTimeString().slice(0,5);
            const isFuture = new Date(`${selectedDate}T${timeString}`) > new Date();
            const isBooked = bookedTimes.includes(timeString);

            if (isFuture && !isBooked) {
                slots.push(timeString);
            }
            current = new Date(current.getTime() + slotDuration);
        }

        // Заполняем select
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
    }

    // Обработка формы записи (остаётся без изменений)
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

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        // Поиск или создание клиента
        let clientId;
        const { data: existingClient, error: clientError } = await supabaseClient
            .from('clients')
            .select('id, haircut_count')
            .eq('phone', phone)
            .maybeSingle();

        if (existingClient) {
            clientId = existingClient.id;
        } else {
            const { data: newClient, error: newClientError } = await supabaseClient
                .from('clients')
                .insert([{ name, phone }])
                .select('id')
                .single();

            if (newClientError) {
                showMessage('Ошибка при создании клиента. Попробуйте позже.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Записаться за 600 ₽';
                return;
            }
            clientId = newClient.id;
        }

        // Создание записи
        const { error: appointmentError } = await supabaseClient
            .from('appointments')
            .insert([{
                client_id: clientId,
                appointment_date: date,
                appointment_time: time,
                status: 'active'
            }]);

        if (appointmentError) {
            showMessage('Ошибка при создании записи. Попробуйте позже.', 'error');
        } else {
            showMessage(`Отлично, ${name}! Вы записаны на ${date} в ${time}. Мастер свяжется с вами для подтверждения.`, 'success');
            nameInput.value = '';
            phoneInput.value = '';
            dateInput.value = '';
            timeSelect.innerHTML = '<option value="">-- Выберите время --</option>';
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Записаться за 600 ₽';
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 5000);
    }
});
