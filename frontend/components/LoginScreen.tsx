import { useState, useEffect } from "react";
import { login } from "@/utils/api";
import { useToast } from "@/components/ToastProvider";
import { Loader2, Download } from "lucide-react";
import { motion } from "framer-motion";
import { AuthUser } from "@/types/ocr";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function LoginScreen({ onLogin }: { onLogin: (user?: AuthUser | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { showAlert } = useToast();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showAlert("Please enter both email and password", "error");
      return;
    }

    setLoading(true);
    try {
      const { token } = await login(email, password);
      localStorage.setItem("trident_auth_token", token);
      let userObj: AuthUser | null = null;
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        userObj = { email: payload.sub, name: payload.name, role: payload.role };
        localStorage.setItem("trident_user", JSON.stringify(userObj));
      } catch {
        const name = email.split('@')[0];
        userObj = { email, name: name.charAt(0).toUpperCase() + name.slice(1), role: email.includes("admin") ? "admin" : "employee" };
        localStorage.setItem("trident_user", JSON.stringify(userObj));
      }
      showAlert("Login successful", "success");
      onLogin(userObj);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid email or password";
      showAlert(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-sm w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden"
      >
        <div className="pt-10 pb-6 px-8 text-center flex flex-col items-center">
          <img 
            src="https://optimo360.com/wp-content/themes/optimo360-blocksy/optimo360-lockup-color.svg" 
            alt="Optimo360" 
            className="h-10 w-auto mb-6"
          />
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Log in to your account</h2>
          <p className="text-gray-500 text-sm mt-1.5">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleLogin} className="px-8 pb-10 space-y-5">
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 focus:border-[#1a237e] transition-colors placeholder-gray-400"
                placeholder="admin@optimo.com"
                aria-label="Email address"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 focus:border-[#1a237e] transition-colors placeholder-gray-400"
                placeholder="••••••••"
                aria-label="Password"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-[#1a237e] hover:bg-[#151c66] text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (deferredPrompt) {
                  handleInstallClick();
                } else {
                  showAlert("Automatic install not ready. Please click the Install icon (↓) in your address bar or select 'Install App' from your browser menu.", "info");
                }
              }}
              className="w-full py-2.5 px-4 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              Install PWA App
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
