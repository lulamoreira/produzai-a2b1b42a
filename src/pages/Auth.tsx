import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, Mail, Lock, User, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (forgotPassword) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Email de recuperação enviado! Verifique sua caixa de entrada.");
        setForgotPassword(false);
      }
      return;
    }

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        toast.error("Email ou senha incorretos.");
      } else {
        navigate("/");
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });
      setLoading(false);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Conta criada! Verifique seu email para confirmar.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/20">
            <Package className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Lindt Excellence Pistache
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Campanha Brasil 2026</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-display font-bold text-foreground mb-1">
            {forgotPassword ? "Recuperar Senha" : isLogin ? "Entrar" : "Criar Conta"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {forgotPassword
              ? "Informe seu email para receber o link de recuperação"
              : isLogin
              ? "Acesse o painel de controle da campanha"
              : "Crie sua conta para gerenciar a campanha"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && !forgotPassword && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome de exibição"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10"
                  required={!isLogin}
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>

            {!forgotPassword && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Aguarde..."
                : forgotPassword
                ? "Enviar Link"
                : isLogin
                ? "Entrar"
                : "Criar Conta"}
            </Button>
          </form>

          <div className="mt-4 space-y-2 text-center">
            {!forgotPassword && isLogin && (
              <button
                onClick={() => setForgotPassword(true)}
                className="text-sm text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            )}

            <div>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setForgotPassword(false);
                }}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </button>
            </div>

            {forgotPassword && (
              <button
                onClick={() => setForgotPassword(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Voltar ao login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
