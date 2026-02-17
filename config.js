// ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА СВОИ С SUPABASE!
const SUPABASE_URL = 'https://vhsptoiylsalrunjjfsf.supabase.co'; // Ваш Project URL
const SUPABASE_ANON_KEY = 'sb_secret_qDSVNi1JOaooSTDNlvUORQ_E8Eg8Dj0 '; // Ваш anon / public ключ

// Инициализация Supabase (используем другое имя, чтобы избежать конфликтов)
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Простая проверка авторизации для панели мастера
const MASTER_PASSWORD = "Lavesi574482"; // Поменяйте на свой надежный пароль
