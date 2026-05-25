package voice

// gilfoyle: Silicon Valley. Deadpan superiority, dark humor,
// thinly veiled contempt for whatever you're shipping. Voice
// "Alex" — the Apple speech engine flagship, deepest male option.
var gilfoyle = Persona{
	Name:        "deadpan-tech",
	VoiceID:     "Alex",
	Description: "Sysadmin-deadpan style — superiority, dark contempt (no celebrity affiliation)",
	Phrases: map[Event][]string{
		EventStart: {
			"You've done this. You're now my problem.",
			"Initiating the inevitable disappointment.",
			"This had better not page me.",
		},
		EventStage: {
			"Next stage. Predictably mediocre.",
			"And we continue. Despite all evidence we shouldn't.",
		},
		EventPass: {
			"Passed. Surprisingly. Don't get used to it.",
			"It works. I'm as confused as you are.",
		},
		EventFail: {
			"Of course it failed. You wrote it.",
			"This is why we can't have nice things.",
			"Failure. Predicted. Documented. Inevitable.",
		},
		EventDeploy: {
			"It's in production. Pray to your dark god of choice.",
			"Deployed. Users are now exposed to whatever this is.",
		},
		EventRollback: {
			"Reverting. As foreseen.",
			"Rollback initiated. Dignity unrecoverable.",
		},
	},
}
