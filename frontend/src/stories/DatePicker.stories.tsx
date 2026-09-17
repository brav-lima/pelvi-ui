import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof DatePicker> = {
  title: "Primitives/DatePicker",
  component: DatePicker,
  tags: ["autodocs"],
  argTypes: {
    disabled: { control: "boolean" },
    error: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

function Controlled(props: Partial<React.ComponentProps<typeof DatePicker>>) {
  const [value, setValue] = useState<string | undefined>(props.value);
  return (
    <div className="space-y-2 w-72">
      <Label htmlFor="date-picker-demo">Data</Label>
      <DatePicker id="date-picker-demo" {...props} value={value} onChange={setValue} />
    </div>
  );
}

export const Default: Story = {
  render: () => <Controlled />,
};

export const ComValor: Story = {
  name: "Com valor selecionado",
  render: () => <Controlled value="2026-03-05" />,
};

export const Erro: Story = {
  name: "Estado de erro",
  render: () => (
    <div className="space-y-2 w-72">
      <Controlled error />
      <p className="text-sm text-destructive">Selecione uma data</p>
    </div>
  ),
};

export const Desabilitado: Story = {
  render: () => <Controlled value="2026-03-05" disabled />,
};

export const DataMaxima: Story = {
  name: "Com data máxima (hoje)",
  render: () => <Controlled maxDate={new Date()} />,
};
