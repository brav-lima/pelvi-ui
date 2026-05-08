import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const meta: Meta<typeof SelectTrigger> = {
  title: "Primitives/Select",
  component: SelectTrigger,
  tags: ["autodocs"],
  argTypes: {
    error: { control: "boolean" },
    disabled: { control: "boolean" },
  },
};

export default meta;
type Story = StoryObj<typeof SelectTrigger>;

export const Default: Story = {
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="default-select">Cargo</Label>
      <Select>
        <SelectTrigger id="default-select" {...args}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ADMIN">Admin</SelectItem>
          <SelectItem value="PROFESSIONAL">Profissional</SelectItem>
          <SelectItem value="RECEPTIONIST">Recepção</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const Error: Story = {
  args: { error: true },
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="error-select">Profissional *</Label>
      <Select>
        <SelectTrigger id="error-select" aria-describedby="error-select-msg" {...args}>
          <SelectValue placeholder="Selecione um profissional" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Maria Silva</SelectItem>
          <SelectItem value="2">João Souza</SelectItem>
        </SelectContent>
      </Select>
      <p id="error-select-msg" className="text-sm text-destructive">Selecione um profissional</p>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div className="space-y-2 w-72">
      <Label htmlFor="disabled-select">Plano</Label>
      <Select disabled>
        <SelectTrigger id="disabled-select" {...args}>
          <SelectValue placeholder="Plano gratuito" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="free">Gratuito</SelectItem>
          <SelectItem value="pro">Pro</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};
