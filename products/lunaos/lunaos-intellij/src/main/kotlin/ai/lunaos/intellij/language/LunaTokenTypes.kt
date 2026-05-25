package ai.lunaos.intellij.language

import com.intellij.psi.tree.IElementType
import com.intellij.psi.tree.TokenSet

object LunaTokenTypes {

    val KEYWORD = LunaTokenType("KEYWORD")
    val OPERATOR = LunaTokenType("OPERATOR")
    val VARIABLE = LunaTokenType("VARIABLE")
    val STRING = LunaTokenType("STRING")
    val NUMBER = LunaTokenType("NUMBER")
    val COMMENT = LunaTokenType("COMMENT")
    val PAREN = LunaTokenType("PAREN")
    val HOOK = LunaTokenType("HOOK")
    val CONTROL = LunaTokenType("CONTROL")
    val WHITESPACE = LunaTokenType("WHITESPACE")
    val IDENTIFIER = LunaTokenType("IDENTIFIER")
    val BAD_CHARACTER = LunaTokenType("BAD_CHARACTER")

    val KEYWORDS = setOf(
        "req", "des", "plan", "go", "rev", "test", "ship", "watch",
        "retro", "feature", "parallel", "fix", "debug", "refactor",
        "pr", "rules", "perf", "a11y", "deps", "mock", "storybook",
        "auth", "brand", "api-client", "migrate", "i18n", "ci",
        "changelog", "env", "rollback", "dock", "cf", "sec", "nexa",
        "lam", "oh", "chain", "vision", "search", "q", "hig", "ui",
        "docs", "cfg"
    )

    val CONTROLS = setOf(
        "if", "else", "try", "catch", "finally", "match", "assert",
        "approve", "def", "run", "import", "with", "in", "map",
        "reduce", "on", "timeout", "retry", "snapshot", "diff", "log"
    )

    val OPERATORS = setOf(">>", "~~", "?>>", "!>>")

    val HOOKS = setOf("@before:", "@after:", "@each:")

    val COMMENTS = TokenSet.create(COMMENT)
    val STRINGS = TokenSet.create(STRING)
}

class LunaTokenType(debugName: String) :
    IElementType(debugName, LunaLanguage)
