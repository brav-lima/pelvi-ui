import type { Preview } from "@storybook/react-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
      expanded: true,
    },
    a11y: {
      // Run axe-core on the rendered story; surface violations in the panel.
      context: "#storybook-root",
      config: {},
      options: {},
    },
    options: {
      storySort: {
        order: [
          "Foundations",
          ["Tokens", "Typography", "Colors"],
          "Primitives",
          ["Button", "Badge", "StatusBadge", "Input", "Textarea", "Select"],
          "Composite",
          ["Card", "StatCard", "PageHeader", "EmptyState"],
          "*",
        ],
      },
    },
  },
  decorators: [
    withThemeByClassName({
      themes: { light: "", dark: "dark" },
      defaultTheme: "light",
      parentSelector: "html",
    }),
    (Story) => (
      <div className="bg-background text-foreground p-6 min-w-[280px]">
        <Story />
      </div>
    ),
  ],
};

export default preview;
