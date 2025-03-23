# freectl

A command-line tool for searching and browsing the [Free Media Heck Yeah](https://www.reddit.com/r/FREEMEDIAHECKYEAH/wiki/index) repository.

## Features

- 🔍 Fuzzy search through the FMHY repository
- 🎯 Find relevant links and resources quickly
- 📱 Interactive terminal user interface
- 🌐 Web interface with favorites support
- 🔄 Automatic repository updates
- 🎨 Beautiful and intuitive interface
- 🐳 Docker support

## Installation

### From Source

```bash
git clone https://github.com/yourusername/freectl.git
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
- `~/.local/cache/freectl` for the FMHY repository cache
- `~/.config/freectl` for storing favorites

## Usage

### Basic Commands

```bash
# Update the FMHY repository cache
freectl update

# Search for resources
freectl search "torrent"
freectl s "torrent"  # Short alias

# Search with custom limit
freectl search --limit 20 "streaming"

# Search in a custom cache directory
freectl search --cache-dir /path/to/cache "torrent"

# Start the web interface
freectl serve
freectl serve --port 8080  # Use a custom port
```

### Search Interface Controls

- `↑/↓` - Navigate through results
- `enter` - Select a result
- `?` - Toggle help menu
- `q` - Quit

### Web Interface Features

- 🔍 Real-time fuzzy search
- ❤️ Save favorite resources
- 🔍 Search through your favorites
- 📱 Responsive design
- 🎨 Modern and clean interface

The web interface is available at `http://localhost:8080` by default. You can change the port using the `--port` flag.

Favorites are stored in `~/.config/freectl/favourites.json`.

## Configuration

By default, freectl stores its cache in `~/.local/cache/freectl`. You can change this location using the `--cache-dir` flag.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Unlicense License - see the LICENSE file for details.
