import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Eye, EyeOff, Wand2, Layers } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import authBg1 from "@/assets/auth-bg-1.jpg";
import authBg2 from "@/assets/auth-bg-2.jpg";
import authBg3 from "@/assets/auth-bg-3.jpg";

const Auth = () => {
  const { t } = useTranslation();

  const slides = [
    { src: authBg1, label: t("auth.graphicProduction"), subtitle: t("auth.graphicProductionDesc") },
    { src: authBg2, label: t("auth.creativePlanning"), subtitle: t("auth.creativePlanningDesc") },
    { src: authBg3, label: t("auth.showcaseAssembly"), subtitle: t("auth.showcaseAssemblyDesc") },
  ];

  const hasInvite = (() => {
    const params = new URLSearchParams(window.location.search);
    return !!params.get("invite");
  })();
  const [isLogin, setIsLogin] = useState(!hasInvite);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [magicLink, setMagicLink] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get("invite");
    if (inviteToken) {
      localStorage.setItem("invite_token", inviteToken);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (magicLink) {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin }
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else toast.success(t("auth.magicLinkSent"));
      return;
    }

    if (forgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else {
        toast.success(t("auth.recoveryEmailSent"));
        setForgotPassword(false);
      }
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) toast.error(t("auth.incorrectCredentials"));
      else navigate("/");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin
        }
      });
      setLoading(false);
      if (error) toast.error(error.message);
      else toast.success(t("auth.accountCreated"));
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Image carousel (hidden on mobile) */}
      <div className="hidden xl:flex xl:w-1/2 relative overflow-hidden">
        {slides.map((slide, i) =>
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: currentSlide === i ? 1 : 0 }}>
            <img
            src={slide.src}
            alt={slide.label}
            className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-10 z-10">
          <p className="text-white/80 text-sm font-medium uppercase tracking-widest mb-2">
            <span>{slides[currentSlide].label}</span>
          </p>
          <h2 className="text-white text-3xl font-display font-bold leading-tight">
            <span>{slides[currentSlide].subtitle}</span>
          </h2>
          <div className="flex gap-2 mt-6">
            {slides.map((_, i) =>
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
              currentSlide === i ? "w-8 bg-white" : "w-3 bg-white/40"}`} />
            )}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-accent/10 p-6 sm:p-10 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle className="h-9 w-9 bg-card text-foreground border-border hover:bg-accent" />
        </div>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div
              className="w-[72px] h-[72px] rounded-[18px] flex items-center justify-center mx-auto mb-4 shadow-xl"
              style={{ background: "#8C6F4E" }}
            >
              <Layers className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              ProduzAI
            </h1>
            <span
              className="inline-block mt-1 rounded-full"
              style={{
                background: "var(--brand-100)", color: "var(--brand-700)",
                fontSize: 10, fontWeight: 600, padding: "2px 8px",
                letterSpacing: "0.04em",
              }}
            >
              V2.0
            </span>
            <p className="text-sm text-muted-foreground mt-2">
              {t("auth.creativeProductionControl")}
            </p>
          </div>

          <div className="bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-display font-bold text-foreground mb-1">
              {magicLink ? t("auth.magicLink") : forgotPassword ? t("auth.recoverPassword") : isLogin ? t("auth.login") : t("common.createAccount")}
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              {magicLink
                ? t("auth.magicLinkDesc")
                : forgotPassword
                ? t("auth.recoverPasswordDesc")
                : isLogin
                ? t("auth.accessPlatform")
                : t("auth.createYourAccount")}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && !forgotPassword && !magicLink &&
              <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    {t("auth.whatIsYourName")}
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                    placeholder={t("auth.namePlaceholder")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                    required={!isLogin} />
                  </div>
                </div>
              }
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required />
              </div>
              {!forgotPassword && !magicLink &&
              <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.password")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6} />
                  <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              }
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                ? t("common.wait")
                : magicLink
                ? t("auth.sendMagicLink")
                : forgotPassword
                ? t("common.sendLink")
                : isLogin
                ? t("auth.login")
                : t("common.createAccount")}
              </Button>
            </form>

            {!forgotPassword && !magicLink &&
            <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t("common.or")}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={loading}
                    onClick={() => { setMagicLink(true); setForgotPassword(false); }}>
                    <Wand2 className="w-4 h-4" />
                    {t("auth.magicLink")}
                  </Button>
                  <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  disabled={loading}
                  onClick={async () => {
                    const { error } = await lovable.auth.signInWithOAuth("google", {
                      redirect_uri: window.location.origin
                    });
                    if (error) toast.error(t("auth.googleError"));
                  }}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    {t("auth.continueWithGoogle")}
                  </Button>
                </div>
              </>
            }

            <div className="mt-4 space-y-2 text-center">
              {isLogin && !forgotPassword && !magicLink && (
                <div className="mb-2">
                   <a
                    href="/instalador"
                    className="hover:underline flex items-center justify-center gap-1.5"
                    style={{ fontSize: 13, color: "var(--brand-600)" }}
                  >
                    🔑 {t("auth.enterAsInstaller")}
                  </a>
                </div>
              )}
              {!forgotPassword && !magicLink && isLogin &&
              <button
                onClick={() => setForgotPassword(true)}
                className="text-sm text-primary hover:underline">
                  {t("auth.forgotMyPassword")}
                </button>
              }
              {hasInvite && !magicLink && (
                <div>
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setForgotPassword(false);
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground">
                    {isLogin ? t("auth.noAccount") : t("auth.hasAccount")}
                  </button>
                </div>
              )}
              {(forgotPassword || magicLink) &&
              <button
                onClick={() => { setForgotPassword(false); setMagicLink(false); }}
                className="text-sm text-muted-foreground hover:text-foreground">
                  {t("auth.backToPasswordLogin")}
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>);
};

export default Auth;
