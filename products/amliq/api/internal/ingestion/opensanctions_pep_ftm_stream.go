package ingestion

import (
	"bufio"
	"encoding/json"
	"io"
)

// ParseStream implements StreamParser so the 800MB+ FTM feed can be
// piped straight into the batched upserter without materialising
// every entity in memory. Tokens larger than the initial scanner
// buffer are accommodated by raising the limit to 16MB per line,
// comfortably above the biggest observed FTM row.
func (p *OpenSanctionsPEPFTMParser) ParseStream(
	r io.Reader, emit EntityEmitter,
) error {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 1<<20), 1<<24)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var ent ftmFullEntity
		if err := json.Unmarshal(line, &ent); err != nil {
			continue
		}
		if !isPEPEntitySchema(ent.Schema) {
			continue
		}
		built, ok := buildFTMEntity(ent)
		if !ok {
			continue
		}
		if err := emit(built); err != nil {
			return err
		}
	}
	return scanner.Err()
}
