// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "WorkflowNativeCore", platforms: [.iOS(.v15), .macOS(.v12)],
    products: [.library(name: "WorkflowNativeCore", targets: ["WorkflowNativeCore"])],
    targets: [.target(name: "WorkflowNativeCore"), .testTarget(name: "WorkflowNativeCoreTests", dependencies: ["WorkflowNativeCore"])])
