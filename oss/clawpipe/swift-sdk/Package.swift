// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "ClawPipe",
    platforms: [.macOS(.v13), .iOS(.v16)],
    products: [.library(name: "ClawPipe", targets: ["ClawPipe"])],
    targets: [
        .target(name: "ClawPipe", path: "Sources/ClawPipe"),
        .testTarget(
            name: "ClawPipeTests",
            dependencies: ["ClawPipe"],
            path: "Tests/ClawPipeTests"
        ),
    ]
)
