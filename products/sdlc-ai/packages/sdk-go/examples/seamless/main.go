package main

import (
	"context"
	"fmt"
	"log"

	"github.com/SDLC/sdln-sdk-go/pkg/sdln"
)

func main() {
	// 🚀 ONE-LINE SETUP - Everything is automatic!
	client := sdln.NewAutoClient("your-api-key")

	ctx := context.Background()

	// ✅ Seamlessly ask questions - no manual context building!
	answer, err := client.Ask(ctx, "What are our security policies for customer data?")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("🤖 AI Answer: %s\n", answer)
	fmt.Printf("📚 Sources: %d documents referenced\n", len(answer.Sources))

	// ✅ Seamlessly upload and index documents - no manual chunking!
	doc, err := client.UploadDocument(ctx, "path/to/your.pdf")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("📄 Document uploaded and indexed: %s\n", doc.ID)

	// ✅ Seamlessly search - automatic hybrid search!
	results, err := client.Search(ctx, "customer security requirements")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("🔍 Found %d relevant documents\n", len(results))
	for i, result := range results {
		fmt.Printf("%d. %s (relevance: %.2f%%)\n", i+1, result.Title, result.Relevance*100)
	}

	// ✅ Seamlessly generate insights - automatic context assembly!
	insights, err := client.GetInsights(ctx, "How can we improve our security posture?")
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("💡 AI Insights: %s\n", insights.Summary)
	fmt.Printf("📊 Action Items: %d recommendations\n", len(insights.ActionItems))

	// ✅ All monitoring is automatic - just check the health!
	if client.IsHealthy() {
		fmt.Printf("✅ System is healthy!\n")
	}

	// ✅ Background operations happen automatically
	client.WaitForBackgroundTasks()
}
