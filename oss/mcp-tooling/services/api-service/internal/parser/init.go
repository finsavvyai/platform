package parser

import (
	"github.com/mcpoverflow/api-service/internal/parser/utils"
)

func init() {
	// Register format detector first
	RegisterDetector(&utils.DefaultFormatDetector{})

	// Register parsers that fully implement UniversalParser interface in the global registry
	// Note: Only parsers with DetectFormat() method can be registered
	Register(NewGRPCParser())
	Register(NewAsyncAPIParser())
	Register(NewOpenHandlerParser())
	Register(NewRESTDiscoveryParser())

	// TODO: Add DetectFormat() to these parsers before registering:
	// - OpenAPIParser
	// - GraphQLParser
	// - PostmanParser
}
