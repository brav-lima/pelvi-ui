import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff } from 'lucide-react';
import { maskCPF } from '@/lib/formatters';
import { appVersion } from '@/lib/version';

export default function Login() {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(cpf, password);
      if (result.success) {
        navigate(result.multiClinic ? '/select-clinic' : '/dashboard');
      } else {
        setError(result.error || 'CPF ou senha inválidos');
      }
    } catch {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {/* Left — brand panel */}
      <div
        className="hidden md:flex flex-col p-10 text-white relative overflow-hidden"
        style={{
          background: `
            radial-gradient(120% 80% at 100% 0%, hsl(296 38% 35% / 0.55), transparent 60%),
            radial-gradient(80% 60% at 0% 100%, hsl(280 32% 45% / 0.45), transparent 60%),
            linear-gradient(160deg, hsl(296 32% 22%) 0%, hsl(290 22% 10%) 100%)
          `,
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg font-bold text-sm text-white shrink-0"
            style={{
              background: 'rgba(255,255,255,0.12)',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.02em',
            }}
          >
            P
          </div>
          <div>
            <div
              className="font-semibold text-[15px] leading-5 text-white"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.012em' }}
            >
              Pelvi
            </div>
            <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-white/55">
              Gestão clínica
            </div>
          </div>
        </div>

        {/* Hero copy — bottom aligned */}
        <div className="mt-auto">
          <h2
            className="text-[36px] leading-[44px] font-semibold text-white max-w-[380px]"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
          >
            Cuidando de quem cuida do assoalho pélvico.
          </h2>
        </div>

        {/* Footer */}
        <div className="mt-7 flex justify-between text-[11px] text-white/45">
          <span>© 2026 Pelvi · Todos os direitos reservados</span>
          <span>v{appVersion}</span>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex items-center justify-center p-9 bg-card">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px] animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-2 md:hidden">
            <div
              className="flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg mb-3"
              style={{ background: 'hsl(var(--primary))', fontFamily: 'var(--font-display)' }}
            >
              P
            </div>
            <p className="text-muted-foreground text-sm">Gestão clínica</p>
          </div>

          <div>
            <h1
              className="text-[26px] font-semibold leading-8"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
            >
              Bem-vinda de volta
            </h1>
            <p className="text-[13.5px] text-muted-foreground mt-1.5">
              Acesse sua clínica com seu CPF.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
            <div>
              <Label htmlFor="cpf" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                CPF
              </Label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(maskCPF(e.target.value))}
                required
                error={!!error}
                aria-describedby={error ? 'login-error' : undefined}
                className="h-[38px] font-mono"
                autoComplete="username"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <Label htmlFor="password" className="text-[12px] font-medium text-foreground/80">
                  Senha
                </Label>
                <a href="#" className="text-[12px] text-primary font-medium hover:underline">
                  Esqueci minha senha
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  error={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  className="h-[38px] pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p id="login-error" role="alert" className="text-sm text-destructive -mt-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-10 justify-center text-[14px]"
              style={{ boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.16)' }}
              loading={loading}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}
