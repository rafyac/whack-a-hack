# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Build the client
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build
# vite builds to ../server/public

# Build the server
COPY server/package*.json server/
RUN cd server && npm ci
COPY server/ server/
RUN cd server && npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

# Install only production deps for the server (better-sqlite3 has a native binding)
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy server build + the SPA bundled into server/public
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/public ./public

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8080
CMD ["node", "dist/index.js"]
