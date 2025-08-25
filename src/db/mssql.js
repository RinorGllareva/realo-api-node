import sql from "mssql";
import dotenv from "dotenv";
dotenv.config();

let pool;

export async function getPool() {
  if (pool) return pool;

  const raw = process.env.SQLSERVER_URL; // e.g. "Data Source=SQL6030.site4now.net;Initial Catalog=...;User Id=...;Password=...;Encrypt=true;TrustServerCertificate=true;"

  // If raw contains classic ADO keywords, pass the STRING directly.
  if (raw && /(Server=|Data Source=)/i.test(raw)) {
    pool = await sql.connect(raw);
    return pool;
  }

  // Otherwise use discrete env vars:
  const server = process.env.SQLSERVER_SERVER;
  const database = process.env.SQLSERVER_DATABASE;
  const user = process.env.SQLSERVER_USER;
  const password = process.env.SQLSERVER_PASSWORD;
  const port = Number(process.env.SQLSERVER_PORT || 1433);

  if (!server || !database || !user || !password) {
    throw new Error(
      "MSSQL config missing. Provide SQLSERVER_URL or discrete SQLSERVER_* vars."
    );
  }

  pool = await sql.connect({
    server,
    database,
    user,
    password,
    port,
    options: {
      encrypt: true,
      trustServerCertificate: true,
    },
  });

  return pool;
}

export { sql };
