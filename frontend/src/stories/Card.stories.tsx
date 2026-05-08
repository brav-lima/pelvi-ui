import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof Card> = {
  title: "Composite/Card",
  component: Card,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Maria Silva</CardTitle>
        <CardDescription>Paciente desde 12/03/2024</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Próxima consulta agendada para 28/04/2026 às 14:00.
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Ver perfil</Button>
        <Button size="sm" variant="outline">Cancelar</Button>
      </CardFooter>
    </Card>
  ),
};

export const HeaderOnly: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Resumo do mês</CardTitle>
        <CardDescription>Abril de 2026</CardDescription>
      </CardHeader>
    </Card>
  ),
};

export const Plain: Story = {
  render: () => (
    <Card className="w-80 p-6">
      <p className="text-sm">Card sem CardHeader/CardContent — apenas um container com border + shadow-1.</p>
    </Card>
  ),
};
