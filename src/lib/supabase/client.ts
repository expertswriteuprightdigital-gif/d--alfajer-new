"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/src/lib/supabase/database.types";

export function createClient() {
    // Use the Supabase URL directly (NOT through the proxy).
    // The proxy URL (localhost/api/supabase) causes a cookie name mismatch
    // because the cookie key is derived from the URL hostname.
    // Browser → proxy URL = sb-localhost-auth-token
    // Server → real URL = sb-api-auth-token
    // These don't match, so the session is lost on page navigation.
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// Singleton instance for client-side usage
let browserClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
    if (typeof window === "undefined") {
        throw new Error("getSupabaseClient should only be called on the client side");
    }
    if (!browserClient) {
        browserClient = createClient();
    }
    return browserClient;
}
