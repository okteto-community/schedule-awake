const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { Pool } = require("pg");
const bodyParser = require("body-parser");
const path = require("path");
const { exec } = require("child_process");
const cron = require("node-cron");

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
    throw new Error("namespace and schedule must be provided");
  }

  try {
    cron.schedule(
      schedule.schedule,
      function () {
        exec(
          `/usr/local/bin/okteto namespace wake ${schedule.namespace} --log-level=debug`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`error executing command: ${error}`);
              return;
            }

            console.log(`namespace ${schedule.namespace} is awakening`);
          },
        );
      },
      { name: schedule.namespace },
    );

    console.log(
      `saved namespace ${schedule.namespace} with schedule: ${schedule.schedule}`,
    );
  } catch (error) {
    console.error(`error waking up namespace ${schedule.namespace}:`, error);
  }
}

function deleteTaskIfExists(namespace) {
  cron.getTasks().delete(namespace);
  console.log(`Deleted scheduled awake for namespace: ${namespace}`);
}

async function setOktetoContext() {
  return new Promise(function (resolve, reject) {
    exec(
      `/usr/local/bin/okteto context use --token ${process.env.OKTETO_TOKEN} ${process.env.OKTETO_URL}`,
      (error, stdout, stderr) => {
        if (error) {
          reject(error);
        }
        if (stderr) {
          reject(stderr);
        }

        console.log(`okteto context initialized`);
        resolve();
      },
    );
  });
}

// Initialize database
async function initializeDatabase() {
  await setOktetoContext();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id UUID PRIMARY KEY,
        namespace TEXT NOT NULL UNIQUE,
        schedule TEXT NOT NULL
      );
    `);

    const result = await pool.query("SELECT * FROM schedules");
    if (result) {
      for (const schedule of result.rows) {
        scheduleWakeupNamespace(schedule);
      }
    }

    console.log("database initialized");
  } catch (error) {
    throw new Error("error initializing database:", error);
  }
}

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
    // Check for unique constraint violation (duplicate namespace)
    if (error.code === "23505") {
      // PostgreSQL unique violation code
      return res.status(400).json({
        error: "A schedule for this namespace already exists",
      });
    }
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

    deleteTaskIfExists(result.rows[0].namespace);

    res.status(200).json({
      message: "Schedule deleted successfully",
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

// Check for required environment variables
if (!process.env.OKTETO_URL || !process.env.OKTETO_TOKEN) {
  console.error(
    "error: OKTETO_URL and OKTETO_TOKEN environment variables must be defined",
  );
  process.exit(1);
}

// Start the server
const PORT = process.env.PORT || 8080;

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`server running on port ${PORT}`);
  });
});
