import {ExtendedNodejsFunction} from 'truemark-cdk-lib/aws-lambda';
import {
  Architecture,
  Code,
  FunctionUrl,
  FunctionUrlAuthType,
  InvokeMode,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from 'path';
import {ITableV2} from 'aws-cdk-lib/aws-dynamodb';
import {LogLevel} from './globals';

/**
 * Properties for the SiteFunction.
 */
export interface UiFunctionProps {
  readonly logLevel: LogLevel;
  readonly origin: string;
  readonly dataTable: ITableV2;
}

/**
 * Function for serving the QwikJS application.
 */
export class UiFunction extends ExtendedNodejsFunction {
  readonly functionUrl: FunctionUrl;
  constructor(scope: Construct, id: string, props: UiFunctionProps) {
    super(scope, id, {
      // This assumes the application is build before a cdk synth occurs
      code: Code.fromAsset(path.join(__dirname, '..', '..', 'ui', 'server')),
      handler: 'entry-aws-lambda.qwikApp',
      memorySize: 1024,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        LOG_LEVEL: props.logLevel,
        // Qwik needs to know its origin
        ORIGIN: props.origin,
        // Qwik needs to know the name of the DynamoDBV2 table to access it
        DATA_TABLE_NAME: props.dataTable.tableName,
      },
      criticalAlarmOptions: {
        maxLogCount: 0, // Disables a default alarm that would be created
      },
      warningAlarmOptions: {
        maxLogCount: 0, // Disables a default alarm that would be created
      },
      deploymentOptions: {
        createDeployment: false, // We don't need canary deploys for this website
      },
    });
    // Expose the function URL as an output
    this.functionUrl = this.addFunctionUrl({
      authType: FunctionUrlAuthType.NONE,
      // TODO Move to streaming when Qwik supports it. This is not a function of serverless-http
      invokeMode: InvokeMode.BUFFERED,
    });
    // Allow this function to read and write to the DynamoDBV2 table
    props.dataTable.grantWriteData(this);
  }
}