import { defineConfig } from "prisma/config";
import dotenv from "dotenv";
import { resolve } from "path";

// Load .env first, then .env.local (which takes precedence)
dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

const dbUrl = process.env.DATABASE_URL ?? "";
const directUrl = process.env.DATABASE_URL_UNPOOLED ?? dbUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: dbUrl,
    directUrl,
  },
});
