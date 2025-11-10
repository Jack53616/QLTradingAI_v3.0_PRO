import pkg from "pg";
import { log } from "./logger.js";

const { Pool } = pkg;

const config = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || "localhost",
      port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    };

if (process.env.DATABASE_SSL?.toLowerCase() === "true" || process.env.NODE_ENV === "production") {
  config.ssl = { rejectUnauthorized: false };
}

export const pool = new Pool(config);

pool.on("error", (err) => {
  log("❌ PostgreSQL pool error", err);
});
