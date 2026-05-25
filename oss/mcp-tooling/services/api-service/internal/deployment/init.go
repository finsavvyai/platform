package deployment

func init() {
	// Register all deployment providers
	GlobalDeploymentRegistry.Register(NewAWSLambdaDeployment())
	GlobalDeploymentRegistry.Register(NewDedicatedProvider())
	// Register other providers as they are implemented...
}
