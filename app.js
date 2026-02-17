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

    // Загрузка доступных времен при выборе даты
    dateInput.addEventListener('change', loadAvailableTimes);

    async function loadAvailableTimes() {
        const selectedDate = dateInput.value;
        if (!selectedDate) return;

        timeSelect.innerHTML = '<option value="">-- Загрузка... --</option>';

        // 1. Получаем настройки рабочего времени
        const { data: settings, error: settingsError } = await supabase
            .from('master_settings')
            .select('*')
            .single();

        if (settingsError) {
            console.error('Ошибка загрузки настроек:', settingsError);
            timeSelect.innerHTML = '<option value="">Ошибка загрузки</option>';
            return;
        }

        // 2. Получаем уже занятые слоты на эту дату
        const { data: existingAppointments, error: appsError } = await supabase
            .from('appointments')
            .select('appointment_time')
            .eq('appointment_date', selectedDate)
            .eq('status', 'active');

        if (appsError) {
            console.error('Ошибка загрузки записей:', appsError);
        }

        const bookedTimes = existingAppointments ? existingAppointments.map(a => a.appointment_time) : [];

        // 3. Генерация всех возможных слотов
        const slots = [];
        const start = new Date(`${selectedDate}T${settings.work_start}`);
        const end = new Date(`${selectedDate}T${settings.work_end}`);
        const slotDuration = settings.slot_duration * 60000; // в миллисекундах

        let current = start;
        while (current < end) {
            const timeString = current.toTimeString().slice(0,5); // "HH:MM"
            // Проверяем, не прошедшее ли это время (если выбрана сегодняшняя дата)
            const isFuture = new Date(`${selectedDate}T${timeString}`) > new Date();
            // И не занято ли
            const isBooked = bookedTimes.includes(timeString);

            if (isFuture && !isBooked) {
                slots.push(timeString);
            }
            current = new Date(current.getTime() + slotDuration);
        }

        // 4. Заполняем select
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

    // Обработка формы записи
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

        // 1. Проверяем/создаем клиента
        let clientId;
        const { data: existingClient, error: clientError } = await supabase
            .from('clients')
            .select('id, haircut_count')
            .eq('phone', phone)
            .maybeSingle();

        if (clientError) {
            console.error('Ошибка поиска клиента:', clientError);
        }

        if (existingClient) {
            clientId = existingClient.id;
        } else {
            // Создаем нового клиента
            const { data: newClient, error: newClientError } = await supabase
                .from('clients')
                .insert([{ name, phone }])
                .select('id')
                .single();

            if (newClientError) {
                console.error('Ошибка создания клиента:', newClientError);
                showMessage('Ошибка при создании записи. Попробуйте позже.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Записаться за 600 ₽';
                return;
            }
            clientId = newClient.id;
        }

        // 2. Создаем запись
        const { error: appointmentError } = await supabase
            .from('appointments')
            .insert([{
                client_id: clientId,
                appointment_date: date,
                appointment_time: time,
                status: 'active'
            }]);

        if (appointmentError) {
            console.error('Ошибка создания записи:', appointmentError);
            showMessage('Ошибка при создании записи. Попробуйте позже.', 'error');
        } else {
            showMessage(`Отлично, ${name}! Вы записаны на ${date} в ${time}. Мастер свяжется с вами для подтверждения.`, 'success');
            // Очищаем форму
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
