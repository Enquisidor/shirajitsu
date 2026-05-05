package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"unsafe"

	"github.com/fsnotify/fsnotify"
)

// RegistryEntry represents a single entry in source-registry.json.
type RegistryEntry struct {
	Domain string `json:"domain"`
	Tier   string `json:"tier"`
}

// Registry holds the loaded source registry and its version.
type Registry struct {
	Version string
	// Entries is a map from domain to tier string, built from the JSON array.
	Entries map[string]string
}

// Loader hot-reloads source-registry.json on file changes using fsnotify.
// The current registry is stored atomically so reads never block.
type Loader struct {
	path    string
	current unsafe.Pointer // points to *Registry
	mu      sync.Mutex     // serialises writes only
	logger  *slog.Logger
}

// NewLoader creates a Loader for the given registry file path.
// It performs an initial load synchronously and returns an error if the file
// cannot be read or parsed.
func NewLoader(path string, logger *slog.Logger) (*Loader, error) {
	l := &Loader{path: path, logger: logger}
	if err := l.load(); err != nil {
		return nil, err
	}
	return l, nil
}

// Get returns the currently loaded Registry. Safe for concurrent reads.
func (l *Loader) Get() *Registry {
	p := atomic.LoadPointer(&l.current)
	return (*Registry)(p)
}

// Version returns the version string of the currently loaded registry.
func (l *Loader) Version() string {
	r := l.Get()
	if r == nil {
		return "unknown"
	}
	return r.Version
}

// Watch starts watching the registry file for changes and hot-reloads it.
// It blocks until ctx is cancelled, then cleans up.
// Call this in a goroutine: go loader.Watch(ctx).
func (l *Loader) Watch(ctx context.Context) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		l.logger.Error("registry watcher: could not create fsnotify watcher", "err", err)
		return
	}
	defer watcher.Close()

	if err := watcher.Add(l.path); err != nil {
		l.logger.Error("registry watcher: could not watch file", "path", l.path, "err", err)
		return
	}

	l.logger.Info("registry watcher: watching for changes", "path", l.path)
	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Has(fsnotify.Write) || event.Has(fsnotify.Create) {
				l.logger.Info("registry watcher: file changed, reloading", "path", l.path, "op", event.Op.String())
				if err := l.load(); err != nil {
					l.logger.Error("registry watcher: reload failed", "err", err)
				} else {
					l.logger.Info("registry watcher: reload successful", "version", l.Version())
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			l.logger.Error("registry watcher: fsnotify error", "err", err)
		}
	}
}

// load reads and parses the registry JSON file, then atomically replaces
// the current registry pointer. Serialised by mu to prevent torn writes.
func (l *Loader) load() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	data, err := os.ReadFile(l.path)
	if err != nil {
		return fmt.Errorf("registry loader: read %q: %w", l.path, err)
	}

	var raw struct {
		Version string          `json:"version"`
		Sources []RegistryEntry `json:"sources"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("registry loader: parse %q: %w", l.path, err)
	}

	entries := make(map[string]string, len(raw.Sources))
	for _, s := range raw.Sources {
		entries[s.Domain] = s.Tier
	}

	reg := &Registry{
		Version: raw.Version,
		Entries: entries,
	}
	atomic.StorePointer(&l.current, unsafe.Pointer(reg))
	return nil
}
