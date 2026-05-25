package ai.lunaos.intellij.language

import com.intellij.lang.Language
import com.intellij.openapi.fileTypes.LanguageFileType
import javax.swing.Icon

object LunaLanguage : Language("Luna") {

    override fun getDisplayName(): String = "Luna"

    override fun isCaseSensitive(): Boolean = true
}

object LunaFileType : LanguageFileType(LunaLanguage) {

    @JvmField
    val INSTANCE: LunaFileType = this

    override fun getName(): String = "Luna"

    override fun getDescription(): String = "Luna pipe-based AI agent DSL"

    override fun getDefaultExtension(): String = "luna"

    override fun getIcon(): Icon? = null
}
