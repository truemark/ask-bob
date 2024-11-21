import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {DomainName} from 'truemark-cdk-lib/aws-route53';
import {getGraphSupportStackParameters} from './graph-support-stack';
import {ParameterStore, ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import * as path from 'path';
import {
  AppsyncFunction,
  Code,
  Definition,
  DynamoDbDataSource,
  FieldLogLevel,
  FunctionRuntime,
  GraphqlApi,
  MappingTemplate,
} from 'aws-cdk-lib/aws-appsync';
import {RetentionDays} from 'aws-cdk-lib/aws-logs';
import {Stack} from 'aws-cdk-lib';
import {getDataStackParameters} from './data-stack';
import {IQueue, Queue} from 'aws-cdk-lib/aws-sqs';
import {StandardQueue} from 'truemark-cdk-lib/aws-sqs';
import {MessageConsumerFunction} from './message-consumer-function';
import {LogLevel} from './globals';
import {getBedrockStackParameters} from './bedrock-stack';

export enum GraphStackParameterExport {
  MessageQueueArn = 'MessageQueueArn',
  MessageQueueUrl = 'MessageQueueUrl',
  MessageQueueName = 'MessageQueueName',
}

function capitalizeFirstLetter(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function newJsResolverFunction(
  api: GraphqlApi,
  dataSource: DynamoDbDataSource,
  fieldName: string,
): AppsyncFunction {
  return new AppsyncFunction(
    Stack.of(api),
    `${capitalizeFirstLetter(fieldName)}Function`,
    {
      name: `${capitalizeFirstLetter(fieldName)}Function`,
      api,
      dataSource,
      runtime: FunctionRuntime.JS_1_0_0,
      code: Code.fromAsset(
        path.join(
          __dirname,
          '..',
          '..',
          'resolvers',
          'dist',
          `${fieldName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.js`,
        ),
      ),
    },
  );
}

/**
 * Properties for the GraphStack.
 */
export interface GraphStackProps extends ExtendedStackProps {
  readonly dataStackParameterExportOptions: ParameterStoreOptions;
  readonly graphSupportStackParameterExportOptions: ParameterStoreOptions;
  readonly bedrockStackParameterExportOptions: ParameterStoreOptions;
  readonly zone: string;
  readonly graphApiName: string;
  readonly logLevel: LogLevel;
}

/**
 * Deploys GraphQL for use by the user interface in interacting with the agent.
 */
export class GraphStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: GraphStackProps) {
    super(scope, id, props);

    const dataStackParameters = getDataStackParameters(
      this,
      props.dataStackParameterExportOptions,
    );

    const graphSupportParameters = getGraphSupportStackParameters(
      this,
      props.graphSupportStackParameterExportOptions,
    );

    const bedrockParameters = getBedrockStackParameters(
      this,
      props.bedrockStackParameterExportOptions,
    );

    const messageQueue = new StandardQueue(this, 'MessageQueue', {
      fifo: true,
    });
    this.exportAndOutputParameter(
      GraphStackParameterExport.MessageQueueArn,
      messageQueue.queueArn,
    );
    this.exportParameter(
      GraphStackParameterExport.MessageQueueUrl,
      messageQueue.queueUrl,
    );
    this.exportParameter(
      GraphStackParameterExport.MessageQueueName,
      messageQueue.queueName,
    );

    const domainName = new DomainName({
      prefix: 'ask-bob-graph',
      zone: props.zone,
    });

    const certificate = graphSupportParameters.certificate;

    const schemaPath = path.join(__dirname, '..', '..', 'schema.graphql');

    const api = new GraphqlApi(this, 'GraphqlApi', {
      name: props.graphApiName,
      definition: Definition.fromFile(schemaPath),
      domainName: {
        domainName: domainName.toString(),
        certificate,
      },
      logConfig: {
        excludeVerboseContent: true,
        fieldLogLevel: FieldLogLevel.ALL,
        retention: RetentionDays.ONE_WEEK,
      },
      environmentVariables: {
        accountId: Stack.of(this).account,
        messageQueueUrl: messageQueue.queueUrl,
        messageQueueName: messageQueue.queueName,
      },
      // TODO Move to different auth later
      // authorizationConfig: {
      //   defaultAuthorization: {
      //     authorizationType: AuthorizationType.OIDC,
      //     openIdConnectConfig: {
      //       oidcProvider: '',
      //     },
      //   },
      // },
      // environmentVariables: {
      //   AUDIENCE: props.audience,
      //   SYSTEM_CLIENT_IDS: props.systemClientIds.join(','),
      // },
    });

    const responseMappingTemplate = MappingTemplate.fromString(
      '#if($ctx.result && $ctx.result.errorType)\n' +
        '  $util.error($ctx.result.errorMessage, $ctx.result.errorType, $ctx.result.stack)\n' +
        '#else\n' +
        '  $util.toJson($ctx.result)\n' +
        '#end',
    );

    const messageQueueDataSource = api.addHttpDataSource(
      'MessageQueue',
      `https://sqs.${Stack.of(this).region}.amazonaws.com`,
      {
        authorizationConfig: {
          signingRegion: Stack.of(this).region,
          signingServiceName: 'sqs',
        },
      },
    );
    messageQueueDataSource.node.addDependency(messageQueue);
    messageQueue.grantSendMessages(messageQueueDataSource.grantPrincipal);

    // TODO To be used later
    api.addDynamoDbDataSource('DataTable', dataStackParameters.dataTable);

    api.createResolver('CreateMessage', {
      typeName: 'Mutation',
      fieldName: 'createMessage',
      pipelineConfig: [
        newJsResolverFunction(api, messageQueueDataSource, 'createMessageSqs'),
      ],
      requestMappingTemplate: MappingTemplate.fromString('{}'),
      responseMappingTemplate,
    });

    domainName.createCnameRecord(this, api.appSyncDomainName, {
      region: this.region,
    });

    new MessageConsumerFunction(this, 'MessageConsumer', {
      logLevel: props.logLevel,
      messageQueue,
      agentId: bedrockParameters.agentId,
      agentAliasId: bedrockParameters.agentAliasId,
      appSyncApiKey: api.apiKey!,
      appSyncEndpoint: api.graphqlUrl,
    });
  }
}

export interface GraphStackParameters {
  readonly store: ParameterStore;
  readonly messageQueue: IQueue;
}

export function getGraphStackParameters(
  scope: Construct,
  options: ParameterStoreOptions,
): GraphStackParameters {
  const store = new ParameterStore(scope, 'GraphStackParameters', options);
  const messageQueue = Queue.fromQueueAttributes(scope, 'MessageQueue', {
    queueArn: store.read(GraphStackParameterExport.MessageQueueArn),
    queueUrl: store.read(GraphStackParameterExport.MessageQueueUrl),
    queueName: store.read(GraphStackParameterExport.MessageQueueName),
    fifo: true,
  });
  return {
    store,
    messageQueue,
  };
}
