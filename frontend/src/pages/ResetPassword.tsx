import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { appVersion } from '@/lib/version';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (!token) return;

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err) {
      if ((err as { status?: number })?.status === 400) {
        setError('Este link expirou ou já foi utilizado. Solicite um novo link.');
      } else {
        setError('Não foi possível redefinir a senha. Tente novamente.');
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
            <span className="opacity-50">Sou</span>{' '}
            <span>Pelvi</span>
          </div>
          <div className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-white/55">
            Gestão clínica
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <h2
          className="text-[36px] leading-[44px] font-semibold text-white max-w-[380px]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.022em' }}
        >
          Cuidando de quem cuida do assoalho pélvico.
        </h2>
      </div>
      <div className="mt-7 flex justify-between text-[11px] text-white/45">
        <span>© 2026 Sou Pelvi · Todos os direitos reservados</span>
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
              Link inválido. Por favor, solicite um novo link de redefinição.
            </p>
            <Link to="/esqueci-senha" className="text-[13px] text-primary font-medium hover:underline">
              Solicitar novo link
            </Link>
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
                  Senha redefinida!
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-2">
                  Sua senha foi alterada com sucesso. Acesse o sistema com sua nova senha.
                </p>
              </div>
              <Link
                to="/login"
                className="text-[13px] text-primary font-medium hover:underline"
              >
                Ir para o login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1
                  className="text-[26px] font-semibold leading-8"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Nova senha
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-1.5">
                  Escolha uma nova senha com no mínimo 6 caracteres.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
                <div>
                  <Label htmlFor="newPassword" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    Nova senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
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
                    Confirmar nova senha
                  </Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    error={!!error}
                    aria-describedby={error ? 'reset-error' : undefined}
                    className="h-[38px]"
                    autoComplete="new-password"
                  />
                </div>

                {error && (
                  <p id="reset-error" role="alert" className="text-sm text-destructive -mt-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 justify-center text-[14px]"
                  style={{ boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.16)' }}
                  loading={loading}
                >
                  {loading ? 'Redefinindo...' : 'Redefinir senha'}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
