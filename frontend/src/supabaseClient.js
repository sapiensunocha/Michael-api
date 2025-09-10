import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://dzmvznbqvbepxwzhwhcp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6bXZ6bmJxdmJlcHh3emh3aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MDU2MjIsImV4cCI6MjA2NzE4MTYyMn0.a6F6T8PNMBpzKMpZc-LpykYK4MvHoDmrGbiSKOPRR68';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);