// ЗАМЕНИТЕ ЭТИ ЗНАЧЕНИЯ НА СВОИ С SUPABASE!
const SUPABASE_URL = 'https://vhsptoiylsalrunjjfsf.supabase.co'; // Ваш Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoc3B0b2l5bHNhbHJ1bmpqZnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzIwMDcsImV4cCI6MjA4NjkwODAwN30.BvXTD1O-eNwCmQaVbTzOVvDUMTuny-YJW7460R1WNg8'; // Ваш anon / public ключ

// Инициализация Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Простая проверка авторизации для панели мастера
const MASTER_PASSWORD = "master123"; // Поменяйте на свой надежный пароль
