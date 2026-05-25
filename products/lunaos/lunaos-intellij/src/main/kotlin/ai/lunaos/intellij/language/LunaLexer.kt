package ai.lunaos.intellij.language

import com.intellij.lexer.LexerBase
import com.intellij.psi.tree.IElementType

class LunaLexer : LexerBase() {

    private var buffer: CharSequence = ""
    private var startOffset = 0
    private var endOffset = 0
    private var position = 0
    private var tokenStart = 0
    private var tokenEnd = 0
    private var currentToken: IElementType? = null

    override fun start(buf: CharSequence, start: Int, end: Int, state: Int) {
        buffer = buf
        startOffset = start
        endOffset = end
        position = start
        advance()
    }

    override fun getState(): Int = 0
    override fun getTokenType(): IElementType? = currentToken
    override fun getTokenStart(): Int = tokenStart
    override fun getTokenEnd(): Int = tokenEnd
    override fun getBufferSequence(): CharSequence = buffer
    override fun getBufferEnd(): Int = endOffset

    override fun advance() {
        if (position >= endOffset) {
            currentToken = null
            return
        }
        tokenStart = position
        val ch = buffer[position]

        currentToken = when {
            ch == '#' -> lexComment()
            ch == '"' || ch == '\'' -> lexString(ch)
            ch == '$' -> lexVariable()
            ch == '@' -> lexHook()
            ch == '(' || ch == ')' -> lexParen()
            ch == '>' || ch == '~' || ch == '?' || ch == '!' -> lexOperator()
            ch == '*' -> lexStar()
            ch.isWhitespace() -> lexWhitespace()
            ch.isDigit() -> lexNumber()
            ch.isLetter() || ch == '-' -> lexWord()
            else -> { position++; LunaTokenTypes.BAD_CHARACTER }
        }
        tokenEnd = position
    }

    private fun lexComment(): IElementType {
        while (position < endOffset && buffer[position] != '\n') position++
        return LunaTokenTypes.COMMENT
    }

    private fun lexString(quote: Char): IElementType {
        position++ // skip opening quote
        while (position < endOffset && buffer[position] != quote) {
            if (buffer[position] == '\\' && position + 1 < endOffset) position++
            position++
        }
        if (position < endOffset) position++ // skip closing quote
        return LunaTokenTypes.STRING
    }

    private fun lexVariable(): IElementType {
        position++ // skip $
        while (position < endOffset && (buffer[position].isLetterOrDigit()
                    || buffer[position] == '_' || buffer[position] == '.')) {
            position++
        }
        return LunaTokenTypes.VARIABLE
    }

    private fun lexHook(): IElementType {
        val remaining = buffer.subSequence(position, endOffset).toString()
        for (hook in LunaTokenTypes.HOOKS) {
            if (remaining.startsWith(hook)) {
                position += hook.length
                return LunaTokenTypes.HOOK
            }
        }
        position++
        return LunaTokenTypes.BAD_CHARACTER
    }

    private fun lexParen(): IElementType {
        position++
        return LunaTokenTypes.PAREN
    }

    private fun lexOperator(): IElementType {
        val remaining = buffer.subSequence(position, endOffset).toString()
        for (op in LunaTokenTypes.OPERATORS.sortedByDescending { it.length }) {
            if (remaining.startsWith(op)) {
                position += op.length
                return LunaTokenTypes.OPERATOR
            }
        }
        position++
        return LunaTokenTypes.BAD_CHARACTER
    }

    private fun lexStar(): IElementType {
        position++ // skip *
        while (position < endOffset && (buffer[position].isDigit()
                    || buffer[position] == '?')) {
            position++
        }
        return LunaTokenTypes.OPERATOR
    }

    private fun lexWhitespace(): IElementType {
        while (position < endOffset && buffer[position].isWhitespace()) position++
        return LunaTokenTypes.WHITESPACE
    }

    private fun lexNumber(): IElementType {
        while (position < endOffset && buffer[position].isDigit()) position++
        return LunaTokenTypes.NUMBER
    }

    private fun lexWord(): IElementType {
        val start = position
        while (position < endOffset && (buffer[position].isLetterOrDigit()
                    || buffer[position] == '-' || buffer[position] == '_')) {
            position++
        }
        val word = buffer.subSequence(start, position).toString()
        return when (word) {
            in LunaTokenTypes.CONTROLS -> LunaTokenTypes.CONTROL
            in LunaTokenTypes.KEYWORDS -> LunaTokenTypes.KEYWORD
            else -> LunaTokenTypes.IDENTIFIER
        }
    }
}
