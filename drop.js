const { Pool } = require("pg");

// Function to drop the database
const dropDatabase = async () => {
  try {
    // First connect to a different database (postgres) to drop the current one
    const postgresPool = new Pool({
      user: process.env.PGUSER || "postgres",
      host: process.env.PGHOST || "postgres",
      database: "postgres", // Connect to default postgres database
      password: process.env.PGPASSWORD || "password",
      port: parseInt(process.env.PGPORT || "5432"),
    });

    const dbName = process.env.PGDATABASE || "schedules_db";

    // Drop the database
    await postgresPool.query(`DROP TABLE IF EXISTS schedules;`);

    console.log(`Successfully dropped table schedules`);
    await postgresPool.end();
    return true;
  } catch (error) {
    console.error("Error dropping database:", error);
    return false;
  }
};

dropDatabase();
