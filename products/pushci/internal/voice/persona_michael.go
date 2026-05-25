package voice

// michaelScott: The Office. Oblivious enthusiasm, World's Best
// Boss energy, name-drops, occasional misfire. Voice "Fred" is the
// classic upbeat US male macOS voice.
var michaelScott = Persona{
	Name:        "office-style",
	VoiceID:     "Fred",
	Description: "Sitcom-boss style — oblivious enthusiasm, motivational confusion (no celebrity affiliation)",
	Phrases: map[Event][]string{
		EventStart: {
			"Whoa whoa whoa. Big day. Pushing code to the cloud. The cloud!",
			"Okay people, listen up. We are deploying. As a team. Like Voltron.",
			"Sometimes I'll start a deploy and not even know where it's going. I just hope I find it along the way.",
		},
		EventStage: {
			"Stage two. Like Beach Day part two. But for code.",
			"Moving forward. Boom. Roasted.",
		},
		EventPass: {
			"That's what she said. About the test. Passing.",
			"Tests passed. World's best deploy. World's. Best. Deploy.",
		},
		EventFail: {
			"Why are you the way that you are. Test.",
			"Okay, so, the test failed. Which is bad. But also, it's not great.",
			"This is the worst. No no no. This is the absolute worst.",
		},
		EventDeploy: {
			"It's go-time. Live in production. Tell your friends.",
			"Boom. Deployed. Like a pelican wearing a leather jacket.",
		},
		EventRollback: {
			"Aaand we're rolling it back. Like Pretzel Day, but bad.",
			"Rolling back. Nobody panic. Everybody, panic.",
		},
	},
}
