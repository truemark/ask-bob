import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {ParameterStore, ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {
  CfnAccessPolicy,
  CfnCollection,
  CfnSecurityPolicy,
} from 'aws-cdk-lib/aws-opensearchserverless';
import {
  CfnAgent,
  CfnAgentAlias,
  CfnDataSource,
  CfnKnowledgeBase,
  FoundationModel,
  FoundationModelIdentifier,
} from 'aws-cdk-lib/aws-bedrock';
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import {getDataStackParameters} from './data-stack';
import {KnowledgeBaseCollectionIndex} from 'truemark-cdk-lib/aws-bedrock';

export enum BedrockStackParameterExport {
  AgentId = 'AgentId',
  AgentAliasId = 'AgentAliasId',
}

/**
 * Properties for the BedrockStack.
 */
export interface BedrockStackProps extends ExtendedStackProps {
  /**
   * The options for the data stack parameter export.
   */
  readonly dataStackParameterExportOptions: ParameterStoreOptions;

  /**
   * The rate limit for the crawler. Max is 300 per docs. Default is 60.
   */
  readonly crawlerRateLimit?: number;

  /**
   * The seed urls for the crawler.
   */
  readonly crawlerSeedUrls: string[];

  /**
   * The inclusion filters for the crawler.
   */
  readonly crawlerInclusionFilters: string[];

  /**
   * Additional principals to allow access to the collection data.
   */
  readonly collectionDataAccessPrincipals?: string[];
}

/**
 * Deploys AWS Bedrock resources.
 */
export class BedrockStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);

    // const model = FoundationModel.fromFoundationModelId(
    //   this,
    //   'Model',
    //   FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
    // );

    const model = FoundationModel.fromFoundationModelId(
      this,
      'Model',
      new FoundationModelIdentifier('meta.llama3-3-70b-instruct-v1:0'), // Not in CDK yet
    );

    const embeddingModel = FoundationModel.fromFoundationModelId(
      this,
      'EmbeddingModel',
      FoundationModelIdentifier.AMAZON_TITAN_EMBED_TEXT_V2_0,
    );
    const embeddingModelVectorOutputDimension = 1024;

    // Get the data stack parameters
    const dataStackParameters = getDataStackParameters(
      this,
      props.dataStackParameterExportOptions,
    );

    // Create a OpenSearch Serverless collection for code vectors
    const collection = new CfnCollection(this, 'Collection', {
      name: 'ask-bob-vector',
      type: 'VECTORSEARCH',
    });

    const encryptionPolicy = new CfnSecurityPolicy(
      this,
      'CollectionEncryptionPolicy',
      {
        name: `${collection.name}-enc`,
        policy: JSON.stringify({
          Rules: [
            {
              Resource: [`collection/${collection.name}`],
              ResourceType: 'collection',
            },
          ],
          AWSOwnedKey: true,
        }),
        type: 'encryption',
      },
    );
    collection.addDependency(encryptionPolicy);

    const networkPolicy = new CfnSecurityPolicy(
      this,
      'CollectionNetworkPolicy',
      {
        name: `${collection.name}-net`,
        policy: JSON.stringify([
          {
            Rules: [
              {
                Resource: [`collection/${collection.name}`],
                ResourceType: 'dashboard',
              },
              {
                Resource: [`collection/${collection.name}`],
                ResourceType: 'collection',
              },
            ],
            AllowFromPublic: true,
          },
        ]),
        type: 'network',
      },
    );
    collection.addDependency(networkPolicy);

    const docsKnowledgeBaseRole = new Role(this, 'DocsKnowledgeBaseRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });
    docsKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:ListFoundationModels', 'bedrock:ListCustomModels'],
        resources: ['*'],
      }),
    );
    docsKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
      }),
    );
    docsKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:ListBucket'],
        resources: ['*'],
      }),
    );
    docsKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetObject'],
        resources: [
          `arn:aws:s3:::${dataStackParameters.knowledgeBaseBucket.bucketName}/docs`,
          `arn:aws:s3:::${dataStackParameters.knowledgeBaseBucket.bucketName}/docs/*`,
        ],
      }),
    );
    docsKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [
          `arn:aws:aoss:${this.region}:${this.account}:collection/${collection.attrId}`,
        ],
      }),
    );

    const webKnowledgeBaseRole = new Role(this, 'WebsiteKnowledgeBaseRole2', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });
    webKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:ListFoundationModels', 'bedrock:ListCustomModels'],
        resources: ['*'],
      }),
    );
    webKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
      }),
    );
    webKnowledgeBaseRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['aoss:APIAccessAll'],
        resources: [
          `arn:aws:aoss:${this.region}:${this.account}:collection/${collection.attrId}`,
        ],
      }),
    );

    const docsIndex = new KnowledgeBaseCollectionIndex(this, 'DocsIndex', {
      openSearchEndpoint: collection.attrCollectionEndpoint,
      indexName: 'docs',
      metadataFieldName: 'DocsMetadata',
      textFieldName: 'DocsText',
      vectorFieldName: 'DocsVector',
      vectorFieldDimension: embeddingModelVectorOutputDimension,
    });

    const webIndex = new KnowledgeBaseCollectionIndex(this, 'WebIndex', {
      openSearchEndpoint: collection.attrCollectionEndpoint,
      indexName: 'web',
      metadataFieldName: 'WebMetadata',
      textFieldName: 'WebText',
      vectorFieldName: 'WebVector',
      vectorFieldDimension: embeddingModelVectorOutputDimension,
    });

    const dataAccessPolicy = new CfnAccessPolicy(this, 'DataAccessPolicy', {
      name: `${collection.name}-dap`,
      policy: JSON.stringify([
        {
          Rules: [
            {
              Resource: [`collection/${collection.name}`],
              Permission: [
                'aoss:CreateCollectionItems',
                'aoss:DeleteCollectionItems',
                'aoss:UpdateCollectionItems',
                'aoss:DescribeCollectionItems',
              ],
              ResourceType: 'collection',
            },
            {
              Resource: [`index/${collection.name}/*`],
              Permission: [
                'aoss:CreateIndex',
                'aoss:DeleteIndex',
                'aoss:UpdateIndex',
                'aoss:DescribeIndex',
                'aoss:ReadDocument',
                'aoss:WriteDocument',
              ],
              ResourceType: 'index',
            },
          ],
          Principal: [
            docsKnowledgeBaseRole.roleArn,
            webKnowledgeBaseRole.roleArn,
            docsIndex.role.roleArn,
            webIndex.role.roleArn,
            ...(props.collectionDataAccessPrincipals ?? []),
          ],
        },
      ]),
      type: 'data',
    });
    collection.addDependency(dataAccessPolicy);

    // Create a knowledge base for code
    const docsKnowledgeBase = new CfnKnowledgeBase(this, 'DocsKnowledgeBase', {
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: embeddingModel.modelArn,
        },
      },
      name: 'AskBobDocsKnowledgeBase',
      roleArn: docsKnowledgeBaseRole.roleArn,
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collection.attrArn,
          fieldMapping: {
            metadataField: 'DocsMetadata',
            textField: 'DocsText',
            vectorField: 'DocsVector',
          },
          vectorIndexName: docsIndex.indexName,
        },
      },
    });
    docsKnowledgeBase.node.addDependency(docsIndex.resource);

    // Create a data source to connect the knowledge base with the data
    new CfnDataSource(this, 'DocsDataSource', {
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: dataStackParameters.knowledgeBaseBucket.bucketArn,
          inclusionPrefixes: ['docs'],
        },
      },
      knowledgeBaseId: docsKnowledgeBase.attrKnowledgeBaseId,
      name: 'AskBobDocsDataSource',
      dataDeletionPolicy: 'DELETE',
    });

    const webKnowledgeBase = new CfnKnowledgeBase(
      this,
      'WebsiteKnowledgeBase',
      {
        knowledgeBaseConfiguration: {
          type: 'VECTOR',
          vectorKnowledgeBaseConfiguration: {
            embeddingModelArn: embeddingModel.modelArn,
          },
        },
        name: 'AskBobWebKnowledgeBase2',
        roleArn: webKnowledgeBaseRole.roleArn,
        storageConfiguration: {
          type: 'OPENSEARCH_SERVERLESS',
          opensearchServerlessConfiguration: {
            collectionArn: collection.attrArn,
            fieldMapping: {
              metadataField: 'WebMetadata',
              textField: 'WebText',
              vectorField: 'WebVector',
            },
            vectorIndexName: webIndex.indexName,
          },
        },
      },
    );
    webKnowledgeBase.node.addDependency(webIndex.resource);

    // Create a data source to connect the knowledge base with the data
    new CfnDataSource(this, 'WebDataSource', {
      dataSourceConfiguration: {
        type: 'WEB',
        webConfiguration: {
          sourceConfiguration: {
            urlConfiguration: {
              seedUrls: props.crawlerSeedUrls.map((url) => ({
                url: url,
              })),
            },
          },
          crawlerConfiguration: {
            crawlerLimits: {
              rateLimit: props.crawlerRateLimit ?? 60,
            },
            inclusionFilters: props.crawlerInclusionFilters,
          },
        },
      },
      knowledgeBaseId: webKnowledgeBase.attrKnowledgeBaseId,
      name: 'AskBobWebDataSource',
      dataDeletionPolicy: 'DELETE',
    });

    const agentRole = new Role(this, 'AgentRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });
    agentRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/*`],
      }),
    );
    agentRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['bedrock:Retrieve', 'bedrock:RetrieveAndGenerate'],
        resources: [
          docsKnowledgeBase.attrKnowledgeBaseArn,
          webKnowledgeBase.attrKnowledgeBaseArn,
        ],
      }),
    );

    const agent = new CfnAgent(this, 'Agent', {
      agentName: 'AskBob',
      foundationModel: model.modelId,
      agentResourceRoleArn: agentRole.roleArn,
      autoPrepare: true,
      instruction:
        "You're an engineer in an AWS partner. You're friendly and helpful. You help answer technical questions. Your name is Bob.",
      knowledgeBases: [
        {
          description: 'Docs knowledge base',
          knowledgeBaseId: docsKnowledgeBase.attrKnowledgeBaseId,
          knowledgeBaseState: 'ENABLED',
        },
        {
          description: 'Web knowledge base',
          knowledgeBaseId: webKnowledgeBase.attrKnowledgeBaseId,
          knowledgeBaseState: 'ENABLED',
        },
      ],
    });
    this.exportAndOutputParameter(
      BedrockStackParameterExport.AgentId,
      agent.attrAgentId,
    );

    const agentAlias = new CfnAgentAlias(this, 'AgentAlias', {
      agentAliasName: 'AskBob',
      agentId: agent.attrAgentId,
    });
    this.exportAndOutputParameter(
      BedrockStackParameterExport.AgentAliasId,
      agentAlias.attrAgentAliasId,
    );
  }
}

export interface BedrockStackParameters {
  readonly store: ParameterStore;
  readonly agentId: string;
  readonly agentAliasId: string;
}

/**
 * Helper method to pull the stack parameters from the parameter store.
 *
 * @param scope the scope to create constructs in
 * @param options the parameter store options
 */
export function getBedrockStackParameters(
  scope: Construct,
  options: ParameterStoreOptions,
): BedrockStackParameters {
  const store = new ParameterStore(scope, 'BedrockStackParameters', options);
  return {
    store,
    agentId: store.read(BedrockStackParameterExport.AgentId),
    agentAliasId: store.read(BedrockStackParameterExport.AgentAliasId),
  };
}
