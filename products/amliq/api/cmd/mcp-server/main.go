// Command mcp-server runs the AMLIQ MCP JSON-RPC server.
//
// Default transport is stdio (the contract every Claude client knows).
// Set MCP_HTTP_PORT to also serve Streamable HTTP at /mcp for hosted
// clients (Cowork, Claude Managed Agents). Set MCP_BEARER to require
// an Authorization: Bearer header on the HTTP endpoint.
//
// All tool definitions and handlers live in internal/mcp; this binary
// only wires transport. New tools added there light up here without
// changes.
//
// TODO(S9-01..02): replace the empty engine with a list-loaded engine
// once the public-hostname + auth path is decided.
package main

import (
	"log"
	"os"

	"github.com/aegis-aml/aegis/internal/mcp"
	"github.com/aegis-aml/aegis/internal/screening"
)

func main() {
	log.SetOutput(os.Stderr)
	server := mcp.NewServer(buildEngine())

	if port := os.Getenv("MCP_HTTP_PORT"); port != "" {
		log.Printf("AMLIQ MCP Server starting (HTTP transport :%s)", port)
		bearer := os.Getenv("MCP_BEARER")
		if err := mcp.ServeHTTP(server, ":"+port, bearer); err != nil {
			log.Fatalf("mcp http: %v", err)
		}
		return
	}

	log.Println("AMLIQ MCP Server starting (stdio transport)")
	if err := server.RunStdio(os.Stdin, os.Stdout); err != nil {
		log.Fatalf("mcp stdio: %v", err)
	}
}

// buildEngine wires the screening engine the MCP server uses. Today
// returns an empty engine + index so tool calls return zero matches;
// the persistence/loader work is tracked under Sprint 9 follow-ups.
func buildEngine() (*screening.Engine, *screening.SearchIndex) {
	idx := screening.NewSearchIndex()
	scorer := screening.NewWeightedScorer(nil)
	engine := screening.NewEngine(scorer, screening.WithSearchIndex(idx))
	return engine, idx
}
