plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.0.21"
    id("org.jetbrains.intellij.platform") version "2.2.1"
    id("org.jetbrains.changelog") version "2.2.1"
}

group = providers.gradleProperty("pluginGroup").get()
version = providers.gradleProperty("pluginVersion").get()

repositories {
    mavenCentral()
    intellijPlatform { defaultRepositories() }
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity("2024.1.7")
        pluginVerifier()
        zipSigner()
        instrumentationTools()
    }

    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")
    testImplementation("junit:junit:4.13.2")
}

changelog {
    version.set(providers.gradleProperty("pluginVersion"))
    path.set(file("CHANGELOG.md").canonicalPath)
    groups.empty()
}

intellijPlatform {
    pluginConfiguration {
        name = providers.gradleProperty("pluginName")
        version = providers.gradleProperty("pluginVersion")
        description = provider {
            file("src/main/resources/META-INF/plugin.xml")
                .readText()
                .substringAfter("<description><![CDATA[")
                .substringBefore("]]></description>")
                .trim()
        }
        changeNotes = provider {
            changelog.renderItem(
                changelog.getLatest(),
                org.jetbrains.changelog.Changelog.OutputType.HTML
            )
        }
        ideaVersion {
            sinceBuild = "241"
            untilBuild = "261.*"
        }
    }
    pluginVerification {
        ides { recommended() }
    }
}

kotlin { jvmToolchain(17) }

tasks {
    wrapper { gradleVersion = "8.11.1" }
}
