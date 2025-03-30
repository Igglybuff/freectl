package sources

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestDeriveNameFromURL(t *testing.T) {
	tests := []struct {
		name     string
		url      string
		expected string
	}{
		{
			name:     "standard git url",
			url:      "https://github.com/user/repo.git",
			expected: "repo",
		},
		{
			name:     "url without .git",
			url:      "https://github.com/user/repo",
			expected: "repo",
		},
		{
			name:     "url with trailing slash",
			url:      "https://github.com/user/repo/",
			expected: "repo",
		},
		{
			name:     "url with multiple slashes",
			url:      "https://github.com/user/org/repo",
			expected: "repo",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DeriveNameFromURL(tt.url)
			if result != tt.expected {
				t.Errorf("DeriveNameFromURL(%q) = %q, want %q", tt.url, result, tt.expected)
			}
		})
	}
}

func TestValidateGitRepo(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()

	// Test case 1: Non-existent directory
	t.Run("non-existent directory", func(t *testing.T) {
		err := ValidateGitRepo(filepath.Join(tmpDir, "nonexistent"))
		if err == nil {
			t.Error("ValidateGitRepo should return error for non-existent directory")
		}
	})

	// Test case 2: Directory exists but not a git repo
	t.Run("not a git repo", func(t *testing.T) {
		notGitDir := filepath.Join(tmpDir, "notgit")
		if err := os.MkdirAll(notGitDir, 0755); err != nil {
			t.Fatal(err)
		}
		err := ValidateGitRepo(notGitDir)
		if err == nil {
			t.Error("ValidateGitRepo should return error for non-git directory")
		}
	})

	// Test case 3: Valid git repo
	t.Run("valid git repo", func(t *testing.T) {
		gitDir := filepath.Join(tmpDir, "gitrepo")
		if err := os.MkdirAll(gitDir, 0755); err != nil {
			t.Fatal(err)
		}

		// Initialize git repo
		cmd := exec.Command("git", "init")
		cmd.Dir = gitDir
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}

		err := ValidateGitRepo(gitDir)
		if err != nil {
			t.Errorf("ValidateGitRepo should not return error for valid git repo: %v", err)
		}
	})
}

func TestGetGitRemoteURL(t *testing.T) {
	// Create a temporary directory for testing
	tmpDir := t.TempDir()

	// Test case 1: Non-existent directory
	t.Run("non-existent directory", func(t *testing.T) {
		_, err := GetGitRemoteURL(filepath.Join(tmpDir, "nonexistent"))
		if err == nil {
			t.Error("GetGitRemoteURL should return error for non-existent directory")
		}
	})

	// Test case 2: Git repo without remote
	t.Run("git repo without remote", func(t *testing.T) {
		gitDir := filepath.Join(tmpDir, "gitrepo")
		if err := os.MkdirAll(gitDir, 0755); err != nil {
			t.Fatal(err)
		}

		// Initialize git repo
		cmd := exec.Command("git", "init")
		cmd.Dir = gitDir
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}

		_, err := GetGitRemoteURL(gitDir)
		if err == nil {
			t.Error("GetGitRemoteURL should return error for repo without remote")
		}
	})

	// Test case 3: Git repo with remote
	t.Run("git repo with remote", func(t *testing.T) {
		gitDir := filepath.Join(tmpDir, "gitrepo")
		if err := os.MkdirAll(gitDir, 0755); err != nil {
			t.Fatal(err)
		}

		// Initialize git repo
		cmd := exec.Command("git", "init")
		cmd.Dir = gitDir
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}

		// Add a remote
		cmd = exec.Command("git", "remote", "add", "origin", "https://github.com/test/repo.git")
		cmd.Dir = gitDir
		if err := cmd.Run(); err != nil {
			t.Fatal(err)
		}

		url, err := GetGitRemoteURL(gitDir)
		if err != nil {
			t.Errorf("GetGitRemoteURL should not return error: %v", err)
		}
		if url != "https://github.com/test/repo.git" {
			t.Errorf("GetGitRemoteURL returned wrong URL: got %q, want %q", url, "https://github.com/test/repo.git")
		}
	})
}

func TestAddGitRepo(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a test git server
	serverDir := filepath.Join(tmpDir, "server")
	if err := os.MkdirAll(serverDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Initialize git repo for server
	cmd := exec.Command("git", "init", "--bare")
	cmd.Dir = serverDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Create a test repo to push to server
	testRepoDir := filepath.Join(tmpDir, "testrepo")
	if err := os.MkdirAll(testRepoDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Initialize test repo
	cmd = exec.Command("git", "init")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Create a test file
	testFile := filepath.Join(testRepoDir, "test.txt")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Add and commit the file
	cmd = exec.Command("git", "add", "test.txt")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "commit", "-m", "Initial commit")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Add remote and push
	cmd = exec.Command("git", "remote", "add", "origin", serverDir)
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "push", "-u", "origin", "main")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		source  Source
		wantErr bool
	}{
		{
			name: "clone new repo",
			source: Source{
				Name: "testrepo",
				URL:  serverDir,
				Type: SourceTypeGit,
			},
			wantErr: false,
		},
		{
			name: "update existing repo",
			source: Source{
				Name: "testrepo",
				URL:  serverDir,
				Type: SourceTypeGit,
			},
			wantErr: false,
		},
		{
			name: "missing URL",
			source: Source{
				Name: "missingurl",
				Type: SourceTypeGit,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.source.Add(tmpDir)
			if (err != nil) != tt.wantErr {
				t.Errorf("AddGitRepo() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestUpdateGitRepo(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a test git server
	serverDir := filepath.Join(tmpDir, "server")
	if err := os.MkdirAll(serverDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Initialize git repo for server
	cmd := exec.Command("git", "init", "--bare")
	cmd.Dir = serverDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Create a test repo to push to server
	testRepoDir := filepath.Join(tmpDir, "testrepo")
	if err := os.MkdirAll(testRepoDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Initialize test repo
	cmd = exec.Command("git", "init")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Create a test file
	testFile := filepath.Join(testRepoDir, "test.txt")
	if err := os.WriteFile(testFile, []byte("test content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Add and commit the file
	cmd = exec.Command("git", "add", "test.txt")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "commit", "-m", "Initial commit")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Add remote and push
	cmd = exec.Command("git", "remote", "add", "origin", serverDir)
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	cmd = exec.Command("git", "push", "-u", "origin", "main")
	cmd.Dir = testRepoDir
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	// Clone the repo for testing
	cloneDir := filepath.Join(tmpDir, "clone")
	cmd = exec.Command("git", "clone", serverDir, cloneDir)
	if err := cmd.Run(); err != nil {
		t.Fatal(err)
	}

	tests := []struct {
		name    string
		repoDir string
		wantErr bool
	}{
		{
			name:    "update valid repo",
			repoDir: cloneDir,
			wantErr: false,
		},
		{
			name:    "update non-existent repo",
			repoDir: filepath.Join(tmpDir, "nonexistent"),
			wantErr: true,
		},
		{
			name:    "update non-git directory",
			repoDir: tmpDir,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := UpdateGitRepo(tt.repoDir)
			if (err != nil) != tt.wantErr {
				t.Errorf("UpdateGitRepo() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
