const { Pool } = require("pg");

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "postgres",
  database: process.env.PGDATABASE || "schedules_db",
  password: process.env.PGPASSWORD || "password",
  port: parseInt(process.env.PGPORT || "5432"),
});

// Drop the datnamespaceabase
pool.query(`DROP TABLE schedules;`);

console.log(`Successfully dropped table schedules`);
pool.end();
