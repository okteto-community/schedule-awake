#!/bin/bash

# Generate the API URL using the Okteto environment variables
API_URL="https://wakeup-${OKTETO_NAMESPACE}.${OKTETO_DOMAIN}"
echo "Generated API URL: $API_URL"

# Run the test with the API URL as an environment variable
API_URL=$API_URL node test-inline.js