# Schedule when to wake up an namespace

> This is an experiment and Okteto does not officially support it.

- Create an [Okteto Admin Token](https://www.okteto.com/docs/admin/dashboard/#admin-access-tokens) and export the token to a local variable:

```bash
export SCHEDULES_OKTETO_ADMIN_TOKEN=<<your-token>>
```

- Export the URL of the Okteto Cluster to a local variable (e.g `https://okteto.example.com`):
```bash
export SCHEDULES_OKTETO_URL=https://okteto.example.com
```

- Generate the password of the DB and export it to a local variable (e.g. `passw00rd!`:

```bash
export SCHEDULES_POSTGRES_PASSWORD=<<your-password>>
```

- [OPTIONAL] Set the endpoint to private, so that only members of the namespace can access it:

```bash
export SCHEDULES_PRIVATE_ENDPOINT=true
```

- Create a namespace, and, via the admin section, mark it as [Keep awake](https://www.okteto.com/docs/admin/dashboard/#namespaces)

- Export the namespace name to a local variable:

```bash
export NAMESPACE=<<your-namespace>>
```

- Run the following command to deploy the application

```bash
okteto deploy -n ${NAMESPACE} --var SCHEDULES_OKTETO_ADMIN_TOKEN="${SCHEDULES_OKTETO_ADMIN_TOKEN}" --var SCHEDULES_OKTETO_URL="${SCHEDULES_OKTETO_URL}" --var SCHEDULES_POSTGRES_PASSWORD="${SCHEDULES_POSTGRES_PASSWORD}" --var SCHEDULES_PRIVATE_ENDPOINT="${SCHEDULES_PRIVATE_ENDPOINT}"
```

## Using the application

Click on the endpoint of the wakeup service to access the UI. The web UI allows you to add a  wake up schedule for any namespace on your Okteto instance. A namespace may only have a single schedule at the same time.  

The schedule is defined using the crontab syntax. This allows you to configure recurring wake ups. All times are UTC. If you are not familiar with crontab, [we recommend you check this website.](https://crontab.guru/)

For example, to wake up the namespace "demo" every working day at 9AM UTC, you would define it as follows in the web UI:

```
Namespace: demo
Schedule:  0 9 * * 1-5
```


