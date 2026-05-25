// Package actions runs GitHub Actions workflow files via the nektos/act
// engine. It is the bridge that lets PushCI execute existing
// .github/workflows/*.yml files end-to-end — including complex actions
// like actions/checkout, setup-node, matrix builds, and service containers
// — without users having to rewrite anything.
//
// The package is deliberately a thin wrapper: act owns the workflow
// runtime, expression engine, action resolution, and Docker orchestration.
// PushCI owns workflow detection, options validation, secret material
// handoff, structured event streaming, and integration with the dispatcher.
package actions
