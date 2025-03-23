# freectl

A command-line tool for managing and searching through cached Git repositories.

## Features

- 🔍 Fuzzy search through cached repositories
- 📦 Cache and update Git repositories locally
- 📊 Generate statistics about repository content
- 🌐 Web interface for searching
- 🎨 Beautiful TUI interface
- 🔄 Automatic repository updates
- 🌓 Toggleable dark theme
- 🐳 Docker support

## Installation

### From Source

```bash
git clone https://github.com/Igglybuff/freectl.git
cd freectl
go build
chmod +x freectl
mv freectl ~/.local/bin/freectl
```

### Using Go

```bash
go install github.com/Igglybuff/freectl@latest
```

### Using Docker

```bash
# Build the Docker image
docker build -t freectl .

# Run the container
docker run -d \
  --name freectl \
  -p 8080:8080 \
  -v ~/.local/cache/freectl:/root/.local/cache/freectl \
  -v ~/.config/freectl:/root/.config/freectl \
  freectl
```

The Docker container exposes port 8080 and mounts two volumes:
- `~/.local/cache/freectl` for repository caches
- `~/.config/freectl` for storing favorites

### Using Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'
services:
  freectl:
    build: .
    container_name: freectl
    ports:
      - "8080:8080"
    volumes:
      - ~/.local/cache/freectl:/root/.local/cache/freectl
      - ~/.config/freectl:/root/.config/freectl
    restart: unless-stopped
```

Then run:
```bash
# Start the service
docker compose up -d

# View logs
docker compose logs -f

# Stop the service
docker compose down
```

## Usage

### Search

```bash
# Search in all cached repositories
freectl search "query"

# Search in a specific repository
freectl search "query" --repo repository-name
```

### Update

```bash
# Update all cached repositories
freectl update

# Update a specific repository
freectl update --repo repository-name
```

### Stats

```bash
# Show stats for a specific repository
freectl stats --repo repository-name
```

### Web Interface

```bash
# Start the web interface
freectl web
```

The web interface is available at `http://localhost:8080` by default. You can change the port using the `--port` flag.

## Configuration

The tool uses the following default paths:
- `~/.local/cache/freectl` for repository caches
- `~/.config/freectl/config.json` for configuration

## Development

### Prerequisites

- Go 1.16 or later
- Git

### Building

```bash
go build
```

### Testing

```bash
go test ./...
```

## Author

- Website: [iggly.xyz](https://iggly.xyz/)
- Mastodon: [@Igglybuff](https://mastodon.social/@Igglybuff)
- Reddit: [u/Wiggly_Poop](https://old.reddit.com/u/Wiggly_Poop)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details
