package main

import (
	"log"
	"net/http"
	"os"

	"quantumbeam/pkg/api"

	"github.com/gin-gonic/gin"
)

func main() {
	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	// Create Gin router
	router := gin.New()
	router.Use(gin.Logger())
	router.Use(gin.Recovery())

	// Add CORS middleware
	router.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// Initialize handlers
	helloHandler := api.NewHelloHandler()

	// Routes
	router.GET("/", helloHandler.Hello)
	router.GET("/hello", helloHandler.Hello)
	router.GET("/health", helloHandler.Health)

	// API v1 routes
	v1 := router.Group("/v1")
	{
		v1.GET("/hello", helloHandler.Hello)
		v1.GET("/health", helloHandler.Health)
	}

	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting QuantumBeam Hello API server on port %s", port)
	log.Printf("Visit http://localhost:%s to see the API", port)
	log.Printf("Health check: http://localhost:%s/health", port)
	log.Printf("API v1 endpoint: http://localhost:%s/v1/hello", port)

	// Start server
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
