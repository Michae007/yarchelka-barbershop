// ВАШИ ДАННЫЕ ИЗ SUPABASE (ПРОВЕРЬТЕ URL И КЛЮЧ)
const SUPABASE_URL = 'https://vhsptoiylsalrunjifsf.supabase.co';   // Убедитесь, что URL правильный!
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoc3B0b2l5bHNhbHJ1bmpqZnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzIwMDcsImV4cCI6MjA4NjkwODAwN30.BvXTD1O-eNwCmQaVbTzOVvDUMTuny-YJW7460R1WNg8';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const MASTER_PASSWORD = "Lavesi574482";   // Пароль для входа в панель мастера
