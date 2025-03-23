package tui

import (
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"syscall"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/log"
)

var (
	appStyle   = lipgloss.NewStyle().Padding(1, 2)
	titleStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#FFFDF5")).
			Background(lipgloss.Color("#25A065")).
			Padding(0, 1)
	statusMessageStyle = lipgloss.NewStyle().
				Foreground(lipgloss.AdaptiveColor{Light: "#04B575", Dark: "#04B575"}).
				Render
	invalidStyle = lipgloss.NewStyle().
			Border(lipgloss.NormalBorder(), false, false, false, true).
			BorderForeground(lipgloss.Color("#dc3545")).
			PaddingLeft(1)
)

type SearchResult struct {
	Category   string
	Link       string
	Text       string
	Line       string
	Score      int
	Repository string
	IsInvalid  bool
}

func (i SearchResult) Title() string {
	text := i.Text
	if i.IsInvalid {
		text = "⚠️ " + text
		return invalidStyle.Render(text)
	}
	return text
}

func (i SearchResult) Description() string {
	categoryText := "Invalid category"
	if !i.IsInvalid {
		categoryText = i.Category
	}
	return fmt.Sprintf("Category: %s | Repository: %s | URL: %s | Score: %d", categoryText, i.Repository, i.Link, i.Score)
}

func (i SearchResult) FilterValue() string {
	return i.Line
}

type listKeyMap struct {
	toggleHelpMenu key.Binding
	openURL        key.Binding
	quit           key.Binding
}

func newListKeyMap() *listKeyMap {
	return &listKeyMap{
		toggleHelpMenu: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "toggle help"),
		),
		openURL: key.NewBinding(
			key.WithKeys("enter", "o"),
			key.WithHelp("enter/o", "open URL"),
		),
		quit: key.NewBinding(
			key.WithKeys("q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
	}
}

type model struct {
	list    list.Model
	keys    *listKeyMap
	results []SearchResult
}

func NewModel(results []SearchResult) model {
	items := make([]list.Item, len(results))
	for i, result := range results {
		items[i] = result
	}

	l := list.New(items, list.NewDefaultDelegate(), 0, 0)
	l.Title = "Search Results"
	l.Styles.Title = titleStyle
	l.SetShowStatusBar(false)
	l.SetFilteringEnabled(false)
	l.SetShowHelp(false)
	l.SetShowPagination(true)
	l.SetShowTitle(true)

	return model{
		list:    l,
		keys:    newListKeyMap(),
		results: results,
	}
}

func (m model) Init() tea.Cmd {
	return nil
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		h, v := appStyle.GetFrameSize()
		m.list.SetSize(msg.Width-h, msg.Height-v)

	case tea.KeyMsg:
		if key.Matches(msg, m.keys.toggleHelpMenu) {
			m.list.SetShowHelp(!m.list.ShowHelp())
			return m, nil
		}
		if key.Matches(msg, m.keys.openURL) {
			selectedItem := m.list.SelectedItem()
			if result, ok := selectedItem.(SearchResult); ok {
				openBrowser(result.Link)
			}
			return m, nil
		}
		if key.Matches(msg, m.keys.quit) {
			return m, tea.Quit
		}
	}

	newListModel, cmd := m.list.Update(msg)
	m.list = newListModel
	cmds = append(cmds, cmd)

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	return appStyle.Render(m.list.View())
}

// openBrowser opens the URL in the default browser with better error handling
func openBrowser(url string) {
	var cmd *exec.Cmd
	var err error

	// Validate URL
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") && !strings.HasPrefix(url, "www.") {
		log.Error("Invalid URL format", "url", url)
		return
	}

	// Add https:// prefix if missing
	if strings.HasPrefix(url, "www.") {
		url = "https://" + url
	}

	switch runtime.GOOS {
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		log.Error("Unsupported platform", "os", runtime.GOOS)
		return
	}

	// Set process group ID to allow killing the browser process if needed
	if runtime.GOOS != "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			Setpgid: true,
		}
	}

	// Start the browser process
	if err = cmd.Start(); err != nil {
		log.Error("Failed to open URL", "url", url, "error", err)
		return
	}

	// Detach the process
	if err = cmd.Process.Release(); err != nil {
		log.Error("Failed to release browser process", "error", err)
	}
}
