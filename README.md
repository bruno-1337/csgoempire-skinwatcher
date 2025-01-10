# skinwatcher

## Environment Configuration

The application requires the following environment variables:
- `API_KEY`: Your CSGOEmpire API key
- `DISCORD_WEBHOOK`: Your Discord webhook URL

To set them, create a .env file in the root or config directory or update sample.env with your values and change the name to .env:
```
API_KEY=your_api_key
DISCORD_WEBHOOK=your_discord_webhook
```

## Running with Docker:

```bash
docker-compose up -d
```

## Running without Docker:

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev skinstowatch.json
```

