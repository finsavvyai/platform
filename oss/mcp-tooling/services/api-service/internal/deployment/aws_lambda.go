package deployment

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mcpoverflow/api-service/internal/parser"
)

// AWSLambdaDeployment handles AWS Lambda deployment automation
type AWSLambdaDeployment struct {
	*BaseDeployment
}

// NewAWSLambdaDeployment creates a new AWS Lambda deployment handler
func NewAWSLambdaDeployment() *AWSLambdaDeployment {
	features := []DeploymentFeature{
		DeploymentFeatureSAM,
		DeploymentFeatureCDK,
		DeploymentFeatureTerraform,
		DeploymentFeatureCICD,
		DeploymentFeatureMonitoring,
		DeploymentFeatureAutoScaling,
		DeploymentFeatureEnvironmentVariables,
		DeploymentFeatureSecrets,
		DeploymentFeatureVPC,
		DeploymentFeatureIAMRoles,
	}

	return &AWSLambdaDeployment{
		BaseDeployment: NewBaseDeployment("aws-lambda", "1.0.0", features),
	}
}

// Generate generates AWS Lambda deployment files
func (d *AWSLambdaDeployment) Generate(ctx context.Context, ir *parser.IntermediateRepresentation, opts DeploymentOptions) (*DeploymentPackage, error) {
	startTime := time.Now()

	files := []DeploymentFile{}

	// Generate SAM deployment files
	if opts.UseSAM {
		samFiles, err := d.generateSAMDeployment(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate SAM deployment: %w", err)
		}
		files = append(files, samFiles...)
	}

	// Generate CDK deployment files
	if opts.UseCDK {
		cdkFiles, err := d.generateCDKDeployment(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate CDK deployment: %w", err)
		}
		files = append(files, cdkFiles...)
	}

	// Generate Terraform files
	if opts.UseTerraform {
		tfFiles, err := d.generateTerraformDeployment(ir, opts)
		if err != nil {
			return nil, fmt.Errorf("failed to generate Terraform deployment: %w", err)
		}
		files = append(files, tfFiles...)
	}

	// Generate CI/CD pipeline files
	cicdFiles, err := d.generateCICDPipeline(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate CI/CD pipeline: %w", err)
	}
	files = append(files, cicdFiles...)

	// Generate deployment scripts
	scriptFiles, err := d.generateDeploymentScripts(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate deployment scripts: %w", err)
	}
	files = append(files, scriptFiles...)

	// Generate monitoring configuration
	monitoringFiles, err := d.generateMonitoringConfig(ir, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to generate monitoring config: %w", err)
	}
	files = append(files, monitoringFiles...)

	// Create deployment package
	pkg := &DeploymentPackage{
		Platform:  "aws-lambda",
		Files:     files,
		CreatedAt: time.Now(),
		Metadata: DeploymentMetadata{
			Platform:       "aws-lambda",
			Region:         opts.AWSRegion,
			Runtime:        opts.Runtime,
			MemorySize:     opts.MemorySize,
			Timeout:        opts.Timeout,
			HasVPC:         opts.UseVPC,
			HasMonitoring:  true,
			HasAutoScaling: opts.EnableAutoScaling,
			Extensions: map[string]interface{}{
				"sam_enabled":       opts.UseSAM,
				"cdk_enabled":       opts.UseCDK,
				"terraform_enabled": opts.UseTerraform,
				"endpoints_count":   len(ir.Endpoints),
			},
		},
		Statistics: DeploymentStatistics{
			TotalFiles:      len(files),
			ConfigFiles:     d.countFilesByType(files, FileTypeConfig),
			ScriptFiles:     d.countFilesByType(files, FileTypeScript),
			GenerationTime:  time.Since(startTime),
			EstimatedCost:   d.estimateMonthlyCost(ir, opts),
			RequiredSecrets: d.extractRequiredSecrets(ir),
		},
	}

	return pkg, nil
}

// generateSAMDeployment generates AWS SAM deployment files
func (d *AWSLambdaDeployment) generateSAMDeployment(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate enhanced SAM template
	samTemplate, err := d.generateEnhancedSAMTemplate(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "template.yaml",
		Content:  samTemplate,
		FileType: FileTypeConfig,
	})

	// Generate SAM config file
	samConfig, err := d.generateSAMConfig(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "samconfig.toml",
		Content:  samConfig,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateEnhancedSAMTemplate generates an enhanced AWS SAM template with all features
func (d *AWSLambdaDeployment) generateEnhancedSAMTemplate(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	apiName := d.sanitizeResourceName(ir.Metadata.Name)
	hasAuth := len(ir.Auth) > 0

	_ = hasAuth // Reserved for future auth configuration

	template := fmt.Sprintf(`AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: >
  %s

  MCP Connector generated from %s
  Platform: AWS Lambda with API Gateway

# Global configuration
Globals:
  Function:
    Timeout: %d
    MemorySize: %d
    Runtime: %s
    Architectures:
      - %s
    Environment:
      Variables:
        LOG_LEVEL: !Ref LogLevel
        POWERTOOLS_SERVICE_NAME: %s
        POWERTOOLS_METRICS_NAMESPACE: MCPConnector
%s

# Parameters for configurable deployment
Parameters:
  Environment:
    Type: String
    Default: dev
    AllowedValues:
      - dev
      - staging
      - prod
    Description: Deployment environment

  LogLevel:
    Type: String
    Default: INFO
    AllowedValues:
      - DEBUG
      - INFO
      - WARNING
      - ERROR
    Description: Log level for Lambda functions

  MemorySize:
    Type: Number
    Default: %d
    MinValue: 128
    MaxValue: 10240
    Description: Lambda function memory size in MB

  Timeout:
    Type: Number
    Default: %d
    MinValue: 3
    MaxValue: 900
    Description: Lambda function timeout in seconds

%s

# Resources
Resources:
  # Lambda function
  %sFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: ./
      Handler: handler.lambda_handler
      Description: MCP Connector for %s

      # API Gateway configuration
      Events:
        McpManifest:
          Type: Api
          Properties:
            Path: /.well-known/mcp.json
            Method: GET
            RestApiId: !Ref %sApi

        McpExecute:
          Type: Api
          Properties:
            Path: /mcp/execute
            Method: POST
            RestApiId: !Ref %sApi
%s

      # Environment variables
      Environment:
        Variables:
          API_BASE_URL: %s
%s

      # Policies and permissions
      Policies:
        - Version: '2012-10-17'
          Statement:
            - Effect: Allow
              Action:
                - logs:CreateLogGroup
                - logs:CreateLogStream
                - logs:PutLogEvents
              Resource: '*'
%s

      # Tags
      Tags:
        Environment: !Ref Environment
        Application: MCPConnector
        Service: %s
        ManagedBy: SAM
%s

  # API Gateway
  %sApi:
    Type: AWS::Serverless::Api
    Properties:
      StageName: !Ref Environment
      Cors:
        AllowMethods: "'GET,POST,OPTIONS'"
        AllowHeaders: "'Content-Type,Authorization,X-Api-Key'"
        AllowOrigin: "'*'"

      # API Gateway logging
      AccessLogSetting:
        DestinationArn: !GetAtt ApiLogGroup.Arn
        Format: '$context.requestId $context.extendedRequestId $context.identity.sourceIp $context.requestTime $context.httpMethod $context.resourcePath $context.status $context.protocol $context.responseLength'

      # Throttling
      ThrottleSettings:
        BurstLimit: 100
        RateLimit: 50
%s

  # CloudWatch Log Group for API Gateway
  ApiLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/apigateway/${AWS::StackName}'
      RetentionInDays: 30

  # CloudWatch Log Group for Lambda
  FunctionLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/${%sFunction}'
      RetentionInDays: 30

%s

%s

%s

# Outputs
Outputs:
  ApiEndpoint:
    Description: "API Gateway endpoint URL"
    Value: !Sub "https://${%sApi}.execute-api.${AWS::Region}.amazonaws.com/${Environment}"
    Export:
      Name: !Sub "${AWS::StackName}-ApiEndpoint"

  FunctionArn:
    Description: "Lambda Function ARN"
    Value: !GetAtt %sFunction.Arn
    Export:
      Name: !Sub "${AWS::StackName}-FunctionArn"

  FunctionName:
    Description: "Lambda Function Name"
    Value: !Ref %sFunction
    Export:
      Name: !Sub "${AWS::StackName}-FunctionName"

%s
`,
		ir.Metadata.Title,
		ir.Metadata.Name,
		opts.Timeout,
		opts.MemorySize,
		opts.Runtime,
		opts.Architecture,
		apiName,
		d.generateVPCConfig(opts),
		opts.MemorySize,
		opts.Timeout,
		d.generateAuthParameters(ir, opts),
		apiName,
		ir.Metadata.Title,
		apiName,
		apiName,
		d.generateAPIRoutes(ir, apiName),
		d.getAPIBaseURL(ir),
		d.generateAuthEnvVars(ir),
		d.generateSecretsPolicy(ir, opts),
		apiName,
		d.generateVPCTags(opts),
		apiName,
		d.generateAPIGatewayAuth(ir),
		apiName,
		d.generateAlarmResources(ir, apiName, opts),
		d.generateAutoScalingResources(ir, apiName, opts),
		d.generateDashboardResource(ir, apiName, opts),
		apiName,
		apiName,
		apiName,
		d.generateAdditionalOutputs(ir, apiName, opts),
	)

	return template, nil
}

// generateSAMConfig generates samconfig.toml file
func (d *AWSLambdaDeployment) generateSAMConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	stackName := d.sanitizeResourceName(ir.Metadata.Name)

	config := fmt.Sprintf(`version = 0.1

[default.global.parameters]
stack_name = "%s"

[default.build.parameters]
cached = true
parallel = true

[default.validate.parameters]
lint = true

[default.deploy.parameters]
capabilities = "CAPABILITY_IAM"
confirm_changeset = true
resolve_s3 = true
region = "%s"
image_repositories = []

[default.package.parameters]
resolve_s3 = true

[default.sync.parameters]
watch = true

[default.local_start_api.parameters]
warm_containers = "EAGER"

[default.local_start_lambda.parameters]
warm_containers = "EAGER"
`,
		stackName,
		opts.AWSRegion,
	)

	return config, nil
}

// generateCDKDeployment generates AWS CDK deployment files
func (d *AWSLambdaDeployment) generateCDKDeployment(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate CDK app file
	cdkApp, err := d.generateCDKApp(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "cdk/app.ts",
		Content:  cdkApp,
		FileType: FileTypeSource,
	})

	// Generate CDK stack file
	cdkStack, err := d.generateCDKStack(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "cdk/lib/mcp-stack.ts",
		Content:  cdkStack,
		FileType: FileTypeSource,
	})

	// Generate CDK package.json
	cdkPackage, err := d.generateCDKPackageJSON(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "cdk/package.json",
		Content:  cdkPackage,
		FileType: FileTypeConfig,
	})

	// Generate CDK tsconfig.json
	cdkTSConfig, err := d.generateCDKTSConfig(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "cdk/tsconfig.json",
		Content:  cdkTSConfig,
		FileType: FileTypeConfig,
	})

	// Generate cdk.json
	cdkJSON, err := d.generateCDKJSON(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "cdk/cdk.json",
		Content:  cdkJSON,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// generateCDKApp generates CDK app.ts file
func (d *AWSLambdaDeployment) generateCDKApp(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	stackName := d.toClassName(ir.Metadata.Name)

	app := fmt.Sprintf(`#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { %sStack } from './lib/mcp-stack';

const app = new cdk.App();

new %sStack(app, '%sStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || '%s',
  },
  description: '%s - MCP Connector CDK Stack',
  tags: {
    Application: 'MCPConnector',
    Service: '%s',
    ManagedBy: 'CDK',
  },
});

app.synth();
`,
		stackName,
		stackName,
		stackName,
		opts.AWSRegion,
		ir.Metadata.Title,
		ir.Metadata.Name,
	)

	return app, nil
}

// generateCDKStack generates CDK stack file
func (d *AWSLambdaDeployment) generateCDKStack(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	stackName := d.toClassName(ir.Metadata.Name)
	hasAuth := len(ir.Auth) > 0

	_ = hasAuth // Will be used for API Gateway auth configuration

	stack := fmt.Sprintf(`import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as applicationautoscaling from 'aws-cdk-lib/aws-applicationautoscaling';
import { Construct } from 'constructs';

export interface %sStackProps extends cdk.StackProps {
  environment?: string;
  logLevel?: string;
  memorySize?: number;
  timeout?: number;
}

export class %sStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly function: lambda.Function;
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: %sStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';
    const logLevel = props?.logLevel || 'INFO';
    const memorySize = props?.memorySize || %d;
    const timeout = props?.timeout || %d;

    // SNS Topic for alarms
    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      displayName: '%s MCP Connector Alarms',
      topicName: '${this.stackName}-alarms',
    });

    // Lambda function
    this.function = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.%s,
      handler: 'handler.lambda_handler',
      code: lambda.Code.fromAsset('../'),
      memorySize: memorySize,
      timeout: cdk.Duration.seconds(timeout),
      architecture: lambda.Architecture.%s,
      environment: {
        LOG_LEVEL: logLevel,
        POWERTOOLS_SERVICE_NAME: '%s',
        POWERTOOLS_METRICS_NAMESPACE: 'MCPConnector',
        API_BASE_URL: '%s',
%s
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'MCP Connector for %s',
%s
    });

%s

    // API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: '%s MCP Connector',
      description: '%s',
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        tracingEnabled: true,
        throttlingBurstLimit: 100,
        throttlingRateLimit: 50,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Api-Key',
        ],
      },
%s
    });

    // Lambda integration
    const lambdaIntegration = new apigateway.LambdaIntegration(this.function, {
      proxy: true,
    });

    // MCP manifest endpoint
    const manifestResource = this.api.root
      .addResource('.well-known')
      .addResource('mcp.json');
    manifestResource.addMethod('GET', lambdaIntegration);

    // MCP execute endpoint
    const executeResource = this.api.root
      .addResource('mcp')
      .addResource('execute');
    executeResource.addMethod('POST', lambdaIntegration);

    // CloudWatch alarms
    this.createAlarms(this.function, this.api, this.alarmTopic);

%s

    // CloudWatch Dashboard
    this.createDashboard(this.function, this.api);

    // Outputs
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: '${this.stackName}-ApiEndpoint',
    });

    new cdk.CfnOutput(this, 'FunctionArn', {
      value: this.function.functionArn,
      description: 'Lambda Function ARN',
      exportName: '${this.stackName}-FunctionArn',
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: this.function.functionName,
      description: 'Lambda Function Name',
      exportName: '${this.stackName}-FunctionName',
    });
  }

  private createAlarms(
    func: lambda.Function,
    api: apigateway.RestApi,
    topic: sns.Topic
  ): void {
    // Lambda error alarm
    const errorAlarm = new cloudwatch.Alarm(this, 'FunctionErrorAlarm', {
      metric: func.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda function error rate is too high',
      alarmName: '${this.stackName}-function-errors',
    });
    errorAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(topic));

    // Lambda throttle alarm
    const throttleAlarm = new cloudwatch.Alarm(this, 'FunctionThrottleAlarm', {
      metric: func.metricThrottles(),
      threshold: 10,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda function is being throttled',
      alarmName: '${this.stackName}-function-throttles',
    });
    throttleAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(topic));

    // Lambda duration alarm
    const durationAlarm = new cloudwatch.Alarm(this, 'FunctionDurationAlarm', {
      metric: func.metricDuration(),
      threshold: func.timeout!.toMilliseconds() * 0.8,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Lambda function duration is approaching timeout',
      alarmName: '${this.stackName}-function-duration',
    });
    durationAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(topic));

    // API Gateway 5xx alarm
    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      metric: api.metricServerError(),
      threshold: 5,
      evaluationPeriods: 2,
      datapointsToAlarm: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gateway 5xx error rate is too high',
      alarmName: '${this.stackName}-api-5xx-errors',
    });
    api5xxAlarm.addAlarmAction(new cdk.aws_cloudwatch_actions.SnsAction(topic));
  }

  private createDashboard(func: lambda.Function, api: apigateway.RestApi): void {
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: '${this.stackName}-MCP-Connector',
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Invocations',
        left: [func.metricInvocations()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Errors',
        left: [func.metricErrors()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Duration',
        left: [func.metricDuration()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'Lambda Throttles',
        left: [func.metricThrottles()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Requests',
        left: [api.metricCount()],
        width: 12,
      }),
      new cloudwatch.GraphWidget({
        title: 'API Gateway Errors',
        left: [api.metricClientError(), api.metricServerError()],
        width: 12,
      })
    );
  }

%s
}
`,
		stackName,
		stackName,
		stackName,
		opts.MemorySize,
		opts.Timeout,
		ir.Metadata.Title,
		d.getLambdaRuntime(opts.Runtime),
		d.getLambdaArchitecture(opts.Architecture),
		ir.Metadata.Name,
		d.getAPIBaseURL(ir),
		d.generateCDKAuthEnvVars(ir),
		ir.Metadata.Title,
		d.generateCDKVPCConfig(opts),
		d.generateCDKSecretsPolicy(ir, opts),
		ir.Metadata.Title,
		ir.Metadata.Description,
		d.generateCDKAPIGatewayAuth(ir, hasAuth),
		d.generateCDKAutoScaling(opts),
		d.generateCDKAdditionalMethods(opts),
	)

	return stack, nil
}

// generateCDKPackageJSON generates CDK package.json file
func (d *AWSLambdaDeployment) generateCDKPackageJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	pkgJSON := `{
  "name": "mcp-connector-cdk",
  "version": "1.0.0",
  "description": "AWS CDK deployment for MCP Connector",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "test": "jest",
    "cdk": "cdk",
    "deploy": "cdk deploy",
    "diff": "cdk diff",
    "synth": "cdk synth",
    "destroy": "cdk destroy"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "aws-cdk": "^2.100.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.1",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.100.0",
    "constructs": "^10.0.0",
    "source-map-support": "^0.5.21"
  }
}
`
	return pkgJSON, nil
}

// generateCDKTSConfig generates CDK tsconfig.json file
func (d *AWSLambdaDeployment) generateCDKTSConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	tsconfig := `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["es2020"],
    "declaration": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": false,
    "inlineSourceMap": true,
    "inlineSources": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "typeRoots": ["./node_modules/@types"]
  },
  "exclude": ["node_modules", "cdk.out"]
}
`
	return tsconfig, nil
}

// generateCDKJSON generates cdk.json file
func (d *AWSLambdaDeployment) generateCDKJSON(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	cdkJSON := `{
  "app": "npx ts-node --prefer-ts-exts app.ts",
  "watch": {
    "include": ["**"],
    "exclude": [
      "README.md",
      "cdk*.json",
      "**/*.d.ts",
      "**/*.js",
      "tsconfig.json",
      "package*.json",
      "yarn.lock",
      "node_modules",
      "test"
    ]
  },
  "context": {
    "@aws-cdk/aws-lambda:recognizeLayerVersion": true,
    "@aws-cdk/core:checkSecretUsage": true,
    "@aws-cdk/core:target-partitions": ["aws", "aws-cn"],
    "@aws-cdk-containers/ecs-service-extensions:enableDefaultLogDriver": true,
    "@aws-cdk/aws-ec2:uniqueImdsv2TemplateName": true,
    "@aws-cdk/aws-ecs:arnFormatIncludesClusterName": true,
    "@aws-cdk/aws-iam:minimizePolicies": true,
    "@aws-cdk/core:validateSnapshotRemovalPolicy": true,
    "@aws-cdk/aws-codepipeline:crossAccountKeyAliasStackSafeResourceName": true,
    "@aws-cdk/aws-s3:createDefaultLoggingPolicy": true,
    "@aws-cdk/aws-sns-subscriptions:restrictSqsDescryption": true,
    "@aws-cdk/aws-apigateway:usagePlanKeyOrderInsensitiveId": true,
    "@aws-cdk/core:stackRelativeExports": true,
    "@aws-cdk/aws-rds:lowercaseDbIdentifier": true,
    "@aws-cdk/aws-lambda:recognizeVersionProps": true,
    "@aws-cdk/aws-cloudfront:defaultSecurityPolicyTLSv1.2_2021": true
  }
}
`
	return cdkJSON, nil
}

// generateTerraformDeployment generates Terraform deployment files
func (d *AWSLambdaDeployment) generateTerraformDeployment(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate main.tf
	mainTF, err := d.generateTerraformMain(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/main.tf",
		Content:  mainTF,
		FileType: FileTypeConfig,
	})

	// Generate variables.tf
	variablesTF, err := d.generateTerraformVariables(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/variables.tf",
		Content:  variablesTF,
		FileType: FileTypeConfig,
	})

	// Generate outputs.tf
	outputsTF, err := d.generateTerraformOutputs(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/outputs.tf",
		Content:  outputsTF,
		FileType: FileTypeConfig,
	})

	// Generate backend.tf
	backendTF, err := d.generateTerraformBackend(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "terraform/backend.tf",
		Content:  backendTF,
		FileType: FileTypeConfig,
	})

	return files, nil
}

// Helper methods continue below...
func (d *AWSLambdaDeployment) generateVPCConfig(opts DeploymentOptions) string {
	if !opts.UseVPC {
		return ""
	}
	return fmt.Sprintf(`    VpcConfig:
      SecurityGroupIds:
        - !Ref LambdaSecurityGroup
      SubnetIds:
        - !Ref PrivateSubnet1
        - !Ref PrivateSubnet2`)
}

func (d *AWSLambdaDeployment) generateAuthParameters(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `  ApiKey:
    Type: String
    NoEcho: true
    Description: API Key for authentication`
	case "http":
		if auth.Scheme == "bearer" {
			return `  BearerToken:
    Type: String
    NoEcho: true
    Description: Bearer token for authentication`
		}
	case "oauth2":
		return `  ClientId:
    Type: String
    Description: OAuth2 Client ID

  ClientSecret:
    Type: String
    NoEcho: true
    Description: OAuth2 Client Secret`
	}
	return ""
}

func (d *AWSLambdaDeployment) generateAPIRoutes(ir *parser.IntermediateRepresentation, apiName string) string {
	// Additional API routes can be generated here
	return ""
}

func (d *AWSLambdaDeployment) getAPIBaseURL(ir *parser.IntermediateRepresentation) string {
	if len(ir.Servers) > 0 {
		return ir.Servers[0].URL
	}
	return "https://api.example.com"
}

func (d *AWSLambdaDeployment) generateAuthEnvVars(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `          API_KEY: !Ref ApiKey`
	case "http":
		if auth.Scheme == "bearer" {
			return `          BEARER_TOKEN: !Ref BearerToken`
		}
	case "oauth2":
		return `          CLIENT_ID: !Ref ClientId
          CLIENT_SECRET: !Ref ClientSecret`
	}
	return ""
}

func (d *AWSLambdaDeployment) generateSecretsPolicy(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	if len(ir.Auth) == 0 {
		return ""
	}
	return `
            - Effect: Allow
              Action:
                - secretsmanager:GetSecretValue
              Resource: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:*'`
}

func (d *AWSLambdaDeployment) generateVPCTags(opts DeploymentOptions) string {
	if !opts.UseVPC {
		return ""
	}
	return `
        VPC: !Ref VPC`
}

func (d *AWSLambdaDeployment) generateAPIGatewayAuth(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}
	// Can add API Gateway authorizers here
	return ""
}

func (d *AWSLambdaDeployment) generateAlarmResources(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	return fmt.Sprintf(`  # CloudWatch Alarms
  FunctionErrorAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-function-errors'
      AlarmDescription: Lambda function error rate is too high
      MetricName: Errors
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 5
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref %sFunction
      TreatMissingData: notBreaching

  FunctionThrottleAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: !Sub '${AWS::StackName}-function-throttles'
      AlarmDescription: Lambda function is being throttled
      MetricName: Throttles
      Namespace: AWS/Lambda
      Statistic: Sum
      Period: 300
      EvaluationPeriods: 2
      Threshold: 10
      ComparisonOperator: GreaterThanThreshold
      Dimensions:
        - Name: FunctionName
          Value: !Ref %sFunction
      TreatMissingData: notBreaching`, apiName, apiName)
}

func (d *AWSLambdaDeployment) generateAutoScalingResources(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	if !opts.EnableAutoScaling {
		return ""
	}
	return fmt.Sprintf(`  # Auto Scaling
  FunctionScalableTarget:
    Type: AWS::ApplicationAutoScaling::ScalableTarget
    Properties:
      MaxCapacity: 100
      MinCapacity: 1
      ResourceId: !Sub 'function:${%sFunction}:provisioned-concurrency'
      RoleARN: !GetAtt AutoScalingRole.Arn
      ScalableDimension: lambda:function:ProvisionedConcurrentExecutions
      ServiceNamespace: lambda

  FunctionScalingPolicy:
    Type: AWS::ApplicationAutoScaling::ScalingPolicy
    Properties:
      PolicyName: !Sub '${AWS::StackName}-scaling-policy'
      PolicyType: TargetTrackingScaling
      ScalingTargetId: !Ref FunctionScalableTarget
      TargetTrackingScalingPolicyConfiguration:
        TargetValue: 0.70
        PredefinedMetricSpecification:
          PredefinedMetricType: LambdaProvisionedConcurrencyUtilization

  AutoScalingRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              Service: application-autoscaling.amazonaws.com
            Action: 'sts:AssumeRole'
      ManagedPolicyArns:
        - 'arn:aws:iam::aws:policy/service-role/AWSLambdaRole'`, apiName)
}

func (d *AWSLambdaDeployment) generateDashboardResource(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	return fmt.Sprintf(`  # CloudWatch Dashboard
  Dashboard:
    Type: AWS::CloudWatch::Dashboard
    Properties:
      DashboardName: !Sub '${AWS::StackName}-MCP-Connector'
      DashboardBody: !Sub |
        {
          "widgets": [
            {
              "type": "metric",
              "properties": {
                "metrics": [
                  ["AWS/Lambda", "Invocations", {"stat": "Sum", "label": "Invocations"}],
                  [".", "Errors", {"stat": "Sum", "label": "Errors"}],
                  [".", "Throttles", {"stat": "Sum", "label": "Throttles"}],
                  [".", "Duration", {"stat": "Average", "label": "Duration"}]
                ],
                "view": "timeSeries",
                "region": "${AWS::Region}",
                "title": "Lambda Metrics",
                "period": 300
              }
            }
          ]
        }`)
}

func (d *AWSLambdaDeployment) generateAdditionalOutputs(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	return ""
}

// Continuation of helper methods...

func (d *AWSLambdaDeployment) toClassName(s string) string {
	// Convert "my-api" to "MyApi"
	parts := strings.Split(s, "-")
	result := ""
	for _, part := range parts {
		if len(part) > 0 {
			result += strings.ToUpper(part[0:1]) + part[1:]
		}
	}
	return result
}

func (d *AWSLambdaDeployment) getLambdaRuntime(runtime string) string {
	// Map runtime string to CDK runtime
	runtimeMap := map[string]string{
		"python3.9":  "PYTHON_3_9",
		"python3.10": "PYTHON_3_10",
		"python3.11": "PYTHON_3_11",
		"python3.12": "PYTHON_3_12",
		"nodejs18.x": "NODEJS_18_X",
		"nodejs20.x": "NODEJS_20_X",
	}
	if mapped, ok := runtimeMap[runtime]; ok {
		return mapped
	}
	return "PYTHON_3_11"
}

func (d *AWSLambdaDeployment) getLambdaArchitecture(arch string) string {
	if arch == "arm64" {
		return "ARM_64"
	}
	return "X86_64"
}

func (d *AWSLambdaDeployment) generateCDKAuthEnvVars(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `        API_KEY: process.env.API_KEY || '',`
	case "http":
		if auth.Scheme == "bearer" {
			return `        BEARER_TOKEN: process.env.BEARER_TOKEN || '',`
		}
	case "oauth2":
		return `        CLIENT_ID: process.env.CLIENT_ID || '',
        CLIENT_SECRET: process.env.CLIENT_SECRET || '',`
	}
	return ""
}

func (d *AWSLambdaDeployment) generateCDKVPCConfig(opts DeploymentOptions) string {
	if !opts.UseVPC {
		return ""
	}
	return `      vpc: ec2.Vpc.fromLookup(this, 'VPC', {
        isDefault: false,
      }),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [
        new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
          vpc,
          description: 'Security group for Lambda function',
          allowAllOutbound: true,
        }),
      ],`
}

func (d *AWSLambdaDeployment) generateCDKSecretsPolicy(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	if len(ir.Auth) == 0 {
		return ""
	}
	return `
    // Grant access to secrets
    this.function.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['secretsmanager:GetSecretValue'],
      resources: ['*'],
    }));`
}

func (d *AWSLambdaDeployment) generateCDKAPIGatewayAuth(ir *parser.IntermediateRepresentation, hasAuth bool) string {
	if !hasAuth {
		return ""
	}
	// Can add API Gateway authorizers here
	return ""
}

func (d *AWSLambdaDeployment) generateCDKAutoScaling(opts DeploymentOptions) string {
	if !opts.EnableAutoScaling {
		return ""
	}
	return `
    // Provisioned Concurrency Auto Scaling
    const alias = this.function.currentVersion.addAlias('live');
    const target = alias.addAutoScaling({
      minCapacity: 1,
      maxCapacity: 100,
    });
    target.scaleOnUtilization({
      utilizationTarget: 0.70,
    });`
}

func (d *AWSLambdaDeployment) generateCDKAdditionalMethods(opts DeploymentOptions) string {
	return ""
}

// Terraform generation methods
func (d *AWSLambdaDeployment) generateTerraformMain(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	apiName := d.sanitizeResourceName(ir.Metadata.Name)

	mainTF := fmt.Sprintf(`# Terraform configuration for %s MCP Connector

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Application = "MCPConnector"
      Service     = "%s"
      ManagedBy   = "Terraform"
      Environment = var.environment
    }
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Archive Lambda code
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "../"
  output_path = "${path.module}/lambda.zip"
  excludes = [
    "terraform",
    "cdk",
    ".git",
    "*.md",
  ]
}

# IAM Role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${var.stack_name}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda.name
}

%s

# Lambda Function
resource "aws_lambda_function" "main" {
  filename         = data.archive_file.lambda.output_path
  function_name    = var.stack_name
  role            = aws_iam_role.lambda.arn
  handler         = "handler.lambda_handler"
  source_code_hash = data.archive_file.lambda.output_base64sha256
  runtime         = var.runtime
  memory_size     = var.memory_size
  timeout         = var.timeout
  architectures   = [var.architecture]

  environment {
    variables = {
      LOG_LEVEL                      = var.log_level
      POWERTOOLS_SERVICE_NAME        = "%s"
      POWERTOOLS_METRICS_NAMESPACE   = "MCPConnector"
      API_BASE_URL                   = "%s"
%s
    }
  }

%s

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic,
    aws_cloudwatch_log_group.lambda,
  ]
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.stack_name}"
  retention_in_days = 30
}

# Lambda Permission for API Gateway
resource "aws_lambda_permission" "apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.main.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
}

# API Gateway
resource "aws_api_gateway_rest_api" "main" {
  name        = "%s-mcp-connector"
  description = "%s"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway Resources and Methods
resource "aws_api_gateway_resource" "well_known" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = ".well-known"
}

resource "aws_api_gateway_resource" "mcp_json" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.well_known.id
  path_part   = "mcp.json"
}

resource "aws_api_gateway_method" "mcp_json_get" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.mcp_json.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mcp_json_get" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.mcp_json.id
  http_method = aws_api_gateway_method.mcp_json_get.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.main.invoke_arn
}

resource "aws_api_gateway_resource" "mcp" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "mcp"
}

resource "aws_api_gateway_resource" "execute" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.mcp.id
  path_part   = "execute"
}

resource "aws_api_gateway_method" "execute_post" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.execute.id
  http_method   = "POST"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "execute_post" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.execute.id
  http_method = aws_api_gateway_method.execute_post.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.main.invoke_arn
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "main" {
  depends_on = [
    aws_api_gateway_integration.mcp_json_get,
    aws_api_gateway_integration.execute_post,
  ]

  rest_api_id = aws_api_gateway_rest_api.main.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.well_known.id,
      aws_api_gateway_resource.mcp_json.id,
      aws_api_gateway_method.mcp_json_get.id,
      aws_api_gateway_integration.mcp_json_get.id,
      aws_api_gateway_resource.mcp.id,
      aws_api_gateway_resource.execute.id,
      aws_api_gateway_method.execute_post.id,
      aws_api_gateway_integration.execute_post.id,
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

# API Gateway Stage
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = "$context.requestId $context.extendedRequestId $context.identity.sourceIp $context.requestTime $context.httpMethod $context.resourcePath $context.status $context.protocol $context.responseLength"
  }

  xray_tracing_enabled = true
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.stack_name}"
  retention_in_days = 30
}

# API Gateway Account (for CloudWatch logging)
resource "aws_api_gateway_account" "main" {
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch.arn
}

# IAM Role for API Gateway CloudWatch logging
resource "aws_iam_role" "api_gateway_cloudwatch" {
  name = "${var.stack_name}-api-gateway-cloudwatch"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "apigateway.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
  role       = aws_iam_role.api_gateway_cloudwatch.name
}

%s

%s
`,
		ir.Metadata.Title,
		apiName,
		d.generateTerraformSecretsPolicy(ir, opts),
		apiName,
		d.getAPIBaseURL(ir),
		d.generateTerraformAuthEnvVars(ir),
		d.generateTerraformVPCConfig(opts),
		ir.Metadata.Title,
		ir.Metadata.Description,
		d.generateTerraformMonitoring(ir, apiName, opts),
		d.generateTerraformAutoScaling(ir, apiName, opts),
	)

	return mainTF, nil
}

func (d *AWSLambdaDeployment) generateTerraformVariables(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	variables := fmt.Sprintf(`variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "%s"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "stack_name" {
  description = "Stack name for resources"
  type        = string
  default     = "%s"
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "%s"
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = %d
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = %d
}

variable "architecture" {
  description = "Lambda architecture"
  type        = string
  default     = "%s"

  validation {
    condition     = contains(["x86_64", "arm64"], var.architecture)
    error_message = "Architecture must be x86_64 or arm64."
  }
}

variable "log_level" {
  description = "Log level"
  type        = string
  default     = "INFO"
}

%s
`,
		opts.AWSRegion,
		d.sanitizeResourceName(ir.Metadata.Name),
		opts.Runtime,
		opts.MemorySize,
		opts.Timeout,
		opts.Architecture,
		d.generateTerraformAuthVariables(ir),
	)

	return variables, nil
}

func (d *AWSLambdaDeployment) generateTerraformOutputs(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	outputs := `output "api_endpoint" {
  description = "API Gateway endpoint URL"
  value       = "${aws_api_gateway_stage.main.invoke_url}"
}

output "function_arn" {
  description = "Lambda Function ARN"
  value       = aws_lambda_function.main.arn
}

output "function_name" {
  description = "Lambda Function Name"
  value       = aws_lambda_function.main.function_name
}

output "api_id" {
  description = "API Gateway ID"
  value       = aws_api_gateway_rest_api.main.id
}
`
	return outputs, nil
}

func (d *AWSLambdaDeployment) generateTerraformBackend(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	backend := `# Terraform backend configuration
# Uncomment and configure for remote state storage

# terraform {
#   backend "s3" {
#     bucket         = "your-terraform-state-bucket"
#     key            = "mcp-connector/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "terraform-locks"
#   }
# }
`
	return backend, nil
}

// Terraform helper methods
func (d *AWSLambdaDeployment) generateTerraformSecretsPolicy(ir *parser.IntermediateRepresentation, opts DeploymentOptions) string {
	if len(ir.Auth) == 0 {
		return ""
	}
	return `
# Secrets Manager policy
resource "aws_iam_role_policy" "secrets" {
  name = "${var.stack_name}-secrets-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "secretsmanager:GetSecretValue"
      ]
      Resource = "*"
    }]
  })
}`
}

func (d *AWSLambdaDeployment) generateTerraformAuthEnvVars(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `      API_KEY = var.api_key`
	case "http":
		if auth.Scheme == "bearer" {
			return `      BEARER_TOKEN = var.bearer_token`
		}
	case "oauth2":
		return `      CLIENT_ID     = var.client_id
      CLIENT_SECRET = var.client_secret`
	}
	return ""
}

func (d *AWSLambdaDeployment) generateTerraformAuthVariables(ir *parser.IntermediateRepresentation) string {
	if len(ir.Auth) == 0 {
		return ""
	}

	auth := ir.Auth[0]
	switch auth.Type {
	case "apiKey":
		return `variable "api_key" {
  description = "API Key for authentication"
  type        = string
  sensitive   = true
}`
	case "http":
		if auth.Scheme == "bearer" {
			return `variable "bearer_token" {
  description = "Bearer token for authentication"
  type        = string
  sensitive   = true
}`
		}
	case "oauth2":
		return `variable "client_id" {
  description = "OAuth2 Client ID"
  type        = string
}

variable "client_secret" {
  description = "OAuth2 Client Secret"
  type        = string
  sensitive   = true
}`
	}
	return ""
}

func (d *AWSLambdaDeployment) generateTerraformVPCConfig(opts DeploymentOptions) string {
	if !opts.UseVPC {
		return ""
	}
	return `
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }`
}

func (d *AWSLambdaDeployment) generateTerraformMonitoring(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	return `
# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.stack_name}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Lambda function error rate is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.main.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "${var.stack_name}-lambda-throttles"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "Lambda function is being throttled"
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.main.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.stack_name}-api-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "API Gateway 5xx error rate is too high"
  treat_missing_data  = "notBreaching"

  dimensions = {
    ApiName = aws_api_gateway_rest_api.main.name
    Stage   = aws_api_gateway_stage.main.stage_name
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.stack_name}-mcp-connector"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Invocations" }],
            [".", "Errors", { stat = "Sum", label = "Errors" }],
            [".", "Throttles", { stat = "Sum", label = "Throttles" }],
            [".", "Duration", { stat = "Average", label = "Duration" }]
          ]
          view = "timeSeries"
          region = var.aws_region
          title  = "Lambda Metrics"
          period = 300
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", { stat = "Sum", label = "Requests" }],
            [".", "4XXError", { stat = "Sum", label = "4XX Errors" }],
            [".", "5XXError", { stat = "Sum", label = "5XX Errors" }],
            [".", "Latency", { stat = "Average", label = "Latency" }]
          ]
          view   = "timeSeries"
          region = var.aws_region
          title  = "API Gateway Metrics"
          period = 300
        }
      }
    ]
  })
}`
}

func (d *AWSLambdaDeployment) generateTerraformAutoScaling(ir *parser.IntermediateRepresentation, apiName string, opts DeploymentOptions) string {
	if !opts.EnableAutoScaling {
		return ""
	}
	return `
# Lambda Provisioned Concurrency Auto Scaling
resource "aws_lambda_alias" "live" {
  name             = "live"
  description      = "Live alias with provisioned concurrency"
  function_name    = aws_lambda_function.main.arn
  function_version = aws_lambda_function.main.version
}

resource "aws_appautoscaling_target" "lambda" {
  max_capacity       = 100
  min_capacity       = 1
  resource_id        = "function:${aws_lambda_function.main.function_name}:${aws_lambda_alias.live.name}"
  scalable_dimension = "lambda:function:ProvisionedConcurrentExecutions"
  service_namespace  = "lambda"
}

resource "aws_appautoscaling_policy" "lambda" {
  name               = "${var.stack_name}-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.lambda.resource_id
  scalable_dimension = aws_appautoscaling_target.lambda.scalable_dimension
  service_namespace  = aws_appautoscaling_target.lambda.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 0.70

    predefined_metric_specification {
      predefined_metric_type = "LambdaProvisionedConcurrencyUtilization"
    }
  }
}`
}

// CI/CD pipeline generation methods
func (d *AWSLambdaDeployment) generateCICDPipeline(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate GitHub Actions workflow
	if opts.CICDProvider == "github-actions" || opts.CICDProvider == "" {
		githubWorkflow, err := d.generateGitHubActionsWorkflow(ir, opts)
		if err != nil {
			return nil, err
		}
		files = append(files, DeploymentFile{
			Path:     ".github/workflows/deploy.yml",
			Content:  githubWorkflow,
			FileType: FileTypeConfig,
		})
	}

	// Generate GitLab CI pipeline
	if opts.CICDProvider == "gitlab-ci" {
		gitlabPipeline, err := d.generateGitLabCIPipeline(ir, opts)
		if err != nil {
			return nil, err
		}
		files = append(files, DeploymentFile{
			Path:     ".gitlab-ci.yml",
			Content:  gitlabPipeline,
			FileType: FileTypeConfig,
		})
	}

	return files, nil
}

func (d *AWSLambdaDeployment) generateGitHubActionsWorkflow(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	workflow := fmt.Sprintf(`name: Deploy MCP Connector to AWS Lambda

on:
  push:
    branches:
      - main
      - staging
      - develop
  pull_request:
    branches:
      - main

env:
  AWS_REGION: %s
  PYTHON_VERSION: '3.11'

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install -r requirements-dev.txt || true

      - name: Run tests
        run: |
          python -m pytest tests/ || true

      - name: Lint
        run: |
          python -m pylint **/*.py || true

  deploy-dev:
    name: Deploy to Development
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/develop'
    environment: development
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Setup AWS SAM
        uses: aws-actions/setup-sam@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: |
          sam deploy \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --parameter-overrides Environment=dev \
            --stack-name %s-dev \
            --capabilities CAPABILITY_IAM

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/staging'
    environment: staging
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Setup AWS SAM
        uses: aws-actions/setup-sam@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: |
          sam deploy \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --parameter-overrides Environment=staging \
            --stack-name %s-staging \
            --capabilities CAPABILITY_IAM

  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Setup AWS SAM
        uses: aws-actions/setup-sam@v2

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: SAM build
        run: sam build

      - name: SAM deploy
        run: |
          sam deploy \
            --no-confirm-changeset \
            --no-fail-on-empty-changeset \
            --parameter-overrides Environment=prod \
            --stack-name %s-prod \
            --capabilities CAPABILITY_IAM

      - name: Create GitHub Release
        if: success()
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            Deployed to production
            Commit: ${{ github.sha }}
          draft: false
          prerelease: false
`,
		opts.AWSRegion,
		d.sanitizeResourceName(ir.Metadata.Name),
		d.sanitizeResourceName(ir.Metadata.Name),
		d.sanitizeResourceName(ir.Metadata.Name),
	)

	return workflow, nil
}

func (d *AWSLambdaDeployment) generateGitLabCIPipeline(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	pipeline := fmt.Sprintf(`stages:
  - test
  - deploy

variables:
  AWS_DEFAULT_REGION: %s
  PYTHON_VERSION: "3.11"
  PIP_CACHE_DIR: "$CI_PROJECT_DIR/.cache/pip"

cache:
  paths:
    - .cache/pip

test:
  stage: test
  image: python:${PYTHON_VERSION}
  before_script:
    - pip install -r requirements.txt
    - pip install -r requirements-dev.txt || true
  script:
    - python -m pytest tests/ || true
    - python -m pylint **/*.py || true

deploy:dev:
  stage: deploy
  image: public.ecr.aws/sam/build-python${PYTHON_VERSION}
  only:
    - develop
  environment:
    name: development
  before_script:
    - pip install awscli
  script:
    - sam build
    - sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=dev --stack-name %s-dev --capabilities CAPABILITY_IAM

deploy:staging:
  stage: deploy
  image: public.ecr.aws/sam/build-python${PYTHON_VERSION}
  only:
    - staging
  environment:
    name: staging
  before_script:
    - pip install awscli
  script:
    - sam build
    - sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=staging --stack-name %s-staging --capabilities CAPABILITY_IAM

deploy:prod:
  stage: deploy
  image: public.ecr.aws/sam/build-python${PYTHON_VERSION}
  only:
    - main
  environment:
    name: production
  before_script:
    - pip install awscli
  script:
    - sam build
    - sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides Environment=prod --stack-name %s-prod --capabilities CAPABILITY_IAM
  when: manual
`,
		opts.AWSRegion,
		d.sanitizeResourceName(ir.Metadata.Name),
		d.sanitizeResourceName(ir.Metadata.Name),
		d.sanitizeResourceName(ir.Metadata.Name),
	)

	return pipeline, nil
}

// Deployment scripts generation
func (d *AWSLambdaDeployment) generateDeploymentScripts(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate deploy script
	deployScript, err := d.generateDeployScript(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "scripts/deploy.sh",
		Content:  deployScript,
		FileType: FileTypeScript,
	})

	// Generate test script
	testScript, err := d.generateTestScript(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "scripts/test.sh",
		Content:  testScript,
		FileType: FileTypeScript,
	})

	// Generate cleanup script
	cleanupScript, err := d.generateCleanupScript(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "scripts/cleanup.sh",
		Content:  cleanupScript,
		FileType: FileTypeScript,
	})

	return files, nil
}

func (d *AWSLambdaDeployment) generateDeployScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	stackName := d.sanitizeResourceName(ir.Metadata.Name)

	script := fmt.Sprintf(`#!/bin/bash
# Deployment script for %s MCP Connector

set -e

# Configuration
STACK_NAME="${STACK_NAME:-%s}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-%s}"

echo "Deploying ${STACK_NAME} to ${ENVIRONMENT} in ${AWS_REGION}..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "AWS CLI not found. Please install it first."
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "SAM CLI not found. Please install it first."
    exit 1
fi

# Build
echo "Building Lambda function..."
sam build

# Validate template
echo "Validating SAM template..."
sam validate

# Deploy
echo "Deploying to AWS..."
sam deploy \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --parameter-overrides Environment="${ENVIRONMENT}" \
    --capabilities CAPABILITY_IAM \
    --region "${AWS_REGION}" \
    --no-confirm-changeset \
    --no-fail-on-empty-changeset

# Get outputs
echo "Getting stack outputs..."
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --region "${AWS_REGION}" \
    --query "Stacks[0].Outputs" \
    --output table

echo "Deployment complete!"
`,
		ir.Metadata.Title,
		stackName,
		opts.AWSRegion,
	)

	return script, nil
}

func (d *AWSLambdaDeployment) generateTestScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	script := `#!/bin/bash
# Test script for MCP Connector

set -e

echo "Running tests..."

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo "pytest not found. Installing..."
    pip install pytest
fi

# Run tests
pytest tests/ -v

echo "Tests complete!"
`
	return script, nil
}

func (d *AWSLambdaDeployment) generateCleanupScript(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	stackName := d.sanitizeResourceName(ir.Metadata.Name)

	script := fmt.Sprintf(`#!/bin/bash
# Cleanup script for %s MCP Connector

set -e

# Configuration
STACK_NAME="${STACK_NAME:-%s}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
AWS_REGION="${AWS_REGION:-%s}"

echo "WARNING: This will delete the stack ${STACK_NAME}-${ENVIRONMENT} in ${AWS_REGION}"
read -p "Are you sure? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo "Deleting stack..."
sam delete \
    --stack-name "${STACK_NAME}-${ENVIRONMENT}" \
    --region "${AWS_REGION}" \
    --no-prompts

echo "Cleanup complete!"
`,
		ir.Metadata.Title,
		stackName,
		opts.AWSRegion,
	)

	return script, nil
}

// Monitoring configuration generation
func (d *AWSLambdaDeployment) generateMonitoringConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) ([]DeploymentFile, error) {
	files := []DeploymentFile{}

	// Generate X-Ray configuration
	xrayConfig, err := d.generateXRayConfig(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "monitoring/xray-config.json",
		Content:  xrayConfig,
		FileType: FileTypeConfig,
	})

	// Generate CloudWatch Insights queries
	insightsQueries, err := d.generateCloudWatchInsightsQueries(ir, opts)
	if err != nil {
		return nil, err
	}
	files = append(files, DeploymentFile{
		Path:     "monitoring/cloudwatch-insights-queries.json",
		Content:  insightsQueries,
		FileType: FileTypeConfig,
	})

	return files, nil
}

func (d *AWSLambdaDeployment) generateXRayConfig(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	config := `{
  "version": 1,
  "default": {
    "service_name": "mcp-connector",
    "sampling_rules": [
      {
        "description": "Sample all requests",
        "host": "*",
        "http_method": "*",
        "url_path": "*",
        "fixed_target": 1,
        "rate": 0.1
      }
    ]
  }
}
`
	return config, nil
}

func (d *AWSLambdaDeployment) generateCloudWatchInsightsQueries(ir *parser.IntermediateRepresentation, opts DeploymentOptions) (string, error) {
	queries := `{
  "queries": [
    {
      "name": "Error Analysis",
      "query": "fields @timestamp, @message | filter @type = \"ERROR\" | sort @timestamp desc | limit 20"
    },
    {
      "name": "Latency Analysis",
      "query": "fields @timestamp, @duration | stats avg(@duration), max(@duration), min(@duration) by bin(5m)"
    },
    {
      "name": "Request Volume",
      "query": "fields @timestamp | stats count() by bin(5m)"
    },
    {
      "name": "Memory Usage",
      "query": "filter @type = \"REPORT\" | stats max(@memorySize / 1000 / 1000) as provisonedMemoryMB, min(@maxMemoryUsed / 1000 / 1000) as smallestMemoryRequestMB, avg(@maxMemoryUsed / 1000 / 1000) as avgMemoryUsedMB, max(@maxMemoryUsed / 1000 / 1000) as maxMemoryUsedMB by bin(5m)"
    }
  ]
}
`
	return queries, nil
}

// Utility methods
func (d *AWSLambdaDeployment) sanitizeResourceName(name string) string {
	// Remove invalid characters and convert to appropriate format
	name = strings.ReplaceAll(name, " ", "-")
	name = strings.ReplaceAll(name, "_", "-")
	name = strings.ToLower(name)

	// Remove any character that isn't alphanumeric or hyphen
	result := ""
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			result += string(r)
		}
	}

	return result
}

func (d *AWSLambdaDeployment) countFilesByType(files []DeploymentFile, fileType FileType) int {
	count := 0
	for _, f := range files {
		if f.FileType == fileType {
			count++
		}
	}
	return count
}

func (d *AWSLambdaDeployment) estimateMonthlyCost(ir *parser.IntermediateRepresentation, opts DeploymentOptions) float64 {
	// Simple cost estimation
	// Lambda: $0.20 per 1M requests + $0.0000166667 per GB-second
	requestsPerMonth := 100000.0
	avgDurationMS := float64(opts.Timeout) * 0.5
	memoryGB := float64(opts.MemorySize) / 1024.0

	requestCost := (requestsPerMonth / 1000000.0) * 0.20
	computeCost := (requestsPerMonth * avgDurationMS / 1000.0 * memoryGB) * 0.0000166667

	// API Gateway: $3.50 per million API calls
	apiGatewayCost := (requestsPerMonth / 1000000.0) * 3.50

	return requestCost + computeCost + apiGatewayCost
}

func (d *AWSLambdaDeployment) extractRequiredSecrets(ir *parser.IntermediateRepresentation) []string {
	secrets := []string{}

	if len(ir.Auth) > 0 {
		auth := ir.Auth[0]
		switch auth.Type {
		case "apiKey":
			secrets = append(secrets, "API_KEY")
		case "http":
			if auth.Scheme == "bearer" {
				secrets = append(secrets, "BEARER_TOKEN")
			}
		case "oauth2":
			secrets = append(secrets, "CLIENT_ID", "CLIENT_SECRET")
		}
	}

	return secrets
}
