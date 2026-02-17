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

        console.log('=== ЗАГРУЗКА СЛОТОВ ===');
        console.log('Выбрана дата (selectedDate):', selectedDate);
        timeSelect.innerHTML = '<option value="">-- Загрузка... --</option>';

        // 1. Получаем настройки рабочего времени
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

        console.log('Настройки получены:', settings);
        console.log('work_start_time:', settings.work_start_time, 'work_end_time:', settings.work_end_time);

        // 2. Получаем уже занятые слоты
        const { data: existingAppointments, error: appsError } = await supabaseClient
            .from('appointments')
            .select('appointment_time')
            .eq('appointment_date', selectedDate)
            .eq('status', 'active');

        if (appsError) {
            console.error('Ошибка загрузки записей:', appsError);
        }

        const bookedTimes = existingAppointments ? existingAppointments.map(a => a.appointment_time) : [];
        console.log('Занятые слоты:', bookedTimes);

        // 3. Генерация всех возможных слотов
        const slots = [];
        // Создаём объекты Date для начала и конца рабочего дня
        const start = new Date(`${selectedDate}T${settings.work_start_time}`);
        const end = new Date(`${selectedDate}T${settings.work_end_time}`);
        const slotDuration = settings.slot_duration * 60000;

        console.log('start (объект Date):', start);
        console.log('end (объект Date):', end);
        console.log('slotDuration (мс):', slotDuration);

        // Проверка на корректность дат
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            console.error('Некорректный формат времени в настройках');
            timeSelect.innerHTML = '<option value="">Ошибка формата времени</option>';
            return;
        }

        let current = start;
        let iterationCount = 0;
        while (current < end) {
            iterationCount++;
            const timeString = current.toTimeString().slice(0,5); // "HH:MM"
            // Создаём объект Date для проверки "в будущем ли время?"
            const slotDateTime = new Date(`${selectedDate}T${timeString}`);
            const now = new Date();
            const isFuture = slotDateTime > now;
            
            // Проверяем, не занят ли слот
            const isBooked = bookedTimes.includes(timeString);

            console.log(`Слот ${iterationCount}: ${timeString}, isFuture=${isFuture}, isBooked=${isBooked}`);

            if (isFuture && !isBooked) {
                slots.push(timeString);
            }
            current = new Date(current.getTime() + slotDuration);
        }

        console.log('Всего проверено слотов:', iterationCount);
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

        if (clientError) {
            console.error('Ошибка поиска клиента:', clientError);
            showMessage('Ошибка при проверке клиента. Попробуйте позже.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Записаться за 600 ₽';
            return;
        }

        if (existingClient) {
            clientId = existingClient.id;
            console.log('Клиент найден, id:', clientId);
        } else {
            // Создаем нового клиента
            const { data: newClient, error: newClientError } = await supabaseClient
                .from('clients')
                .insert([{ name, phone }])
                .select('id')
                .single();

            if (newClientError) {
                console.error('Ошибка создания клиента:', newClientError);
                showMessage('Ошибка при создании клиента. Попробуйте позже.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Записаться за 600 ₽';
                return;
            }
            clientId = newClient.id;
            console.log('Новый клиент создан, id:', clientId);
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
