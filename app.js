document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('appointmentDate');
    const timeSelect = document.getElementById('appointmentTime');
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const submitBtn = document.getElementById('submitBooking');
    const messageDiv = document.getElementById('bookingMessage');

    if (
        !dateInput ||
        !timeSelect ||
        !nameInput ||
        !phoneInput ||
        !submitBtn ||
        !messageDiv
    ) {
        console.error('Не найдены элементы формы онлайн-записи');
        return;
    }

    // --------------------------------------------------
    // ДАТА
    // --------------------------------------------------

    function getLocalDateString(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    }

    // Запись доступна начиная с завтрашнего дня
    const tomorrow = new Date();

    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    dateInput.min = getLocalDateString(tomorrow);

    // --------------------------------------------------
    // НАСТРОЙКИ
    // --------------------------------------------------

    let currentSettings = {
        work_start: '10:00',
        work_end: '19:00',
        slot_duration: 30,
        price: 600
    };

    async function getSettings() {
        const { data, error } = await supabaseClient
            .from('master_settings')
            .select('work_start, work_end, slot_duration, price')
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('Ошибка загрузки настроек Supabase:', error);

            // Используем стандартные настройки,
            // чтобы форма не ломалась полностью.
            return currentSettings;
        }

        if (data) {
            currentSettings = {
                work_start: String(data.work_start || '10:00').slice(0, 5),
                work_end: String(data.work_end || '19:00').slice(0, 5),
                slot_duration: Number(data.slot_duration) || 30,
                price: Number(data.price) || 600
            };
        }

        return currentSettings;
    }

    // --------------------------------------------------
    // ПРОВЕРКА ТЕЛЕФОНА
    // --------------------------------------------------

    function isValidPhone(phone) {
        const digits = phone.replace(/\D/g, '');

        return digits.length >= 10 && digits.length <= 15;
    }

    // --------------------------------------------------
    // ПРОВЕРКА ИМЕНИ
    // --------------------------------------------------

    function isValidName(name) {
        return name.length >= 2 && name.length <= 80;
    }

    // --------------------------------------------------
    // ФОРМАТ ДАТЫ
    // --------------------------------------------------

    function formatDateForUser(date) {
        const parts = date.split('-');

        if (parts.length !== 3) {
            return date;
        }

        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    // --------------------------------------------------
    // СООБЩЕНИЯ
    // --------------------------------------------------

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;

        clearTimeout(showMessage.timer);

        showMessage.timer = setTimeout(() => {
            messageDiv.textContent = '';
            messageDiv.className = 'message';
        }, 5000);
    }

    // --------------------------------------------------
    // ЗАГРУЗКА СВОБОДНОГО ВРЕМЕНИ
    // --------------------------------------------------

    async function loadAvailableTimes() {
        const selectedDate = dateInput.value;

        timeSelect.innerHTML =
            '<option value="">-- Загрузка... --</option>';

        if (!selectedDate) {
            timeSelect.innerHTML =
                '<option value="">-- Выберите дату --</option>';

            return;
        }

        try {
            const settings = await getSettings();

            console.log('Настройки мастера:', settings);

            const {
                data: appointments,
                error
            } = await supabaseClient
                .from('appointments')
                .select('appointment_time')
                .eq('appointment_date', selectedDate)
                .eq('status', 'active');

            if (error) {
                console.error('Ошибка загрузки записей:', error);
                throw new Error('Не удалось загрузить занятые часы');
            }

            const bookedTimes = new Set(
                (appointments || []).map(item =>
                    String(item.appointment_time).slice(0, 5)
                )
            );

            const [
                startHour,
                startMinute
            ] = settings.work_start.split(':').map(Number);

            const [
                endHour,
                endMinute
            ] = settings.work_end.split(':').map(Number);

            const startMinutes =
                startHour * 60 + startMinute;

            const endMinutes =
                endHour * 60 + endMinute;

            const slotDuration =
                Number(settings.slot_duration) || 30;

            const slots = [];

            const now = new Date();

            // --------------------------------------------------
            // СОЗДАЁМ СЛОТЫ
            // --------------------------------------------------

            for (
                let minutes = startMinutes;
                minutes < endMinutes;
                minutes += slotDuration
            ) {
                const hour = Math.floor(minutes / 60);
                const minute = minutes % 60;

                const timeString =
                    `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

                const slotDateTime =
                    new Date(`${selectedDate}T${timeString}:00`);

                // Не показываем прошедшее время
                if (slotDateTime <= now) {
                    continue;
                }

                // Не показываем занятые часы
                if (bookedTimes.has(timeString)) {
                    continue;
                }

                slots.push(timeString);
            }

            // --------------------------------------------------
            // ПОКАЗЫВАЕМ СЛОТЫ
            // --------------------------------------------------

            timeSelect.innerHTML =
                '<option value="">-- Выберите время --</option>';

            if (slots.length === 0) {
                timeSelect.innerHTML +=
                    '<option value="">Нет свободных слотов</option>';

                return;
            }

            slots.forEach(time => {
                const option =
                    document.createElement('option');

                option.value = time;
                option.textContent = time;

                timeSelect.appendChild(option);
            });

            console.log(
                'Свободные слоты:',
                slots
            );

        } catch (error) {

            console.error(
                'Ошибка загрузки слотов:',
                error
            );

            timeSelect.innerHTML =
                '<option value="">Ошибка загрузки слотов</option>';

            showMessage(
                'Не удалось загрузить свободное время. Обновите страницу.',
                'error'
            );
        }
    }

    // При изменении даты загружаем свободное время
    dateInput.addEventListener(
        'change',
        loadAvailableTimes
    );

    // --------------------------------------------------
    // ОТПРАВКА ЗАПИСИ
    // --------------------------------------------------

    submitBtn.addEventListener(
        'click',
        async event => {

            event.preventDefault();

            const name =
                nameInput.value.trim();

            const phone =
                phoneInput.value.trim();

            const date =
                dateInput.value;

            const time =
                timeSelect.value;

            // --------------------------------------------------
            // ПРОВЕРКА ИМЕНИ
            // --------------------------------------------------

            if (!isValidName(name)) {

                showMessage(
                    'Введите имя от 2 до 80 символов.',
                    'error'
                );

                nameInput.focus();

                return;
            }

            // --------------------------------------------------
            // ПРОВЕРКА ТЕЛЕФОНА
            // --------------------------------------------------

            if (!isValidPhone(phone)) {

                showMessage(
                    'Введите корректный номер телефона.',
                    'error'
                );

                phoneInput.focus();

                return;
            }

            // --------------------------------------------------
            // ПРОВЕРКА ДАТЫ И ВРЕМЕНИ
            // --------------------------------------------------

            if (!date || !time) {

                showMessage(
                    'Выберите дату и свободное время.',
                    'error'
                );

                return;
            }

            const selectedDateTime =
                new Date(`${date}T${time}:00`);

            if (
                Number.isNaN(
                    selectedDateTime.getTime()
                )
            ) {

                showMessage(
                    'Некорректная дата или время.',
                    'error'
                );

                return;
            }

            if (
                selectedDateTime <= new Date()
            ) {

                showMessage(
                    'Нельзя записаться на прошедшее время.',
                    'error'
                );

                await loadAvailableTimes();

                return;
            }

            submitBtn.disabled = true;

            submitBtn.textContent =
                'Проверяем...';

            try {

                // --------------------------------------------------
                // ИЩЕМ КЛИЕНТА
                // --------------------------------------------------

                const {
                    data: existingClient,
                    error: clientSearchError
                } = await supabaseClient
                    .from('clients')
                    .select('id, name, phone')
                    .eq('phone', phone)
                    .maybeSingle();

                if (clientSearchError) {

                    console.error(
                        'Ошибка поиска клиента:',
                        clientSearchError
                    );

                    throw new Error(
                        'Не удалось проверить клиента.'
                    );
                }

                let clientId;

                // --------------------------------------------------
                // ЕСЛИ КЛИЕНТ УЖЕ ЕСТЬ
                // --------------------------------------------------

                if (existingClient) {

                    clientId =
                        existingClient.id;

                } else {

                    // --------------------------------------------------
                    // СОЗДАЁМ НОВОГО КЛИЕНТА
                    // --------------------------------------------------

                    submitBtn.textContent =
                        'Создаём клиента...';

                    const {
                        data: newClient,
                        error: newClientError
                    } = await supabaseClient
                        .from('clients')
                        .insert([{
                            name: name,
                            phone: phone,
                            haircut_count: 0
                        }])
                        .select('id')
                        .single();

                    if (newClientError) {

                        console.error(
                            'Ошибка создания клиента:',
                            newClientError
                        );

                        // Возможно, клиент был создан
                        // другим запросом одновременно.
                        const {
                            data: retryClient
                        } = await supabaseClient
                            .from('clients')
                            .select('id')
                            .eq('phone', phone)
                            .maybeSingle();

                        if (!retryClient) {

                            throw new Error(
                                'Не удалось создать клиента.'
                            );
                        }

                        clientId =
                            retryClient.id;

                    } else {

                        clientId =
                            newClient.id;
                    }
                }

                // --------------------------------------------------
                // ПРОВЕРЯЕМ, НЕ ЗАНЯТО ЛИ ВРЕМЯ
                // --------------------------------------------------

                submitBtn.textContent =
                    'Проверяем время...';

                const {
                    data: duplicate,
                    error: duplicateError
                } = await supabaseClient
                    .from('appointments')
                    .select('id')
                    .eq('appointment_date', date)
                    .eq('appointment_time', time)
                    .eq('status', 'active')
                    .limit(1);

                if (duplicateError) {

                    console.error(
                        'Ошибка проверки времени:',
                        duplicateError
                    );

                    throw new Error(
                        'Не удалось проверить свободное время.'
                    );
                }

                if (
                    duplicate &&
                    duplicate.length > 0
                ) {

                    showMessage(
                        'К сожалению, это время уже заняли. Выберите другое.',
                        'error'
                    );

                    await loadAvailableTimes();

                    return;
                }

                // --------------------------------------------------
                // СОЗДАЁМ ЗАПИСЬ
                // --------------------------------------------------

                submitBtn.textContent =
                    'Записываем...';

                const {
                    error: appointmentError
                } = await supabaseClient
                    .from('appointments')
                    .insert([{
                        client_id: clientId,
                        appointment_date: date,
                        appointment_time: time,
                        status: 'active'
                    }]);

                if (appointmentError) {

                    console.error(
                        'Ошибка создания записи:',
                        appointmentError
                    );

                    // PostgreSQL 23505 =
                    // запись на это время уже существует.
                    if (
                        appointmentError.code === '23505'
                    ) {

                        showMessage(
                            'Это время уже заняли. Пожалуйста, выберите другое.',
                            'error'
                        );

                        await loadAvailableTimes();

                        return;
                    }

                    throw new Error(
                        'Не удалось создать запись.'
                    );
                }

                // --------------------------------------------------
                // УСПЕШНАЯ ЗАПИСЬ
                // --------------------------------------------------

                const price =
                    Number(currentSettings.price) || 600;

                showMessage(
                    `Отлично, ${name}! Вы записаны на ` +
                    `${formatDateForUser(date)} в ${time}. ` +
                    `Стоимость — ${price} ₽. ` +
                    `Мастер свяжется с вами.`,
                    'success'
                );

                // Очищаем форму
                nameInput.value = '';
                phoneInput.value = '';
                dateInput.value = '';

                timeSelect.innerHTML =
                    '<option value="">-- Выберите время --</option>';

            } catch (error) {

                console.error(
                    'Ошибка онлайн-записи:',
                    error
                );

                showMessage(
                    error.message ||
                    'Произошла ошибка. Попробуйте ещё раз.',
                    'error'
                );

            } finally {

                submitBtn.disabled = false;

                submitBtn.textContent =
                    `Записаться за ${Number(currentSettings.price) || 600} ₽`;
            }
        }
    );

    // --------------------------------------------------
    // ПЕРВИЧНАЯ ЗАГРУЗКА
    // --------------------------------------------------

    // Если дата уже выбрана браузером —
    // сразу загружаем время.
    if (dateInput.value) {
        loadAvailableTimes();
    } else {
        timeSelect.innerHTML =
            '<option value="">-- Выберите дату --</option>';
    }
});
