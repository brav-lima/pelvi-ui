import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { aiApi } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Sparkles, Loader2, Copy, Check, AlertCircle } from 'lucide-react';

interface Props {
  patientId: string;
  patientName: string;
}

export function AiAnalysisButton({ patientId, patientName }: Props) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: () => aiApi.analyzePatient(patientId),
    onSuccess: (data) => {
      setAnalysis(data.analysis);
      setOpen(true);
    },
    onError: (err: Error) => {
      const msg = err?.message ?? 'Erro ao gerar análise';
      toast.error(msg);
    },
  });

  const handleOpen = () => {
    setAnalysis(null);
    setOpen(true);
    mutation.mutate();
  };

  const handleCopy = async () => {
    if (!analysis) return;
    await navigator.clipboard.writeText(analysis);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpen} disabled={mutation.isPending}>
        {mutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        Analisar com IA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Análise Clínica — {patientName}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-2">
            {mutation.isPending && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm">Gerando análise com IA...</p>
              </div>
            )}

            {mutation.isError && (
              <div className="flex flex-col items-center gap-2 py-12 text-destructive">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm text-center">
                  {(mutation.error as Error)?.message ?? 'Não foi possível gerar a análise.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => mutation.mutate()}>
                  Tentar novamente
                </Button>
              </div>
            )}

            {analysis && (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <AnalysisContent text={analysis} />
              </div>
            )}
          </div>

          {analysis && (
            <div className="flex justify-end pt-3 border-t">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <><Check className="w-4 h-4 mr-2 text-success" />Copiado</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" />Copiar análise</>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AnalysisContent({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (/^\*\*\d+\./.test(line) || /^##/.test(line)) {
          const clean = line.replace(/^\*\*/, '').replace(/\*\*$/, '').replace(/^##+ ?/, '');
          return (
            <h3 key={i} className="font-semibold text-base mt-4 mb-1 text-foreground">
              {clean}
            </h3>
          );
        }
        if (line.startsWith('*Atenção')) {
          return (
            <p key={i} className="text-xs text-muted-foreground italic border-t pt-3 mt-3">
              {line.replace(/\*/g, '')}
            </p>
          );
        }
        if (line.trim() === '---') {
          return <hr key={i} className="my-3" />;
        }
        if (line.trim() === '') {
          return <div key={i} className="h-1" />;
        }
        const formatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return (
          <p
            key={i}
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: formatted }}
          />
        );
      })}
    </div>
  );
}
