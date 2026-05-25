package migrate

import (
	"fmt"
	"strings"
)

func processParallelBitbucketSteps(parallel []interface{}, baseName string, stepNum int, prevStage string, b *strings.Builder, result *BitbucketConvertResult) int {
	for _, pStep := range parallel {
		pMap, ok := pStep.(map[string]interface{})
		if !ok {
			continue
		}
		s, ok := pMap["step"].(map[string]interface{})
		if !ok {
			continue
		}
		stepNum++
		stageName := sanitizeName(fmt.Sprintf("%v", s["name"]))
		if stageName == "" || stageName == "<nil>" {
			stageName = fmt.Sprintf("%s-parallel-%d", baseName, stepNum)
		}
		fmt.Fprintf(b, "  - name: %s\n    checks:\n", stageName)
		if scripts, ok := s["script"].([]interface{}); ok {
			for i, script := range scripts {
				fmt.Fprintf(b, "      - name: %s-%d\n        run: %s\n", stageName, i+1, fmt.Sprint(script))
				result.StepsKept++
			}
		}
		if prevStage != "" {
			fmt.Fprintf(b, "    depends_on:\n      - %s\n", prevStage)
		}
		b.WriteString("    parallel: true\n")
	}
	return stepNum
}
