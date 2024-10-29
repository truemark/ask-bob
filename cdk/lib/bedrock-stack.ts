import {ExtendedStack, ExtendedStackProps} from 'truemark-cdk-lib/aws-cdk';
import {Construct} from 'constructs';
import {
  CfnDataSource,
  CfnKnowledgeBase,
  FoundationModel,
  FoundationModelIdentifier,
} from 'aws-cdk-lib/aws-bedrock';
import {ParameterStoreOptions} from 'truemark-cdk-lib/aws-ssm';
import {getDataStackParameters} from './data-stack';
import {
  CfnCollection,
  CfnSecurityPolicy,
} from 'aws-cdk-lib/aws-opensearchserverless';
import {Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';

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
}

/**
 * Deploys AWS Bedrock resources.
 */
export class BedrockStack extends ExtendedStack {
  constructor(scope: Construct, id: string, props: BedrockStackProps) {
    super(scope, id, props);

    const fm = FoundationModel.fromFoundationModelId(
      this,
      'FoundationModel',
      FoundationModelIdentifier.ANTHROPIC_CLAUDE_3_5_SONNET_20241022_V2_0,
    );

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

    const codeKnowledgeBaseRole = new Role(this, 'CodeKnowledgeBaseRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });

    // Create a knowledge base for code
    const codeKnowledgeBase = new CfnKnowledgeBase(this, 'CodeKnowledgeBase', {
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: fm.modelArn,
        },
      },
      name: 'AskBobCodeKnowledgeBase',
      roleArn: codeKnowledgeBaseRole.roleArn,
      storageConfiguration: {
        type: 'OPENSEARCH_SERVERLESS',
        opensearchServerlessConfiguration: {
          collectionArn: collection.attrArn,
          fieldMapping: {
            metadataField: 'CodeMetadata',
            textField: 'CodeText',
            vectorField: 'CodeVector',
          },
          vectorIndexName: 'CodeIndex',
        },
      },
    });

    // Create a data source to connect the knowledge base with the data
    new CfnDataSource(this, 'CodeDataSource', {
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: dataStackParameters.knowledgeBaseBucket.bucketArn,
          inclusionPrefixes: ['code'],
        },
      },
      knowledgeBaseId: codeKnowledgeBase.attrKnowledgeBaseId,
      name: 'AskBobCodeDataSource',
      dataDeletionPolicy: 'DELETE',
    });

    const docsKnowledgeBaseRole = new Role(this, 'DocsKnowledgeBaseRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });

    // Create a knowledge base for code
    const docsKnowledgeBase = new CfnKnowledgeBase(this, 'DocsKnowledgeBase', {
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: fm.modelArn,
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
          vectorIndexName: 'DocsIndex',
        },
      },
    });

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

    const webKnowledgeBaseRole = new Role(this, 'WebKnowledgeBaseRole', {
      assumedBy: new ServicePrincipal('bedrock.amazonaws.com'),
    });

    const webKnowledgeBase = new CfnKnowledgeBase(this, 'WebKnowledgeBase', {
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: fm.modelArn,
        },
      },
      name: 'AskBobWebKnowledgeBase',
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
          vectorIndexName: 'WebIndex',
        },
      },
    });

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
  }
}
