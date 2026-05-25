plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "1.9.20"
    id("org.jetbrains.intellij.platform") version "2.0.1"
}

group = "com.upm"
version = "1.0.0"

repositories {
    mavenCentral()

    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    // Kotlin Standard Library
    implementation("org.jetbrains.kotlin:kotlin-stdlib-jdk8")

    // IntelliJ Platform Implementation
    intellijPlatform {
        intellijIdeaCommunity("2023.3.6")

        // Required plugins for dependency analysis
        plugins(
            "com.intellij.java",
            "org.jetbrains.kotlin",
            "Gradle",
            "Maven"
        )

        // Plugin dependencies
        pluginVerifier()
        zipSigner()
        instrumentationTools()
    }

    // HTTP Client for API communication
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")

    // JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // Logging
    implementation("ch.qos.logback:logback-classic:1.4.14")

    // WebSocket support
    implementation("org.java-websocket:Java-WebSocket:1.5.4")

    // Dependency injection (lightweight)
    implementation("io.insert-koin:koin-core:3.5.3")

    // Test dependencies
    testImplementation("org.jetbrains.kotlin:kotlin-test")
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.1")
    testImplementation("org.junit.jupiter:junit-jupiter-engine:5.10.1")
    testImplementation("org.mockito:mockito-core:5.8.0")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
}

// Configure Java/Kotlin compilation
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    jvmToolchain(17)
}

// Configure IntelliJ Platform plugin
intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "233"
            untilBuild = "241.*"
        }

        plugins {
            id("com.upm.intellij")
        }
    }

    pluginVerification {
        ides {
            recommended()
        }
    }

    signing {
        certificateChain = providers.environmentVariable("CERTIFICATE_CHAIN")
        privateKey = providers.environmentVariable("PRIVATE_KEY")
        password = providers.environmentVariable("PRIVATE_KEY_PASSWORD")
    }

    publishing {
        token = providers.environmentVariable("PUBLISH_TOKEN")
    }
}

// Test configuration
tasks.test {
    useJUnitPlatform()

    // Set system properties for tests
    systemProperty("idea.tests.reports.path", "build/test-results")

    // Configure test logging
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat("full")
    }
}

// Configure plugin Jar
tasksJar.configure {
    archiveBaseName.set("upm-intellij-plugin")
    archiveVersion.set(project.version.toString())

    manifest {
        attributes["Plugin-Id"] = "com.upm.intellij"
        attributes["Plugin-Version"] = project.version
        attributes["Plugin-Provider"] = "Universal Dependency Platform"
    }
}

// Prepare sandbox task configuration
tasks.prepareSandbox {
    from("src/main/resources") {
        into("com.upm.intellij")
    }
}

// Build verification tasks
tasks.register("verifyPlugin") {
    dependsOn("verifyPlugin")
    group = "verification"
    description = "Verify the plugin before publishing"
}

// Custom tasks
tasks.register("runIdeWithPlugin") {
    dependsOn("runIde")
    group = "intellij"
    description = "Run IntelliJ IDEA with the UPM plugin installed"
}

// Configure clean task to remove build artifacts
tasks.clean {
    delete("build", "out", "sandbox")
}

// Help task
tasks.register("pluginInfo") {
    doLast {
        println("UPM IntelliJ Plugin")
        println("Version: ${project.version}")
        println("Group: ${project.group}")
        println("Kotlin: ${kotlin.coreLibrariesVersion}")
        println("IntelliJ Platform: 2023.3.6")
    }
}
