FROM oven/bun:1.0 as builder

WORKDIR /app

# Copy only package files first
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the application (if needed in the future)
# RUN bun build ./src/index.ts --outdir ./dist

FROM oven/bun:1.0

WORKDIR /app

COPY . .

CMD ["bun", "run", "start", "config/skinstowatch.json"] 