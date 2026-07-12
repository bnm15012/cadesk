import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.MYSQL_HOST ?? "127.0.0.1",
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
    database: process.env.MYSQL_DATABASE ?? "clientfilehub",
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    ssl: process.env.MYSQL_HOST?.includes("tidbcloud.com") ? { rejectUnauthorized: true } : undefined,
  },
});
