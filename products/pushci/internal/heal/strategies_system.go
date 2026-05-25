package heal

import "regexp"

var rePermission = regexp.MustCompile(`permission denied[:\s]+['"]?([^\s'"]+)`)
var rePort = regexp.MustCompile(`:(\d{4,5})`)

func permissionDenied(output string) *Fix {
	if !contains(output, "permission denied") {
		return nil
	}
	file := "./script.sh"
	if m := rePermission.FindStringSubmatch(output); len(m) > 1 {
		file = m[1]
	}
	return &Fix{
		Pattern:      "permission-denied",
		Action:       "chmod +x " + file,
		FilesChanged: []string{file},
	}
}

func portInUse(output string) *Fix {
	if !contains(output, "address already in use") {
		return nil
	}
	port := "8080"
	if m := rePort.FindStringSubmatch(output); len(m) > 1 {
		port = m[1]
	}
	return &Fix{Pattern: "port-in-use", Action: "fuser -k " + port + "/tcp"}
}

func contains(s, sub string) bool {
	return len(s) >= len(sub) && containsStr(s, sub)
}

func containsStr(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
