package main

import (
	"freectl/cmd/root"
	"freectl/cmd/search"
	"freectl/cmd/update"
)

func main() {
	rootCmd := root.RootCmd
	rootCmd.AddCommand(update.UpdateCmd)
	rootCmd.AddCommand(search.SearchCmd)
	root.Execute()
}
