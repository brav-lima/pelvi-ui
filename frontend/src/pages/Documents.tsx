import { useState, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { useHasRole } from '@/components/auth/RoleGuard';
import { documentsApi, openPdfBlob, type ClinicDocument } from '@/lib/api';
import { toast } from 'sonner';
import {
  FileText,
  Download,
  Trash2,
  Upload,
  Loader2,
  Search,
  Shield,
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  Avaliação: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  Consentimento: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  Orientação: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  Diário: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

function categoryBadge(category: string | null) {
  if (!category) return null;
  const cls = CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{category}</span>;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadDialog({ open, onClose, onSuccess }: UploadDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setCategory('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (!file) { toast.error('Selecione um arquivo PDF'); return; }
    if (file.type !== 'application/pdf') { toast.error('Somente arquivos PDF são aceitos'); return; }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (category.trim()) formData.append('category', category.trim());

      await documentsApi.upload(formData);
      toast.success('Documento enviado com sucesso');
      reset();
      onSuccess();
      onClose();
    } catch {
      toast.error('Erro ao enviar documento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar Documento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nome *</label>
            <Input
              placeholder="Ex.: Diário Miccional"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Descrição</label>
            <Input
              placeholder="Descrição breve do documento"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Categoria</label>
            <Input
              placeholder="Ex.: Avaliação, Consentimento"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              maxLength={60}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Arquivo PDF *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} ({formatBytes(file.size)})
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Documents() {
  const queryClient = useQueryClient();
  const isAdmin = useHasRole('ADMIN');
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: documentsApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Documento removido');
    },
    onError: () => toast.error('Erro ao remover documento'),
  });

  const handleDownload = async (doc: ClinicDocument) => {
    setDownloading(doc.id);
    try {
      const blob = await documentsApi.download(doc.id);
      openPdfBlob(blob);
    } catch {
      toast.error('Erro ao baixar documento');
    } finally {
      setDownloading(null);
    }
  };

  const filtered = documents.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q) ||
      (d.category ?? '').toLowerCase().includes(q)
    );
  });

  const systemDocs = filtered.filter((d) => d.organizationId === null);
  const clinicDocs = filtered.filter((d) => d.organizationId !== null);

  return (
    <div className="p-6">
      <PageHeader
        title="Documentos"
        description="Arquivos padrão e documentos da clínica disponíveis para pacientes."
        actions={
          isAdmin ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Enviar documento
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar documentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <EmptyState
          icon={FileText}
          title="Nenhum documento encontrado"
          description={
            search
              ? 'Tente buscar com outros termos.'
              : isAdmin
              ? 'Envie o primeiro documento da clínica.'
              : 'Nenhum documento disponível no momento.'
          }
          action={isAdmin && !search ? { label: 'Enviar documento', onClick: () => setUploadOpen(true) } : undefined}
        />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-6">
          {systemDocs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Padrão Pelvi
                </h2>
              </div>
              <DocumentList
                documents={systemDocs}
                isAdmin={false}
                downloading={downloading}
                onDownload={handleDownload}
                onDelete={() => {}}
              />
            </section>
          )}

          {clinicDocs.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Documentos da Clínica
                </h2>
              </div>
              <DocumentList
                documents={clinicDocs}
                isAdmin={isAdmin}
                downloading={downloading}
                onDownload={handleDownload}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            </section>
          )}
        </div>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['documents'] })}
      />
    </div>
  );
}

interface DocumentListProps {
  documents: ClinicDocument[];
  isAdmin: boolean;
  downloading: string | null;
  onDownload: (doc: ClinicDocument) => void;
  onDelete: (id: string) => void;
}

function DocumentList({ documents, isAdmin, downloading, onDownload, onDelete }: DocumentListProps) {
  return (
    <div className="border rounded-lg divide-y bg-card">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-start gap-4 px-4 py-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted shrink-0 mt-0.5">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm truncate">{doc.name}</span>
              {categoryBadge(doc.category)}
              {doc.organizationId === null && (
                <Badge variant="outline" className="text-xs">Sistema</Badge>
              )}
            </div>
            {doc.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{doc.description}</p>
            )}
            {doc.fileSize ? (
              <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(doc.fileSize)}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDownload(doc)}
              disabled={downloading === doc.id}
              title="Baixar"
            >
              {downloading === doc.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </Button>

            {isAdmin && doc.organizationId !== null && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" title="Remover">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover documento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      O documento <strong>{doc.name}</strong> será removido da clínica. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(doc.id)}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
