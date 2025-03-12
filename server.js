const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");
const { exec } = require("child_process");
var cron = require("node-cron");

// Initialize Express app
const app = express();
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

// Configure PostgreSQL connection
const pool = new Pool({
  user: process.env.PGUSER || "postgres",
  host: process.env.PGHOST || "postgres",
  database: process.env.PGDATABASE || "schedules_db",
  password: process.env.PGPASSWORD || "password",
  port: parseInt(process.env.PGPORT || "5432"),
});

// Function to wake up a namespace
function scheduleWakeupNamespace(schedule) {
  if (!schedule.namespace || !schedule.schedule) {
    throw new Error("Namespace and schedule must be provided");
  }

  try {
    cron.schedule(schedule.schedule, function () {
      exec(
        `/usr/local/bin/okteto namespace wake ${schedule.namespace}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error executing command: ${error}`);
            return;
          }
          if (stderr) {
            console.error(`Command stderr: ${stderr}`);
          }
          console.log(`namespace ${schedule.namespace} is awakening`);
        },
      );
    });

    console.log(
      `Scheduled namespace ${schedule.namespace} with schedule: ${schedule.schedule}`,
    );
  } catch (error) {
    console.error(`Error waking up namespace ${schedule.namespace}:`, error);
  }
}

// Initialize database
async function initializeDatabase() {
  exec(
    `/usr/local/bin/okteto context use --token ${process.env.OKTETO_TOKEN} ${process.env.OKTETO_URL}`,
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error}`);
        return;
      }
      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
        return;
      }

      console.log(`Okteto initialized`);
    },
  );

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY,
        namespace TEXT NOT NULL,
        schedule TEXT NOT NULL
      );
    `);

    const result = await pool.query("SELECT * FROM schedules");
    for (const schedule of result.rows) {
      scheduleWakeupNamespace(schedule);
    }

    console.log("Database initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initializeDatabase();

// API Endpoint 1: Create a new schedule
app.post("/api/schedules", async (req, res) => {
  try {
    const { namespace, schedule } = req.body;

    // Validate request body
    if (!namespace || !schedule) {
      return res
        .status(400)
        .json({ error: "Namespace and schedule are required" });
    }

    // Validate cron expression
    if (!cron.validate(schedule)) {
      return res.status(400).json({
        error: `Invalid cron expression for schedule`,
      });
    }

    // Generate UUID for new schedule
    const id = uuidv4();

    // Insert schedule into database
    await pool.query(
      "INSERT INTO schedules (id, namespace, schedule) VALUES ($1, $2, $3)",
      [id, namespace, schedule],
    );

    scheduleWakeupNamespace({ namespace: namespace, schedule: schedule });

    res.status(201).json({ id, namespace, schedule });
  } catch (error) {
    console.error("Error creating schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API Endpoint 2: Get all schedules
app.get("/api/schedules", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM schedules");
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching schedules:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// API Endpoint 3: Delete a schedule by ID
app.delete("/api/schedules/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ID
    if (!id) {
      return res.status(400).json({ error: "Schedule ID is required" });
    }

    // Delete schedule from database
    const result = await pool.query(
      "DELETE FROM schedules WHERE id = $1 RETURNING *",
      [id],
    );

    // Check if schedule was found and deleted
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    res.status(200).json({
      message: "Schedule deleted successfully",
      deletedSchedule: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Serve the frontend for any other route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
