// One-time script to upgrade a user to admin role
// Run with: npx tsx scripts/make-admin.ts <email>

import { createClient } from '@supabase/supabase-js'
import { loadEnvConfig } from '@next/env'

// Load environment variables from .env.local
loadEnvConfig(process.cwd())

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const email = process.argv[2]

if (!email) {
  console.error('Usage: npx tsx scripts/make-admin.ts <email>')
  process.exit(1)
}

async function makeAdmin() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find user by email
  const { data: users, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('Error fetching users:', userError.message)
    process.exit(1)
  }

  const user = users.users.find(u => u.email === email)

  if (!user) {
    console.error(`User with email "${email}" not found`)
    console.log('Available users:')
    users.users.forEach(u => console.log(`  - ${u.email}`))
    process.exit(1)
  }

  console.log(`Found user: ${user.email} (${user.id})`)

  // Update profile to admin role
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    console.error('Error updating role:', error.message)
    process.exit(1)
  }

  console.log(`Successfully upgraded ${email} to admin role`)
  console.log('Profile:', data)
}

makeAdmin()
