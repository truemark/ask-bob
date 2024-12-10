import {ExtendedNodejsFunction} from 'truemark-cdk-lib/aws-lambda';
import {Architecture, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from 'path';
import {LogLevel} from './globals';
import {IQueue} from 'aws-cdk-lib/aws-sqs';
import {SqsEventSource} from 'aws-cdk-lib/aws-lambda-event-sources';
import {Effect, PolicyStatement} from 'aws-cdk-lib/aws-iam';
import {Stack} from 'aws-cdk-lib';

export interface MessageConsumerFunctionProps {
  readonly logLevel: LogLevel;
  readonly messageQueue: IQueue;
  readonly agentId: string;
  readonly agentAliasId: string;
  readonly appSyncApiKey: string;
  readonly appSyncEndpoint: string;
}

export class MessageConsumerFunction extends ExtendedNodejsFunction {
  constructor(
    scope: Construct,
    id: string,
    props: MessageConsumerFunctionProps,
  ) {
    super(scope, id, {
      entry: path.join(
        __dirname,
        '..',
        '..',
        'handlers',
        'src',
        'message-consumer-handler.mts',
      ),
      memorySize: 1024,
      runtime: Runtime.NODEJS_20_X,
      architecture: Architecture.ARM_64,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
        LOG_LEVEL: props.logLevel,
        AGENT_ID: props.agentId,
        AGENT_ALIAS_ID: props.agentAliasId,
        APP_SYNC_API_KEY: props.appSyncApiKey,
        APP_SYNC_ENDPOINT: props.appSyncEndpoint,
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
    props.messageQueue.grantConsumeMessages(this);
    this.addEventSource(
      new SqsEventSource(props.messageQueue, {
        batchSize: 1,
      }),
    );
    this.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeAgent'],
        resources: [
          `arn:aws:bedrock:${Stack.of(this).region}:${Stack.of(this).account}:agent/${props.agentId}`,
          `arn:aws:bedrock:${Stack.of(this).region}:${Stack.of(this).account}:agent-alias/${props.agentId}/${props.agentAliasId}`,
        ],
      }),
    );
  }
}
