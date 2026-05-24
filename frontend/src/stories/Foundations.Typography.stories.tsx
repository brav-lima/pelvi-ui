import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = {
  title: "Foundations/Typography",
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj;

const SPECIMENS: Array<{ name: string; classes: string; sample: string }> = [
  { name: "Display / H1",    classes: "text-3xl font-bold",      sample: "Sou Pelvi — Sistema de Gestão" },
  { name: "Heading / H2",    classes: "text-2xl font-bold",      sample: "Página padrão (PageHeader)" },
  { name: "Heading / H3",    classes: "text-xl font-semibold",   sample: "Subtítulo de seção" },
  { name: "Heading / H4",    classes: "text-lg font-semibold",   sample: "Título de Card" },
  { name: "Body / Large",    classes: "text-base",               sample: "Corpo grande para leitura confortável" },
  { name: "Body / Base",     classes: "text-sm",                 sample: "Corpo padrão usado em forms e tabelas" },
  { name: "Body / Small",    classes: "text-xs",                 sample: "Helper text e captions" },
  { name: "Label / Default", classes: "text-sm font-medium",     sample: "Label de campo de formulário" },
  { name: "Label / Small",   classes: "text-xs font-medium",     sample: "Label compacto" },
];

export const Scale: Story = {
  render: () => (
    <div className="space-y-6 max-w-2xl">
      {SPECIMENS.map((s) => (
        <div key={s.name} className="grid grid-cols-[160px_1fr] items-baseline gap-6 border-b border-border pb-3">
          <span className="text-xs font-medium text-muted-foreground">{s.name}</span>
          <span className={s.classes}>{s.sample}</span>
        </div>
      ))}
    </div>
  ),
};

export const TabularNums: Story = {
  name: "Tabular numerals",
  render: () => (
    <div className="space-y-4 max-w-md">
      <p className="text-sm text-muted-foreground">
        Sem <code className="text-xs">tabular-nums</code> — números proporcionais (não alinham):
      </p>
      <div className="font-mono text-sm space-y-1">
        <p>R$ 1.234,56</p>
        <p>R$ 12.345,67</p>
        <p>R$ 123.456,78</p>
      </div>

      <p className="text-sm text-muted-foreground pt-4">
        Com <code className="text-xs">tabular-nums</code> — alinhamento perfeito coluna a coluna:
      </p>
      <div className="text-sm space-y-1 tabular-nums text-right">
        <p>R$ 1.234,56</p>
        <p>R$ 12.345,67</p>
        <p>R$ 123.456,78</p>
      </div>
    </div>
  ),
};
