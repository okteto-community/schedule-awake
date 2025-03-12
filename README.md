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

- Create a namespace, and, via the admin section, mark it as [Keep awake](https://www.okteto.com/docs/admin/dashboard/#namespaces)

- Export the namespace name to a local variable:

```bash
export NAMESPACE=<<your-namespace>>
```

- Run the following command to deploy the application

```bash
okteto deploy -n ${NAMESPACE} --var SCHEDULES_OKTETO_ADMIN_TOKEN="${SCHEDULES_OKTETO_ADMIN_TOKEN}" --var SCHEDULES_OKTETO_URL="${SCHEDULES_OKTETO_URL}" --var SCHEDULES_POSTGRES_PASSWORD="${SCHEDULES_POSTGRES_PASSWORD}"
```
