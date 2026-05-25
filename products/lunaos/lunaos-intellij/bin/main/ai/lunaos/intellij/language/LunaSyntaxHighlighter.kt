package ai.lunaos.intellij.language

import com.intellij.lexer.Lexer
import com.intellij.openapi.editor.DefaultLanguageHighlighterColors
import com.intellij.openapi.editor.HighlighterColors
import com.intellij.openapi.editor.colors.TextAttributesKey
import com.intellij.openapi.editor.colors.TextAttributesKey.createTextAttributesKey
import com.intellij.openapi.editor.markup.TextAttributes
import com.intellij.openapi.fileTypes.SyntaxHighlighter
import com.intellij.openapi.fileTypes.SyntaxHighlighterBase
import com.intellij.openapi.fileTypes.SyntaxHighlighterFactory
import com.intellij.openapi.project.Project
import com.intellij.openapi.vfs.VirtualFile
import com.intellij.psi.tree.IElementType
import java.awt.Color
import java.awt.Font

object LunaHighlightColors {

    val KEYWORD: TextAttributesKey = createTextAttributesKey(
        "LUNA_KEYWORD",
        DefaultLanguageHighlighterColors.KEYWORD
    )

    val OPERATOR: TextAttributesKey = createTextAttributesKey(
        "LUNA_OPERATOR",
        DefaultLanguageHighlighterColors.OPERATION_SIGN
    )

    val VARIABLE: TextAttributesKey = createTextAttributesKey(
        "LUNA_VARIABLE",
        DefaultLanguageHighlighterColors.LOCAL_VARIABLE
    )

    val STRING: TextAttributesKey = createTextAttributesKey(
        "LUNA_STRING",
        DefaultLanguageHighlighterColors.STRING
    )

    val NUMBER: TextAttributesKey = createTextAttributesKey(
        "LUNA_NUMBER",
        DefaultLanguageHighlighterColors.NUMBER
    )

    val COMMENT: TextAttributesKey = createTextAttributesKey(
        "LUNA_COMMENT",
        DefaultLanguageHighlighterColors.LINE_COMMENT
    )

    val CONTROL: TextAttributesKey = createTextAttributesKey(
        "LUNA_CONTROL",
        DefaultLanguageHighlighterColors.KEYWORD
    )

    val HOOK: TextAttributesKey = createTextAttributesKey(
        "LUNA_HOOK",
        DefaultLanguageHighlighterColors.METADATA
    )

    val PAREN: TextAttributesKey = createTextAttributesKey(
        "LUNA_PAREN",
        DefaultLanguageHighlighterColors.PARENTHESES
    )

    val BAD_CHAR: TextAttributesKey = createTextAttributesKey(
        "LUNA_BAD_CHARACTER",
        HighlighterColors.BAD_CHARACTER
    )
}

class LunaSyntaxHighlighter : SyntaxHighlighterBase() {

    override fun getHighlightingLexer(): Lexer = LunaLexer()

    override fun getTokenHighlights(tokenType: IElementType?): Array<TextAttributesKey> =
        when (tokenType) {
            LunaTokenTypes.KEYWORD -> arrayOf(LunaHighlightColors.KEYWORD)
            LunaTokenTypes.OPERATOR -> arrayOf(LunaHighlightColors.OPERATOR)
            LunaTokenTypes.VARIABLE -> arrayOf(LunaHighlightColors.VARIABLE)
            LunaTokenTypes.STRING -> arrayOf(LunaHighlightColors.STRING)
            LunaTokenTypes.NUMBER -> arrayOf(LunaHighlightColors.NUMBER)
            LunaTokenTypes.COMMENT -> arrayOf(LunaHighlightColors.COMMENT)
            LunaTokenTypes.CONTROL -> arrayOf(LunaHighlightColors.CONTROL)
            LunaTokenTypes.HOOK -> arrayOf(LunaHighlightColors.HOOK)
            LunaTokenTypes.PAREN -> arrayOf(LunaHighlightColors.PAREN)
            LunaTokenTypes.BAD_CHARACTER -> arrayOf(LunaHighlightColors.BAD_CHAR)
            else -> emptyArray()
        }
}

class LunaSyntaxHighlighterFactory : SyntaxHighlighterFactory() {

    override fun getSyntaxHighlighter(
        project: Project?,
        virtualFile: VirtualFile?
    ): SyntaxHighlighter = LunaSyntaxHighlighter()
}
