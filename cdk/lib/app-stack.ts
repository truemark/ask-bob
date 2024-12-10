import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {LogLevel} from './globals';
import {ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {getDataStackParameters} from './data-stack';
import {AppFunction} from './app-function';
import {Duration, Fn, RemovalPolicy} from 'aws-cdk-lib';
import {WebsiteBucket} from 'truemark-cdk-lib/aws-s3';
import * as path from 'path';
import {getBedrockStackParameters} from './bedrock-stack';
import {getGraphStackParameters} from './graph-stack';
import {CacheControl} from 'aws-cdk-lib/aws-s3-deployment';
import {DomainName} from 'truemark-cdk-lib/aws-route53';

/**
 * Properties for the AppStack.
 */
export interface AppStackProps extends ExtendedStackProps {
  /**
   * Whether to deploy the app using canary deployment.
   */
  readonly canaryDeploy: boolean;
  /**
   * The zone for the app.
   */
  readonly zone: string;
  /**
   * The log level for the app.
   */
  readonly logLevel: LogLevel;
  /**
   * The options for the data stack parameter export.
   */
  readonly dataStackParameterExportOptions: ParameterStoreOptions;
  /**
   * The options for the bedrock stack parameter export.
   */
  readonly bedrockStackParameterExportOptions: ParameterStoreOptions;
  /**
   * The options for the graph stack parameter export.
   */
  readonly graphStackParameterExportOptions: ParameterStoreOptions;
}

/**
 * Deploys app resources to serve the user interface.
 */
export class AppStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const dataStackParameters = getDataStackParameters(
      this,
      props.dataStackParameterExportOptions,
    );

    const bedrockStackParameters = getBedrockStackParameters(
      this,
      props.bedrockStackParameterExportOptions,
    );

    const graphStackParameters = getGraphStackParameters(
      this,
      props.graphStackParameterExportOptions,
    );

    // Create the lambda function to serve the dynamic content using QwikJS
    const fn = new AppFunction(this, 'AppFunction', {
      canaryDeploy: props.canaryDeploy,
      logLevel: props.logLevel,
      origin: `https://${props.zone}`,
      dataTable: dataStackParameters.dataTable,
      agentId: bedrockStackParameters.agentId,
      agentAliasId: bedrockStackParameters.agentAliasId,
      appSyncEndpoint: graphStackParameters.appSyncEndpoint,
      appSyncRealtimeEndpoint: graphStackParameters.appSyncRealtimeEndpoint,
      appSyncApiKey: graphStackParameters.appSyncApiKey,
    });

    new DomainName({
      prefix: 'ask-bob-app-origin',
      zone: props.zone,
    }).createLatencyCnameRecord(
      this,
      Fn.select(
        0,
        Fn.split('/', Fn.select(1, Fn.split('//', fn.functionUrl.url))),
      ),
    );

    // Create the bucket to store static content
    const contentBucket = new WebsiteBucket(this, 'Content', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new DomainName({
      prefix: 'ask-bob-app-content-origin',
      zone: props.zone,
    }).createLatencyCnameRecord(this, contentBucket.bucketWebsiteDomainName);

    // Deploy the content to the bucket
    contentBucket.deploy([
      {
        source: path.join(__dirname, '..', '..', 'app', 'dist'),
        exclude: ['build', 'assets'],
        cacheControl: [
          CacheControl.maxAge(Duration.minutes(1)),
          CacheControl.sMaxAge(Duration.minutes(2)),
        ],
      },
      {
        source: path.join(__dirname, '..', '..', 'app', 'dist', 'assets'),
        prefix: 'assets',
        cacheControl: [
          CacheControl.maxAge(Duration.days(1)),
          CacheControl.sMaxAge(Duration.days(7)),
        ],
      },
      {
        source: path.join(__dirname, '..', '..', 'app', 'dist', 'build'),
        prefix: 'build',
        cacheControl: [
          CacheControl.maxAge(Duration.days(1)),
          CacheControl.sMaxAge(Duration.days(7)),
        ],
      },
    ]);
  }
}
