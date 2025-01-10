FROM docker.io/oven/bun:1.0

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN bun install

# Create config directory
RUN mkdir -p /app/config

CMD ["bun", "run", "start", "config/skinstowatch.json"]