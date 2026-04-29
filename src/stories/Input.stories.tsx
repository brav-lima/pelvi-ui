import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Input> = {
  title: "Primitives/Input",
  component: Input,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "error"] },
    error: { control: "boolean" },
    disabled: { control: "boolean" },
    type: { control: "text" },
  },
  args: { placeholder: "Digite aqui..." },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="default-input">Nome</Label>
      <Input id="default-input" {...args} />
    </div>
  ),
};

export const Error: Story = {
  args: { error: true, placeholder: "email@exemplo.com" },
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="error-input">Email</Label>
      <Input id="error-input" aria-describedby="error-input-msg" {...args} />
      <p id="error-input-msg" className="text-sm text-destructive">Email inválido</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: "Não editável" },
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="disabled-input">Campo bloqueado</Label>
      <Input id="disabled-input" {...args} readOnly />
    </div>
  ),
};

export const TabularNums: Story = {
  name: "Tabular nums (currency, CPF)",
  render: () => (
    <div className="space-y-4 w-72">
      <div className="space-y-2">
        <Label htmlFor="cpf-input">CPF</Label>
        <Input
          id="cpf-input"
          placeholder="000.000.000-00"
          inputMode="numeric"
          className="tabular-nums"
          defaultValue="123.456.789-00"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount-input">Valor (R$)</Label>
        <Input
          id="amount-input"
          placeholder="0,00"
          inputMode="decimal"
          className="tabular-nums"
          defaultValue="1.234,56"
        />
      </div>
    </div>
  ),
};

export const Types: Story = {
  name: "Tipos comuns",
  render: () => (
    <div className="space-y-4 w-72">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="email@exemplo.com" autoComplete="email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" autoComplete="current-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="date">Data</Label>
        <Input id="date" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="search">Buscar</Label>
        <Input id="search" type="search" placeholder="Buscar paciente..." />
      </div>
    </div>
  ),
};
