FROM okteto/okteto:stable AS okteto-cli

# Use official Node.js image as base
FROM node:22

COPY --from=okteto-cli /usr/local/bin/okteto /usr/local/bin/okteto

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

RUN npm install -g nodemon

# Copy all files
COPY . .

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["node", "server.js"]
