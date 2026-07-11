// swift-tools-version:5.9
import PackageDescription

let package = Package(
  name: "TimerActivityModel",
  platforms: [.iOS(.v17)],
  products: [.library(name: "TimerActivityModel", targets: ["TimerActivityModel"])],
  targets: [.target(name: "TimerActivityModel")]
)
