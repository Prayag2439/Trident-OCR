import { useState, useEffect } from "react";
import { login } from "@/utils/api";
import { useToast } from "@/components/ToastProvider";
import { Lock, Mail, Loader2, ArrowRight, Download } from "lucide-react";
import { motion } from "framer-motion";

export function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { showAlert } = useToast();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
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
      showAlert("Login successful", "success");
      onLogin();
    } catch (err: any) {
      showAlert(err.message || "Invalid email or password", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative">
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-sm w-full bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden"
      >
        <div className="pt-10 pb-6 px-8 text-center flex flex-col items-center">
          <img 
            src="https://optimo360.com/wp-content/themes/optimo360-blocksy/optimo360-lockup-color.svg" 
            alt="Optimo360 Logo" 
            className="h-10 w-auto mb-6"
          />
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">Log in to your account</h2>
          <p className="text-gray-500 text-sm mt-1.5">Welcome back! Please enter your details.</p>
        </div>

        <form onSubmit={handleLogin} className="px-8 pb-10 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 focus:border-[#1a237e] transition-colors placeholder-gray-400"
                placeholder="admin@optimo.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 focus:border-[#1a237e] transition-colors placeholder-gray-400"
                placeholder="••••••••"
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
