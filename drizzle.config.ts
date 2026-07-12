import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const host = process.env.MYSQL_HOST ?? "127.0.0.1";
const port = process.env.MYSQL_PORT ?? "3306";
const database = process.env.MYSQL_DATABASE ?? "clientfilehub";
const user = process.env.MYSQL_USER ?? "root";
const password = process.env.MYSQL_PASSWORD ?? "";
const isTiDB = host.includes("tidbcloud.com");

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: isTiDB
    ? { url: `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}?ssl={"rejectUnauthorized":true}` }
    : { host, port: parseInt(port), database, user, password },
});
