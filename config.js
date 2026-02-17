// ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА СВОИ С SUPABASE!
const SUPABASE_URL = 'https://your-project-url.supabase.co'; // Ваш Project URL
const SUPABASE_ANON_KEY = 'your-anon-key'; // Ваш anon / public ключ

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Простая проверка авторизации для панели мастера
const MASTER_PASSWORD = "master123"; // Поменяйте на свой надежный пароль
