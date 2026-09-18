// Подключение сайта к Supabase
const SUPABASE_URL = 'https://vhsptoiylsalrunjjfsf.supabase.co';

// ОСТАВЬ ЗДЕСЬ СВОЙ ТЕКУЩИЙ SUPABASE ANON KEY
const SUPABASE_ANON_KEY = 'ВСТАВЬ_СЮДА_ТЕКУЩИЙ_ANON_KEY_ИЗ_СТАРОГО_config.js';

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

// Пока оставляем эту переменную,
// потому что текущий master.js использует её.
const MASTER_PASSWORD = 'ТВОЙ_ТЕКУЩИЙ_ПАРОЛЬ_МАСТЕРА';
