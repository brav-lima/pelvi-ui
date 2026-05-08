import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@/components/ui/badge";

const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",
  component: Badge,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "default", "secondary", "destructive", "success", "warning", "info", "outline",
        "soft-success", "soft-warning", "soft-info", "soft-destructive", "soft-muted",
      ],
    },
  },
  args: { children: "Badge" },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const Solid: Story = {
  name: "Solid variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="default">Default</Badge>
      <Badge variant="secondary">Secondary</Badge>
      <Badge variant="destructive">Destructive</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
};

export const Soft: Story = {
  name: "Soft variants",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="soft-success">Success</Badge>
      <Badge variant="soft-warning">Warning</Badge>
      <Badge variant="soft-info">Info</Badge>
      <Badge variant="soft-destructive">Destructive</Badge>
      <Badge variant="soft-muted">Muted</Badge>
    </div>
  ),
};

export const Counter: Story = {
  name: "Counter (com tabular-nums)",
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="soft-info" className="tabular-nums">3</Badge>
      <Badge variant="soft-success" className="tabular-nums">12</Badge>
      <Badge variant="soft-warning" className="tabular-nums">99+</Badge>
      <Badge variant="soft-destructive" className="tabular-nums">2</Badge>
    </div>
  ),
};

export const WhenToUse: Story = {
  name: "Solid vs Soft",
  render: () => (
    <div className="grid grid-cols-2 gap-6 max-w-2xl">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">Solid</p>
        <p className="text-sm">Use para destaque pontual em headers, hero, ou para chamar atenção a um único item.</p>
        <div className="flex gap-2 pt-2">
          <Badge variant="success">Novo</Badge>
        </div>
      </div>
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">Soft</p>
        <p className="text-sm">Use em listagens, tabelas e contadores onde várias instâncias coexistem — não compete por atenção.</p>
        <div className="flex gap-2 pt-2 flex-wrap">
          <Badge variant="soft-success">Pago</Badge>
          <Badge variant="soft-warning">Pendente</Badge>
          <Badge variant="soft-info">Agendado</Badge>
        </div>
      </div>
    </div>
  ),
};
