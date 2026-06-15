import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api';
import { appVersion } from '@/lib/version';
import { ArrowLeft, MailCheck } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
    } catch {
      setError('Não foi possível processar sua solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
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

      <div className="flex items-center justify-center p-9 bg-card">
        <div className="w-full max-w-[380px] flex flex-col gap-[18px] animate-fade-in">
          {success ? (
            <div className="flex flex-col items-center text-center gap-4 py-6">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
                <MailCheck className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1
                  className="text-[22px] font-semibold leading-7"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Verifique seu e-mail
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-2">
                  Se o endereço <strong>{email}</strong> estiver cadastrado, você receberá
                  as instruções para redefinir sua senha em breve.
                </p>
              </div>
              <Link
                to="/login"
                className="text-[13px] text-primary font-medium hover:underline flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <h1
                  className="text-[26px] font-semibold leading-8"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.018em' }}
                >
                  Esqueci minha senha
                </h1>
                <p className="text-[13.5px] text-muted-foreground mt-1.5">
                  Informe seu e-mail cadastrado e enviaremos um link para redefinir sua senha.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]" noValidate>
                <div>
                  <Label htmlFor="email" className="text-[12px] font-medium text-foreground/80 mb-1.5 block">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    error={!!error}
                    aria-describedby={error ? 'forgot-error' : undefined}
                    className="h-[38px]"
                    autoComplete="email"
                  />
                </div>

                {error && (
                  <p id="forgot-error" role="alert" className="text-sm text-destructive -mt-2">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="h-10 justify-center text-[14px]"
                  style={{ boxShadow: 'var(--shadow-brand), inset 0 1px 0 rgba(255,255,255,0.16)' }}
                  loading={loading}
                >
                  {loading ? 'Enviando...' : 'Enviar instruções'}
                </Button>
              </form>

              <Link
                to="/login"
                className="text-[13px] text-primary font-medium hover:underline flex items-center gap-1.5 justify-center"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
