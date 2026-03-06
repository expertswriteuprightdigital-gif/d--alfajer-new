import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/src/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { isAdmin: false, error: 'User ID required' },
        { status: 400 }
      );
    }

    // First try: verify using the session cookie (normal flow)
    let user = null;
    let userEmail: string | undefined;

    try {
      const supabase = await createClient();
      const { data: { user: sessionUser }, error: userError } = await supabase.auth.getUser();

      if (!userError && sessionUser && sessionUser.id === userId) {
        user = sessionUser;
        userEmail = sessionUser.email;
      }
    } catch (e) {
      console.error('Session-based auth failed:', e);
    }

    // Fallback: if session cookie didn't work, use admin client to look up the user directly
    if (!user) {
      try {
        const adminSupabase = createAdminClient();
        const { data: { user: adminUser }, error: adminError } = await adminSupabase.auth.admin.getUserById(userId);

        if (adminError || !adminUser) {
          console.error('Admin getUserById failed:', adminError?.message);
          return NextResponse.json(
            { isAdmin: false, error: 'Unauthorized - user not found' },
            { status: 401 }
          );
        }

        user = adminUser;
        userEmail = adminUser.email;
      } catch (e) {
        console.error('Admin client fallback failed:', e);
        return NextResponse.json(
          { isAdmin: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Check 1: user_metadata for admin flag
    const isAdminFromMetadata = user.user_metadata?.role === 'admin' ||
                                user.user_metadata?.isAdmin === true ||
                                user.user_metadata?.admin === true;

    if (isAdminFromMetadata) {
      console.log(`Admin access granted via metadata for: ${userEmail}`);
      return NextResponse.json({ isAdmin: true });
    }

    // Check 2: ADMIN_EMAILS environment variable
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    if (userEmail && adminEmails.includes(userEmail.toLowerCase())) {
      console.log(`Admin access granted via ADMIN_EMAILS for: ${userEmail}`);
      return NextResponse.json({ isAdmin: true });
    }

    console.log(`Admin access DENIED for: ${userEmail}. Metadata:`, JSON.stringify(user.user_metadata));
    console.log(`ADMIN_EMAILS list:`, adminEmails);
    return NextResponse.json({ isAdmin: false });
  } catch (error: any) {
    console.error('Admin access check error:', error);
    return NextResponse.json(
      { isAdmin: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
