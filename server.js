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
  now = new Date().toLocaleString();

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

            now = new Date().toLocaleString();
            console.log(`[${now}] namespace ${schedule.namespace} is awakening`);
          },
        );
      },
      { name: schedule.namespace },
    );

    console.log(
      `[${now}] scheduled namespace ${schedule.namespace} with schedule: ${schedule.schedule}`,
    );
  } catch (error) {
    console.error(`error waking up namespace ${schedule.namespace}:`, error);
  }
}

function deleteTaskIfExists(namespace) {
  const task = cron.getTasks().get(namespace);

  if (!task) {
    console.log(`[ERROR] No task found for namespace: ${namespace}`);
    console.log("Active tasks list:", Array.from(cron.getTasks().keys())); 
    return;
  }

  task.stop();
  
  cron.getTasks().delete(namespace);
  console.log(`deleted scheduled awake for namespace: ${namespace}`);
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
        schedule TEXT NOT NULL,
        groupName TEXT NOT NULL UNIQUE
      );
    
      CREATE TABLE IF NOT EXISTS scheduleNamespaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        schedule_id UUID NOT NULL,
        namespace TEXT NOT NULL,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      );
    `);

    const result = await pool.query(`
      SELECT s.id, s.schedule, s.groupName, sn.namespace
      FROM schedules s
      INNER JOIN scheduleNamespaces sn ON s.id = sn.schedule_id
      ORDER BY s.groupName, sn.namespace;
    `);

    if (result) {
      for (const scheduleNs of result.rows) {
        console.log("Processing schedule:", scheduleNs);
        scheduleWakeupNamespace(scheduleNs);
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
    const { namespaces, schedule , groupName} = req.body;

    // Validate request body
    if (!Array.isArray(namespaces) || namespaces.length === 0 || !schedule) {
      return res
        .status(400)
        .json({ error: "At least one namespace and a schedule are required" });
    }

    // Validate cron expression
    if (!cron.validate(schedule)) {
      return res.status(400).json({
        error: `Invalid cron expression for schedule`,
      });
    }

    // Generate UUID for new schedule
    const id = uuidv4();
    await pool.query(
      "INSERT INTO schedules (id, schedule, groupName) VALUES ($1, $2, $3)",
      [id, schedule, groupName],
    );

    let insertedNamespaces = [];
    for(const namespace of namespaces){

      // Insert schedule into database
      await pool.query(
        "INSERT INTO scheduleNamespaces (schedule_id, namespace) VALUES ($1, $2)",
        [id, namespace],
      );

      scheduleWakeupNamespace({ namespace: namespace, schedule: schedule });
      insertedNamespaces.push(namespace);

    }

    res.status(201).json({
      id,
      groupName,
      schedule,
      namespaces: insertedNamespaces
    });

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
    const result = await pool.query("SELECT id, groupName, schedule FROM schedules");
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

    const scheduleGrName = await pool.query(
      "SELECT groupName FROM schedules WHERE id = $1",
      [id]
    );

    const namespacesResult = await pool.query(
      "SELECT namespace FROM scheduleNamespaces WHERE schedule_id = $1",
      [id]
    );
    const namespaces = namespacesResult.rows.map(row => row.namespace);
    console.log("Deleting schedule ", scheduleGrName.rows[0]);
    console.log(" -> Namespaces associated:", namespacesResult.rows);

    namespaces.forEach(namespace => {
      deleteTaskIfExists(namespace);
    });

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
    });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// API Endpoint 4: Get cluster namespaces
const API_PATH = "/api/v0/namespaces";
const DEV_NAMESPACE_TYPE = "development";
const axios = require("axios");

app.get("/api/namespaces", async (req, res) => {
  try {
      const namespacesURL = `${process.env.OKTETO_URL}${API_PATH}?type=${DEV_NAMESPACE_TYPE}`;
      console.log(`Fetching namespaces from: ${namespacesURL}`);

      const response = await axios.get(namespacesURL, {
          headers: {
              Authorization: `Bearer ${process.env.OKTETO_TOKEN}`
          },
          timeout: 10000 // Timeout 10 segs
      });

      if (response.status !== 200) {
          console.error(`Error fetching namespaces. Status: ${response.status}`);
          return res.status(response.status).json({ error: "Failed to fetch namespaces" });
      }

      const namespaceNames = response.data.map(ns => ns.name);

      res.json(namespaceNames);
  } catch (error) {
      console.error("Error fetching namespaces:", error.message);
      res.status(500).json({ error: "Failed to fetch namespaces" });
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
    console.log(`server ready ⏰`);
  });
});
