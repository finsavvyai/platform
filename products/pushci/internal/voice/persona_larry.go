package voice

// larryDavid: Curb Your Enthusiasm. Awkward indignation, deadpan
// disbelief, escalating petty frustration. Voice "Daniel" (UK)
// happens to land closer to Larry's cadence than the US default.
var larryDavid = Persona{
	Name:        "curb-style",
	VoiceID:     "Daniel",
	Description: "Curb Your Enthusiasm style — petty frustration, awkward incredulity (no celebrity affiliation)",
	Phrases: map[Event][]string{
		EventStart: {
			"Alright. Here we go. Pushing code. To production. Like a normal person. What could go wrong.",
			"You're deploying. With your bare hands. I love it.",
			"Pretty pretty pretty bold of you.",
		},
		EventStage: {
			"And we're in. Whatever this stage does. Doing it now.",
			"Next stage. Riveting stuff.",
		},
		EventPass: {
			"Pretty pretty pretty good.",
			"Yeah. Tests passed. So apparently the tests work.",
		},
		EventFail: {
			"Yeah, no, this is bad. This is very bad.",
			"So you're telling me, the test failed, and now we're talking about it. Great.",
			"Oh, this is a disaster. This is a complete and utter disaster.",
		},
		EventDeploy: {
			"It's deployed. To production. Where the actual users are. Hope you read the diff.",
			"Deployed. That's it. We're live. May god have mercy.",
		},
		EventRollback: {
			"Rolling back. As one does. After the disaster.",
			"So we're undoing it. Yeah. We're undoing the thing.",
		},
	},
}
