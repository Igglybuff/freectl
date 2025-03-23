package main

import (
	"freectl/cmd/root"
	"freectl/cmd/search"
	"freectl/cmd/serve"
	"freectl/cmd/stats"
	"freectl/cmd/update"
)

func main() {
	rootCmd := root.RootCmd
	rootCmd.AddCommand(update.UpdateCmd)
	rootCmd.AddCommand(search.SearchCmd)
	rootCmd.AddCommand(stats.StatsCmd)
	rootCmd.AddCommand(serve.ServeCmd)
	root.Execute()
}
