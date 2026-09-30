import { format } from 'date-fns';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Anamnesis, AnamnesisType } from '@/types/clinic';
import { ANAMNESIS_FORMS, ANAMNESIS_TYPE_LABELS, getSections } from './anamnesis-forms';
import { asGestationalData, asUltrasound } from './gestational-data';
import { LegacyAnamnesisView } from './LegacyAnamnesisView';
import { ObstetricSummary } from './ObstetricSummary';

function dateOf(a: Anamnesis): string {
  return a.assessmentDate
    ? a.assessmentDate.slice(0, 10).split('-').reverse().join('/')
    : format(new Date(a.createdAt), 'dd/MM/yyyy');
}

function FilledSections({ anamnesis }: { anamnesis: Anamnesis & { type: AnamnesisType } }) {
  const sections = getSections(anamnesis.data);
  const filled = ANAMNESIS_FORMS[anamnesis.type].filter(
    (def) => def.kind === 'narrative' && typeof sections[def.id] === 'string' && (sections[def.id] as string).trim() !== '',
  );
  const isPregnancy = anamnesis.type === 'PREGNANCY';

  if (filled.length === 0 && !isPregnancy) {
    return <p className="text-[13px] text-muted-foreground">Nenhum conteúdo registrado</p>;
  }

  return (
    <div className="space-y-3">
      {isPregnancy && (
        <ObstetricSummary
          gestational={asGestationalData(sections.gestationalData)}
          ultrasound={asUltrasound(sections.ultrasound)}
          assessmentDate={anamnesis.assessmentDate?.slice(0, 10) ?? anamnesis.createdAt.slice(0, 10)}
        />
      )}
      {filled.length === 0 && <p className="text-[13px] text-muted-foreground">Nenhum conteúdo registrado</p>}
      {filled.map((def) => (
        <div key={def.id} className="p-3 rounded-lg bg-secondary/50">
          <p className="text-[12px] text-muted-foreground">{def.title}</p>
          <p className="text-[13px] font-medium mt-1 whitespace-pre-wrap">{sections[def.id] as string}</p>
        </div>
      ))}
    </div>
  );
}

export function AnamnesisTab({
  anamneses, onCreate, onOpen, onDelete,
}: {
  anamneses: Anamnesis[];
  onCreate: (type: AnamnesisType) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap p-4 border-b border-border">
        <div className="text-[14px] font-semibold" style={{ fontFamily: 'var(--font-display)' }}>Anamnese</div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onCreate('PELVIC_GENERAL')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Pélvica geral
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCreate('PREGNANCY')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Gestacional
          </Button>
        </div>
      </div>
      <CardContent className="p-4">
        {anamneses.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground text-center py-8">Nenhuma avaliação registrada</p>
        ) : (
          <div className="space-y-6">
            {anamneses.map((a) => {
              const isLegacy = a.type === null;
              // Legacy rows (type null) are preserved clinical history: never deletable, always shown as finalized.
              const isFinalized = isLegacy || a.status === 'COMPLETED';
              const canDelete = !isLegacy && a.status !== 'COMPLETED';
              return (
                <div key={a.id} data-testid={`anamnesis-${a.id}`} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-semibold">
                          {isLegacy ? 'Formato anterior' : ANAMNESIS_TYPE_LABELS[a.type as AnamnesisType]}
                        </span>
                        <span
                          className={
                            isFinalized
                              ? 'text-[11px] font-medium rounded-full px-2 py-0.5 bg-primary/10 text-primary'
                              : 'text-[11px] font-medium rounded-full px-2 py-0.5 bg-secondary text-muted-foreground'
                          }
                        >
                          {isFinalized ? 'Finalizada' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-[12.5px] text-muted-foreground">
                        {dateOf(a)}
                        {a.professional?.person?.name && ` · ${a.professional.person.name}`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => onOpen(a.id)}>
                        {isLegacy ? <Eye className="w-3.5 h-3.5 mr-1" /> : <Edit className="w-3.5 h-3.5 mr-1" />}
                        {isLegacy ? 'Visualizar' : 'Editar'}
                      </Button>
                      {canDelete && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label="Excluir"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir rascunho</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. O rascunho será permanentemente excluído.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => onDelete(a.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                  {isLegacy ? (
                    <LegacyAnamnesisView data={a.data} />
                  ) : (
                    <FilledSections anamnesis={a as Anamnesis & { type: AnamnesisType }} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
