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

    // Функция для получения или создания настроек мастера
    async function getOrCreateSettings() {
        // Пытаемся получить существующие настройки
        let { data: settings, error } = await supabaseClient
            .from('master_settings')
            .select('*')
            .maybeSingle(); // .maybeSingle() не выдаёт ошибку, если записей нет

        if (error) {
            console.error('Ошибка загрузки настроек:', error);
            throw new Error('Не удалось загрузить настройки');
        }

        // Если настроек нет – создаём со значениями по умолчанию
        if (!settings) {
            console.log('Настройки не найдены, создаём стандартные...');
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
                throw new Error('Не удалось создать настройки');
            }
            settings = newSettings;
        }

        return settings;
    }

    async function loadAvailableTimes() {
        const selectedDate = dateInput.value;
        if (!selectedDate) return;

        console.log('=== ЗАГРУЗКА СЛОТОВ ===');
        console.log('Выбрана дата (selectedDate):', selectedDate);
        timeSelect.innerHTML = '<option value="">-- Загрузка... --</option>';

        try {
            // 1. Получаем или создаём настройки
            const settings = await getOrCreateSettings();
            console.log('Настройки получены:', settings);

            // 2. Получаем уже занятые слоты на выбранную дату
            const { data: existingAppointments, error: appsError } = await supabaseClient
                .from('appointments')
                .select('appointment_time')
                .eq('appointment_date', selectedDate)
                .eq('status', 'active');

            if (appsError) {
                console.error('Ошибка загрузки записей:', appsError);
                throw appsError;
            }

            const bookedTimes = existingAppointments ? existingAppointments.map(a => a.appointment_time) : [];
            console.log('Занятые слоты:', bookedTimes);

            // 3. Генерация всех возможных слотов
            const slots = [];
            const start = new Date(`${selectedDate}T${settings.work_start}`);
            const end = new Date(`${selectedDate}T${settings.work_end}`);
            const slotDuration = settings.slot_duration * 60000;

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                throw new Error('Некорректный формат времени в настройках');
            }

            let current = start;
            let iterationCount = 0;
            const now = new Date();

            while (current < end) {
                iterationCount++;
                const timeString = current.toTimeString().slice(0,5); // "HH:MM"
                const slotDateTime = new Date(`${selectedDate}T${timeString}`);
                const isFuture = slotDateTime > now;
                const isBooked = bookedTimes.includes(timeString);

                if (isFuture && !isBooked) {
                    slots.push(timeString);
                }
                current = new Date(current.getTime() + slotDuration);
            }

            console.log(`Всего проверено слотов: ${iterationCount}`);
            console.log('Доступные слоты:', slots);

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
        } catch (err) {
            console.error('Ошибка в loadAvailableTimes:', err);
            timeSelect.innerHTML = '<option value="">Ошибка загрузки слотов</option>';
            showMessage('Не удалось загрузить доступное время. Попробуйте позже.', 'error');
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

        // Дополнительная проверка: выбранное время не должно быть в прошлом
        const selectedDateTime = new Date(`${date}T${time}`);
        if (selectedDateTime <= new Date()) {
            showMessage('Нельзя записаться на прошедшее время. Выберите другую дату или время.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Отправка...';

        try {
            // Поиск или создание клиента
            let clientId;
            const { data: existingClient, error: clientError } = await supabaseClient
                .from('clients')
                .select('id, haircut_count')
                .eq('phone', phone)
                .maybeSingle();

            if (clientError) {
                throw new Error('Ошибка при проверке клиента: ' + clientError.message);
            }

            if (existingClient) {
                clientId = existingClient.id;
                console.log('Клиент найден, id:', clientId);
            } else {
                const { data: newClient, error: newClientError } = await supabaseClient
                    .from('clients')
                    .insert([{ name, phone, haircut_count: 0 }])
                    .select('id')
                    .single();

                if (newClientError) {
                    throw new Error('Ошибка создания клиента: ' + newClientError.message);
                }
                clientId = newClient.id;
                console.log('Новый клиент создан, id:', clientId);
            }

            // Проверка, не записан ли уже клиент на это время (защита от двойной записи)
            const { data: duplicate, error: dupError } = await supabaseClient
                .from('appointments')
                .select('id')
                .eq('client_id', clientId)
                .eq('appointment_date', date)
                .eq('appointment_time', time)
                .eq('status', 'active')
                .maybeSingle();

            if (duplicate) {
                throw new Error('Вы уже записаны на это время!');
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
                throw new Error('Ошибка создания записи: ' + appointmentError.message);
            }

            showMessage(`Отлично, ${name}! Вы записаны на ${date} в ${time}. Мастер свяжется с вами для подтверждения.`, 'success');
            // Очищаем форму
            nameInput.value = '';
            phoneInput.value = '';
            dateInput.value = '';
            timeSelect.innerHTML = '<option value="">-- Выберите время --</option>';
        } catch (err) {
            console.error(err);
            showMessage(err.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Записаться за 600 ₽';
        }
    });

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 5000);
    }
});
