package cli

import (
	"fmt"
	"strings"
)

// Header prints bold text centered with "═══" borders.
func Header(text string) {
	width := 40
	border := strings.Repeat("═", width)
	pad := (width - len(text)) / 2
	if pad < 1 {
		pad = 1
	}
	fmt.Println(Bold(border))
	fmt.Printf("%s%s%s\n", Bold(strings.Repeat(" ", pad)), Bold(text), Bold(""))
	fmt.Println(Bold(border))
}

// Step prints a step indicator like "[1/5] Building...".
func Step(n, total int, msg string) {
	fmt.Printf("  %s %s\n", Blue(fmt.Sprintf("[%d/%d]", n, total)), msg)
}

// Success prints a green success message.
func Success(msg string) {
	fmt.Printf("  %s %s\n", CheckMark(), Green(msg))
}

// Error prints a red error message.
func Error(msg string) {
	fmt.Printf("  %s %s\n", CrossMark(), Red(msg))
}

// Warn prints a yellow warning message.
func Warn(msg string) {
	fmt.Printf("  %s %s\n", Dot(), Yellow(msg))
}

// Info prints a blue info message.
func Info(msg string) {
	fmt.Printf("  %s %s\n", Blue("i"), msg)
}

// Table prints an aligned table with headers and rows.
func Table(headers []string, rows [][]string) {
	widths := make([]int, len(headers))
	for i, h := range headers {
		widths[i] = len(h)
	}
	for _, row := range rows {
		for i, cell := range row {
			if i < len(widths) && len(cell) > widths[i] {
				widths[i] = len(cell)
			}
		}
	}
	printRow := func(cells []string, isBold bool) {
		var parts []string
		for i, cell := range cells {
			w := 10
			if i < len(widths) {
				w = widths[i]
			}
			parts = append(parts, fmt.Sprintf("%-*s", w, cell))
		}
		line := "  " + strings.Join(parts, "  ")
		if isBold {
			fmt.Println(Bold(line))
		} else {
			fmt.Println(line)
		}
	}
	printRow(headers, true)
	sep := make([]string, len(headers))
	for i, w := range widths {
		sep[i] = strings.Repeat("─", w)
	}
	fmt.Println("  " + Dim(strings.Join(sep, "  ")))
	for _, row := range rows {
		printRow(row, false)
	}
}
