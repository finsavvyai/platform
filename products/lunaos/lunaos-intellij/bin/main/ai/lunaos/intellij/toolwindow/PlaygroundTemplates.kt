package ai.lunaos.intellij.toolwindow

object PlaygroundTemplates {

    data class Template(val name: String, val code: String)

    val ALL: List<Template> = listOf(
        Template(
            "Hello World",
            "req >> des >> plan >> go"
        ),
        Template(
            "Quality Gate",
            "(rev ~~ test ~~ sec) ?>> ship !>> fix"
        ),
        Template(
            "Safe Deploy",
            "try (test >> ship) catch (rollback) finally (docs)"
        ),
        Template(
            "Feature Loop",
            "@before:rules go *5 >> test >> rev >> pr"
        ),
        Template(
            "Multi-Repo",
            "in engine (test >> ship) ~~ in dashboard (test >> ship)"
        )
    )
}
