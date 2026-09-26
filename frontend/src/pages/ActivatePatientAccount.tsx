import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { patientPortalApi } from '@/lib/api';
import { appVersion } from '@/lib/version';
import { Eye, EyeOff, CheckCircle2, CalendarCheck, NotebookPen, TrendingUp } from 'lucide-react';

const PATIENT_APP_HIGHLIGHTS = [
  { icon: CalendarCheck, label: 'Consultas e agenda da sua clínica' },
  { icon: NotebookPen, label: 'Diário miccional e evacuatório' },
  { icon: TrendingUp, label: 'Evolução do seu tratamento' },
];

export default function ActivatePatientAccount() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      await patientPortalApi.activate(token, password);
      setSuccess(true);
    } catch (err) {
      if ((err as { status?: number })?.status === 400) {
        setError('Este convite expirou ou já foi utilizado. Peça um novo convite à sua clínica.');
      } else {
        setError('Não foi possível ativar sua conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const brandPanel = (
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
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <img src="/brand/icon-white.png" alt="soupelvi" className="w-[18px] h-[18px] object-contain" />
        </div>
        <div>
          <div
            className="font-semibold text-[15px] leading-5 text-white"
            style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.012em' }}
          >
            <span className="opacity-50">sou</span><span>pelvi</span>
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-white/55">
            App da paciente
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <h2
          className="text-[36px] leading-[44px] font-semibold text-white max-w-[380px]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
        >
          Seu tratamento, sempre por perto.
        </h2>
        <ul className="mt-6 flex flex-col gap-3">
          {PATIENT_APP_HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-[13.5px] text-white/80">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/10 shrink-0">
                <Icon className="w-3.5 h-3.5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-7 flex justify-between text-[11px] text-white/45">
        <span>© 2026 soupelvi · Todos os direitos reservados</span>
        <span>v{appVersion}</span>
      </div>
    </div>
  );

  if (!token) {
    return (
      <div className="min-h-screen grid md:grid-cols-2 bg-background">
        {brandPanel}
        <div className="flex items-center justify-center p-9 bg-card">
          <div className="w-full max-w-[380px] text-center flex flex-col gap-4">
            <p className="text-muted-foreground text-[14px]">
              Link inválido. Peça um novo convite à sua clínica.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      {brandPanel}
      <div className="flex items-center justify-center p-9 bg-card">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px] animate-fade-in">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <CheckCircle2 className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1
                  className="text-[22px] font-semibold leading-7"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Conta ativada!
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-2">
                  Sua senha foi definida. Baixe o app soupelvi e entre com seu CPF.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h1
                  className="text-[26px] font-semibold leading-8"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Ative sua conta
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-1.5">
                  Sua clínica te convidou para acompanhar seu tratamento pelo app soupelvi.
                  Defina uma senha com no mínimo 6 caracteres para continuar.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
                <div>
                  <Label htmlFor="password" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      error={!!error}
                      className="h-[38px] pr-10"
                      autoComplete="new-password"
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

                <div>
                  <Label htmlFor="confirmPassword" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    Confirmar senha
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    error={!!error}
                    aria-describedby={error ? 'activate-error' : undefined}
                    className="h-[38px]"
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p id="activate-error" role="alert" className="text-sm text-destructive -mt-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 justify-center text-[14px]"
                  style={{ boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.16)' }}
                  loading={loading}
                >
                  {loading ? 'Ativando...' : 'Ativar conta'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
