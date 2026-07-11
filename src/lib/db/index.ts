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

  return { host, port, database, user, password };
}

// Singleton pool — reused across requests in the same process.
let _pool: mysql.Pool | undefined;

function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      ...getMysqlConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: "+00:00", // store/read as UTC
    });
  }
  return _pool;
}

// Lazy singleton Drizzle client — only created when first accessed server-side.
let _db: Db | undefined;

export function getDb(): Db {
  if (!_db) {
    _db = drizzle(getPool(), { schema, mode: "default" }) as Db;
  }
  return _db;
}

export * from "./schema";
