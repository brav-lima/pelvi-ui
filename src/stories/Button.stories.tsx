import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Button> = {
  title: "Primitives/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "success", "warning", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["sm", "default", "lg", "icon"] },
    loading: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { children: "Button" },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="default">Primary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="success">Success</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Adicionar"><Plus /></Button>
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button><Plus />Novo paciente</Button>
      <Button variant="destructive"><Trash2 />Excluir</Button>
      <Button variant="success"><Check />Confirmar</Button>
      <Button variant="outline">Continuar<Plus /></Button>
    </div>
  ),
};

export const Loading: Story = {
  args: { loading: true, children: "Salvando..." },
};

export const LoadingMatrix: Story = {
  name: "Loading — todas variants",
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button loading>Salvando</Button>
      <Button variant="destructive" loading>Excluindo</Button>
      <Button variant="success" loading>Confirmando</Button>
      <Button variant="outline" loading>Carregando</Button>
      <Button variant="secondary" loading>Aguarde</Button>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};

export const DoAndDont: Story = {
  name: "Do & Don't",
  render: () => (
    <div className="grid grid-cols-2 gap-6 max-w-2xl">
      <div className="border border-success/30 rounded-lg p-4 space-y-2">
        <p className="text-xs font-bold text-success uppercase">✓ Do</p>
        <Button loading>Salvar</Button>
        <p className="text-xs text-muted-foreground">Use a prop <code>loading</code> — spinner + disabled + aria-busy automáticos.</p>
      </div>
      <div className="border border-destructive/30 rounded-lg p-4 space-y-2">
        <p className="text-xs font-bold text-destructive uppercase">✗ Don't</p>
        <Button disabled>⏳ Salvando…</Button>
        <p className="text-xs text-muted-foreground">Não emule loading manual com disabled + texto. Falta a11y (aria-busy) e visual.</p>
      </div>
    </div>
  ),
};
