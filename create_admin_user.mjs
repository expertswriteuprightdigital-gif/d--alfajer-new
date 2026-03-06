import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Use standard supabase URL for this ref, since api.alfajermart.com might not be correct for auth API
const supabaseUrl = 'https://ijchxbtovluwlrdbwrqb.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin() {
  const email = 'admin@alfajermart.com';
  const password = 'Sumeera@2026';

  console.log(`Checking if user ${email} exists...`);

  // First, let's list users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();

  if (usersError) {
    console.error('Error listing users:', usersError);
    process.exit(1);
  }

  const existingUser = usersData.users.find(u => u.email === email);

  if (existingUser) {
    console.log('User already exists. Updating metadata and password...');
    const { data, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      {
        password: password,
        user_metadata: { role: 'admin', isAdmin: true, admin: true },
        email_confirm: true
      }
    );
    if (error) console.error('Error updating user:', error);
    else console.log('Successfully updated user to admin.');
  } else {
    console.log('User does not exist. Creating new admin user...');
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'admin', isAdmin: true, admin: true }
    });

    if (error) console.error('Error creating user:', error);
    else console.log('Successfully created admin user:', data.user.id);
  }
}

createAdmin();
