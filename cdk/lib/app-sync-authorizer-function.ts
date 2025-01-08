import {Construct} from 'constructs';
import {ExtendedNodejsFunction} from 'truemark-cdk-lib/aws-lambda';
import * as path from 'path';
import {Architecture, Runtime} from 'aws-cdk-lib/aws-lambda';
import {RetentionDays} from 'aws-cdk-lib/aws-logs';

export class AppSyncAuthorizerFunction extends ExtendedNodejsFunction {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      entry: path.join(
        __dirname,
        '..',
        '..',
        'handlers',
        'src',
        'app-sync-authorizer-handler.mts',
      ),
      memorySize: 768,
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      environment: {},
      createAlarms: false,
      deploymentOptions: {
        createDeployment: false,
      },
      logRetention: RetentionDays.THREE_DAYS,
    });
  }
}
