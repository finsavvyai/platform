/** AWS IAM setup script and instructions for OpenSyber CSPM onboarding */

const OPENSYBER_AWS_ACCOUNT_ID = '123456789012';

interface SetupResponse {
  script: string;
  instructions: string[];
  requiredPermissions: string[];
}

export function getAwsSetup(externalId: string): SetupResponse {
  const script = `AWSTemplateFormatVersion: '2010-09-09'
Description: OpenSyber CSPM Cross-Account IAM Role

Resources:
  OpenSyberRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: OpenSyberCSPMRole
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal:
              AWS: 'arn:aws:iam::${OPENSYBER_AWS_ACCOUNT_ID}:root'
            Action: 'sts:AssumeRole'
            Condition:
              StringEquals:
                'sts:ExternalId': '${externalId}'
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/SecurityAudit
      Policies:
        - PolicyName: OpenSyberGuardDutyRead
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - guardduty:ListDetectors
                  - guardduty:GetDetector
                  - guardduty:ListFindings
                  - guardduty:GetFindings
                Resource: '*'
        - PolicyName: OpenSyberConfigRead
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - config:DescribeConfigRules
                  - config:GetComplianceDetailsByConfigRule
                  - config:DescribeComplianceByConfigRule
                Resource: '*'

Outputs:
  RoleArn:
    Description: ARN of the OpenSyber CSPM role
    Value: !GetAtt OpenSyberRole.Arn
  ExternalId:
    Description: External ID for the trust relationship
    Value: '${externalId}'`;

  return {
    script,
    instructions: [
      'Open the AWS CloudFormation console in your target account.',
      'Click "Create stack" and choose "With new resources".',
      'Select "Upload a template file" and paste the YAML above.',
      'Name the stack "OpenSyberCSPM" and click through to create.',
      'Once complete, copy the Role ARN from the Outputs tab.',
      'Paste the Role ARN in the next step of this wizard.',
    ],
    requiredPermissions: [
      'SecurityAudit (AWS managed policy)',
      'GuardDuty read (ListDetectors, GetDetector, ListFindings, GetFindings)',
      'AWS Config read (DescribeConfigRules, GetComplianceDetailsByConfigRule)',
    ],
  };
}
