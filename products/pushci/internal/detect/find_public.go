package detect

// FileExistsPublic is a public wrapper for fileExists.
func FileExistsPublic(path string) bool {
	return fileExists(path)
}

// FileContainsPublic is a public wrapper for fileContains.
func FileContainsPublic(path string, substr string) bool {
	return fileContains(path, substr)
}
