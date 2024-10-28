export enum Connection {
  /**
   * Codestar connection used to trigger CodePipeline from GitHub
   */
  GitHub = 'arn:aws:codestar-connections:us-east-2:617383789573:connection/5236f3d4-3b74-4794-97f1-79f21c7a64de',
}

export enum KmsKey {
  /**
   * Shared KMS key used for encrypting the Artifact Bucket in AWS CDK
   */
  Cdk = 'arn:aws:kms:us-east-2:617383789573:key/733c44e5-e1b5-4e5c-b891-0b632b98859b',
}

export enum SlackChannel {
  /**
   * Slack channels used for CI/CD notifications
   */
  Automation = 'arn:aws:chatbot::617383789573:chat-configuration/slack-channel/automation',
}

export enum AwsRegion {
  Virginia = 'us-east-1',
  Ohio = 'us-east-2',
  Oregon = 'us-west-2',
}

export enum AwsAccount {
  DevOps = '617383789573',
  Prod = '178522259742',
  Stage = '068062034833',
  Ejensen = '889335235414',
  Dross = '529088296595',
}

export enum Route53Zone {
  Stage = 'stage.truemark.io',
  Pre = 'pre.truemark.io',
  Prod = 'truemark.io',
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
