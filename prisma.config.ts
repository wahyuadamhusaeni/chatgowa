// Prisma configuration file.
// dotenv is listed as a runtime dependency (not devDependency) so it is
// available both in development and in production Docker builds.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
