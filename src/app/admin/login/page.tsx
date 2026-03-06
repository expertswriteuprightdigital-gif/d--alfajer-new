"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/src/lib/supabase/client";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Alert, AlertDescription } from "@/src/components/ui/alert";
import { Loader2, Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const ADMIN_EMAILS = ['admin@alfajermart.com', 'admin@alfajer.com', 'tabrezkhanloyola@gmail.com', 'orders.alfajermart@gmail.com'];

function isUserAdmin(user: any): boolean {
  const meta = user?.user_metadata;
  const isAdminMeta = meta?.role === 'admin' || meta?.isAdmin === true || meta?.admin === true;
  const email = user?.email?.toLowerCase();
  const isAdminEmail = email ? ADMIN_EMAILS.includes(email) : false;
  return isAdminMeta || isAdminEmail;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isChecking, setIsChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    // Check if already logged in
    const checkSession = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session && isUserAdmin(session.user)) {
          router.push("/admin/dashboard");
          return;
        }
      } catch (error) {
        console.error("Session check error:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password");
      setIsLoading(false);
      return;
    }

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || "Invalid credentials");
        setIsLoading(false);
        return;
      }

      if (!data.user) {
        setError("Login failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Check if user has admin access directly from user metadata
      if (!isUserAdmin(data.user)) {
        await supabase.auth.signOut();
        setError("Access denied. Admin privileges required.");
        setIsLoading(false);
        return;
      }

      toast.success("Login successful!");

      // Wait for session to be fully stored in cookies before navigating
      // This prevents the race condition where the layout can't find the session
      await supabase.auth.getSession(); // Force session to be read & stored
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for cookie propagation

      // Use window.location for a full page navigation to ensure cookies are properly set
      const urlParams = new URLSearchParams(window.location.search);
      const redirect = urlParams.get('redirect') || '/admin/dashboard';
      window.location.href = redirect;
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-[#009744]/30 border-t-[#009744] animate-spin" />
            <ShieldCheck className="absolute inset-0 m-auto h-6 w-6 text-[#009744]" />
          </div>
          <p className="text-sm text-slate-400 font-medium tracking-wide">Verifying session...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 -left-4 w-72 h-72 bg-[#009744] rounded-full mix-blend-multiply filter blur-xl animate-blob" />
          <div className="absolute top-0 -right-4 w-72 h-72 bg-[#AB1F23] rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-2000" />
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-amber-500 rounded-full mix-blend-multiply filter blur-xl animate-blob animation-delay-4000" />
        </div>

        {/* Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {/* Logo */}
            <div className="mb-10">
              <div className="relative w-40 h-40 mx-auto mb-6">
                <Image
                  src="/images/alfajernewlogo.jpeg"
                  alt="Al Fajer Logo"
                  fill
                  className="object-contain rounded-2xl shadow-2xl"
                  priority
                />
              </div>
            </div>

            <h1 className="text-4xl xl:text-5xl font-heading font-bold text-white mb-4 tracking-tight">
              Admin Portal
            </h1>
            <p className="text-lg text-slate-400 max-w-md mx-auto leading-relaxed">
              Manage your products, orders, and customers with our powerful administration dashboard.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-3 mt-10">
              {['Orders', 'Products', 'Customers', 'Analytics'].map((feature, index) => (
                <motion.span
                  key={feature}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm text-slate-300 font-medium"
                >
                  {feature}
                </motion.span>
              ))}
            </div>
          </motion.div>

          {/* Bottom Brand */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="absolute bottom-8 left-12 right-12"
          >
            <div className="flex items-center justify-center gap-3 text-slate-500 text-sm">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure Admin Access</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden mb-10 text-center">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <Image
                src="/images/alfajernewlogo.jpeg"
                alt="Al Fajer Logo"
                fill
                className="object-contain rounded-xl shadow-lg"
                priority
              />
            </div>
            <h1 className="text-2xl font-heading font-bold text-slate-900">Admin Portal</h1>
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-2">
              Welcome Back
            </h2>
            <p className="text-slate-500">
              Sign in to access your admin dashboard
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700 font-medium">
                      {error}
                    </AlertDescription>
                  </Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className={`text-sm font-semibold transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-[#009744]' : 'text-slate-700'
                }`}
              >
                Email Address
              </Label>
              <div className="relative group">
                <Mail className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                  focusedField === 'email' ? 'text-[#009744]' : 'text-slate-400'
                }`} />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@alfajer.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  className="h-14 pl-12 pr-4 text-base border-2 border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-[#009744] focus:ring-2 focus:ring-[#009744]/20 transition-all duration-200"
                  disabled={isLoading}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className={`text-sm font-semibold transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-[#009744]' : 'text-slate-700'
                }`}
              >
                Password
              </Label>
              <div className="relative group">
                <Lock className={`absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors duration-200 ${
                  focusedField === 'password' ? 'text-[#009744]' : 'text-slate-400'
                }`} />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  className="h-14 pl-12 pr-12 text-base border-2 border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:border-[#009744] focus:ring-2 focus:ring-[#009744]/20 transition-all duration-200"
                  disabled={isLoading}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-14 text-base font-semibold bg-gradient-to-r from-[#009744] to-[#00b350] hover:from-[#008339] hover:to-[#009744] text-white rounded-xl shadow-lg shadow-[#009744]/25 hover:shadow-xl hover:shadow-[#009744]/30 transition-all duration-300"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Sign In to Dashboard
                </span>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="mt-10 pt-8 border-t border-slate-100">
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
              <div className="shrink-0 w-10 h-10 flex items-center justify-center bg-[#009744]/10 rounded-lg">
                <ShieldCheck className="w-5 h-5 text-[#009744]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1">Secure Admin Access</p>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Only authorized administrators can access this portal. All login attempts are monitored and logged for security.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-slate-400">
              © {new Date().getFullYear()} Al Fajer. All rights reserved.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Custom Styles for Animations */}
      <style jsx global>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
