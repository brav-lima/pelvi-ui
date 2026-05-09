import { config } from "dotenv";
import { defineConfig } from "prisma/config";

const envFile = `.env.${process.env.NODE_ENV || "dev"}`;
config({ path: envFile });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "bun prisma/seed.ts",
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  datasource: {
    url: process.env["DATABASE_URL"],
    directUrl: process.env["DIRECT_URL"],
  } as any,
});
