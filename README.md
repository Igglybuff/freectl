<p align="center"><img width="800" alt="image" src="https://github.com/user-attachments/assets/39fdffde-c976-436b-97b4-a9ab3acdb3db" /></p>

# freectl

Lightning-fast command-line tool and web UI for finding cool stuff in Git repositories.

**This tool is still in active development and should definitely not be exposed on the public internet.**

## Features

- 🔍 Fuzzy search through cached Git repositories
- 📦 Cache and update Git repositories locally
- 📊 Generate statistics about repository content
- 🌐 Web interface for searching
- 🎨 Beautiful TUI interface
- 🔄 Automatic repository updates
- 🌓 Toggleable dark theme
- 🐳 Docker support

## What does this _actually do?_

(Again, `freectl` is in active development. There **are** glaring bugs.)

`freectl` is a handy tool for downloading Git repositories containing a lot of URLs (typically in the form of markdown lists, like awesome-lists) and making them searchable.

It uses a very scrappy, home-grown markdown parser to extract URLs, titles/descriptions, and categories by looking for common patterns in markdown lists. This happens _while_ searching, so there is no indexing process - repositories are fuzzy-searched directly with a configurable query delay. This might not scale well if you add too many repositories!

There is also a basic favouriting system. Favourites and settings are stored locally as JSON files in `~/.config/freectl/`.

The frontend is (in theory) embedded into the Go binary, so it should be pretty portable.

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

### Add

```bash
# Add a Git repository
freectl add https://github.com/Igglybuff/awesome-piracy --name awesome-piracy
```

### Update

```bash
# Update all cached repositories
freectl update

# Update a specific repository
freectl update --repo repository-name
```

### Search

```bash
# Search in all cached repositories
freectl search "query"

# Search in a specific repository
freectl search "query" --repo repository-name
```

### Stats

This feature is still a work in progress.

```bash
# Show stats for a specific repository
freectl stats --repo repository-name
```

### Web interface

```bash
# Start the web interface on port 8080
freectl serve --port 8080
```

The web interface is available at `http://localhost:8080` by default. You can change the port using the `--port` flag.

## Configuration

The tool uses the following default paths:
- `~/.local/cache/freectl` for repository caches
- `~/.config/freectl/config.json` for configuration

## Development

### Prerequisites

- Go 1.24
- Git

### Building

```bash
go build
```

### To do list

#### Done

- [x] max. results per page setting doesn't work
- [x] separate link names and descriptions into distinct fields and render them differently in the UI
- [x] fix the readme, some of the info is just wrong
- [x] add setting to change max fuzzy match score
- [x] fix stats page
- [x] update docker instructions with settings volume mapping

#### Bugs

- [ ] filter out items under misleading headings like "Contents"
- [ ] this blogs list didn't parse at all: https://github.com/kilimchoi/engineering-blogs
- [ ] after adding/removing repos from Settings, page needs to refresh before selecting categories from Search drop-down

#### Features

##### Core

- [ ] support for reddit megathreads
- [ ] support for HackerNews top 5000
- [ ] support for blogroll/OPML import
- [ ] support for bookmarks import (HTML/XML)
- [ ] support for Hoarder/Linkwarden sync
- [ ] support for personal knowledge stores (Obsidian vaults etc.)
- [ ] support for open directories
- [ ] support for other useful data sources
- [ ] support for book databases
- [ ] implement a search index using [bleve](https://github.com/blevesearch/bleve) as an alternative to fuzzy-search
- [ ] advanced search queries
- [ ] rest API
- [ ] user authentication
- [ ] custom markdown parsing rules for non-standard repos

##### Improvements

- [ ] alternative search results layout + link previews
- [ ] mobile-compatible web UI
- [ ] search history
- [ ] search suggestions/autocomplete
- [ ] support for sending links to Hoarder/LinkWarden
- [ ] make the repository tag clickable in search results
- [ ] support for bulk-adding repos
- [ ] implement virustotal URL scanning (vt-go is unmaintained so will have to make my own)
- [ ] add reachability check button to quickly see if a link is dead
- [ ] add share button
- [ ] export favourites as OPML/CSV/JSON/HTML
- [ ] add a --config arg to use a custom config file path
- [ ] add a `set` command to add CLI support for changing settings like the web UI can
- [ ] add viper to configure settings via environment variables
- [ ] add a favicon
- [ ] UI improvements

##### SDLC

- [ ] set up github actions CI pipeline with multi-arch release
- [ ] create AUR pkg
- [ ] SAST scan in CI
- [ ] pre-commit hooks

##### Meta

- [ ] publish a website
- [ ] post about this on reddit or whatever
- [ ] get bored, give up, leave unmaintained for 3-5 years, and archive the repository

### Technology

- Go, JS, HTML, CSS
- [charmbracelet/bubbletea](https://github.com/charmbracelet/bubbletea) and [charmbracelet/bubbles](https://github.com/charmbracelet/bubbles) for the TUI
- [charmbracelet/lipgloss](https://github.com/charmbracelet/lipgloss) for logging
- [sahilm/fuzzy](https://github.com/sahilm/fuzzy) for search
- [sp13/cobra](https://github.com/spf13/cobra) for the CLI

### Similar projects

- [mrkarezina/awesome-search](https://github.com/mrkarezina/awesome-search) - Closest thing I've found to this project
- [sindresorhus/awesome](https://github.com/sindresorhus/awesome)
- [rumca-js/Internet-Places-Database](https://github.com/rumca-js/Internet-Places-Database)

## Author

- Website: [iggly.xyz](https://iggly.xyz/)
- Mastodon: [@Igglybuff](https://mastodon.social/@Igglybuff)
- Reddit: [u/Wiggly_Poop](https://old.reddit.com/u/Wiggly_Poop)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

The Unlicense License - see LICENSE file for details.
