import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {LogLevel} from './globals';
import {ParameterStore, ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {getDataStackParameters} from './data-stack';
import {AppFunction} from './app-function';
import {Duration, Fn, RemovalPolicy} from 'aws-cdk-lib';
import {CloudFrontBucketV2} from 'truemark-cdk-lib/aws-s3';
import * as path from 'path';
import {Bucket, IBucket} from 'aws-cdk-lib/aws-s3';
import {getBedrockStackParameters} from './bedrock-stack';

export enum AppStackParameterExport {
  FunctionUrl = 'FunctionUrl',
  ContentBucketArn = 'ContentBucketArn',
}

/**
 * Properties for the AppStack.
 */
export interface AppStackProps extends ExtendedStackProps {
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

    // Create the lambda function to serve the dynamic content using QwikJS
    const fn = new AppFunction(this, 'UiFunction', {
      logLevel: props.logLevel,
      origin: `https://${props.zone}`,
      dataTable: dataStackParameters.dataTable,
      agentId: bedrockStackParameters.agentId,
      agentAliasId: bedrockStackParameters.agentAliasId,
    });
    this.exportParameter(
      AppStackParameterExport.FunctionUrl,
      fn.functionUrl.url,
    );

    // Create the bucket to store static content
    const contentBucket = new CloudFrontBucketV2(this, 'Content', {
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.exportParameter(
      AppStackParameterExport.ContentBucketArn,
      contentBucket.bucketArn,
    );

    // Deploy the content to the bucket
    contentBucket.deploy([
      {
        source: path.join('..', 'app', 'dist'),
        exclude: ['build', 'assets'],
        maxAge: Duration.minutes(1),
        sMaxAge: Duration.minutes(2),
      },
      // {
      //   source: path.join('..', 'app', 'dist', 'assets'),
      //   prefix: 'assets',
      //   maxAge: Duration.days(1),
      //   sMaxAge: Duration.days(7),
      // },
      {
        source: path.join('..', 'app', 'dist', 'build'),
        prefix: 'build',
        maxAge: Duration.days(1),
        sMaxAge: Duration.days(7),
      },
    ]);
  }
}

export interface AppStackParameters {
  readonly store: ParameterStore;
  readonly functionUrl: string;
  readonly functionOrigin: string;
  readonly contentBucket: IBucket;
}

/**
 * Helper method to pull the stack parameters from the parameter store
 *
 * @param scope the scope to create constructs in
 * @param options the parameter store options
 */
export function getAppStackParameters(
  scope: Construct,
  options: ParameterStoreOptions,
): AppStackParameters {
  const store = new ParameterStore(scope, 'appStackParameters', options);
  const contentBucketArn = store.read(AppStackParameterExport.ContentBucketArn);
  const contentBucket = Bucket.fromBucketAttributes(scope, 'Content', {
    bucketArn: contentBucketArn,
    region: store.region,
  });
  // We just need the origin for CloudFront, not the entire URL
  const functionUrl = store.read(AppStackParameterExport.FunctionUrl);
  // Split the URL by '//' to separate the 'https:' prefix
  const splitByDoubleSlash = Fn.split('//', functionUrl);
  // Select the second part of the split (the URL without 'https:')
  const urlWithoutHttps = Fn.select(1, splitByDoubleSlash);
  // Split the URL by '/' to separate the trailing '/'
  const splitBySlash = Fn.split('/', urlWithoutHttps);
  // Select the first part of the split (the URL without the trailing '/')
  const functionOrigin = Fn.select(0, splitBySlash);
  return {
    store,
    functionUrl,
    functionOrigin,
    contentBucket,
  };
}
