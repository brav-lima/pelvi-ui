import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof Textarea> = {
  title: "Primitives/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  argTypes: {
    variant: { control: "select", options: ["default", "error"] },
    error: { control: "boolean" },
    disabled: { control: "boolean" },
  },
  args: { placeholder: "Descreva...", rows: 4 },
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  render: (args) => (
    <div className="space-y-2 w-96">
      <Label htmlFor="default-ta">Observações</Label>
      <Textarea id="default-ta" {...args} />
    </div>
  ),
};

export const Error: Story = {
  args: { error: true, placeholder: "Mínimo 10 caracteres" },
  render: (args) => (
    <div className="space-y-2 w-96">
      <Label htmlFor="error-ta">Evolução *</Label>
      <Textarea id="error-ta" aria-describedby="error-ta-msg" {...args} />
      <p id="error-ta-msg" className="text-sm text-destructive">Descrição deve ter pelo menos 10 caracteres</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true, value: "Conteúdo bloqueado para edição" },
  render: (args) => (
    <div className="space-y-2 w-96">
      <Label htmlFor="disabled-ta">Notas</Label>
      <Textarea id="disabled-ta" {...args} />
    </div>
  ),
};
