# freectl

A command-line tool for searching and browsing the [Free Media Heck Yeah](https://www.reddit.com/r/FREEMEDIAHECKYEAH/wiki/index) repository.

## Features

- 🔍 Fuzzy search through the FMHY repository
- 🎯 Find relevant links and resources quickly
- 📱 Interactive terminal user interface
- 🔄 Automatic repository updates
- 🎨 Beautiful and intuitive interface

## Installation

### From Source

```bash
git clone https://github.com/yourusername/freectl.git
cd freectl
go build
sudo mv freectl /usr/local/bin/
```

### Using Go

```bash
go install github.com/yourusername/freectl@latest
```

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
```

### Search Interface Controls

- `↑/↓` - Navigate through results
- `enter` - Select a result
- `?` - Toggle help menu
- `q` - Quit

## Configuration

By default, freectl stores its cache in `~/.local/cache/freectl`. You can change this location using the `--cache-dir` flag.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
