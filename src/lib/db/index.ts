import { drizzle, MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

type DbSchema = typeof schema;
type Db = MySql2Database<DbSchema>;

function getMysqlConfig() {
  const host = process.env.MYSQL_HOST;
  const port = process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306;
  const database = process.env.MYSQL_DATABASE;
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      "Missing MySQL environment variables. Required: MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD"
    );
  }

  const ssl = host.includes("tidbcloud.com") ? { rejectUnauthorized: true } : undefined;
  return { host, port, database, user, password, ssl };
}

// Singleton pool — reused across requests in the same process.
// In dev, hot-reload creates a new module instance; we stash the pool on
// globalThis so it survives reloads and we never leak connections.
declare global {
  // eslint-disable-next-line no-var
  var __mysqlPool: mysql.Pool | undefined;
  // eslint-disable-next-line no-var
  var __drizzleDb: Db | undefined;
}

function getPool(): mysql.Pool {
  if (!globalThis.__mysqlPool) {
    globalThis.__mysqlPool = mysql.createPool({
      ...getMysqlConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: "+00:00", // store/read as UTC
    });
  }
  return globalThis.__mysqlPool;
}

export function getDb(): Db {
  if (!globalThis.__drizzleDb) {
    globalThis.__drizzleDb = drizzle(getPool(), { schema, mode: "default" }) as Db;
  }
  return globalThis.__drizzleDb;
}

export * from "./schema";
