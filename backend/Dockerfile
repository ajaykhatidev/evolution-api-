# Use Node.js LTS version
FROM node:18-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Expose the port your backend runs on
EXPOSE 3000

# Start command
CMD [ "node", "server.js" ]
