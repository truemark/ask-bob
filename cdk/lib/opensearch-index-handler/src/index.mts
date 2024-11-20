import {Client} from '@opensearch-project/opensearch';
import {AwsSigv4Signer} from '@opensearch-project/opensearch/aws';
import {defaultProvider} from '@aws-sdk/credential-provider-node';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CustomResourceEvent {
  readonly RequestType: 'Create' | 'Update' | 'Delete';
  readonly ResourceProperties: Record<string, string>;
}

export async function handler(event: CustomResourceEvent) {
  console.log('Event', JSON.stringify(event, null, 2));
  if (event.RequestType === 'Delete') {
    return;
  }
  const endpoint = event.ResourceProperties.openSearchEndpoint;
  const indexName = event.ResourceProperties.indexName;
  const metadataFieldName = event.ResourceProperties.metadataFieldName;
  const textFieldName = event.ResourceProperties.textFieldName;
  const vectorFieldName = event.ResourceProperties.vectorFieldName;
  const vectorFieldDimension = parseInt(
    event.ResourceProperties.vectorFieldDimension,
  );
  const region = process.env['AWS_REGION'];
  if (!region) {
    throw new Error('AWS_REGION environment variable is required');
  }
  console.log('Endpoint', endpoint);
  console.log('Index Name', indexName);
  console.log('Region', region);
  const client = new Client({
    ...AwsSigv4Signer({
      region,
      service: 'aoss',
      getCredentials: () => {
        // Any other method to acquire a new Credentials object can be used.
        const credentialsProvider = defaultProvider();
        return credentialsProvider();
      },
    }),
    node: endpoint,
  });
  const indexExists = await client.indices.exists({index: indexName});
  if (!indexExists.body) {
    // See https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html
    const response = await client.indices.create({
      index: indexName,
      body: {
        settings: {
          index: {
            knn: true,
            // 'knn.space_type': 'l2',
            // 'knn.engine': 'FAISS',
            // 'knn.algo_param.ef_search': 100,
          },
        },
        mappings: {
          properties: {
            [vectorFieldName]: {
              type: 'knn_vector',
              dimension: vectorFieldDimension,
              method: {
                engine: 'faiss',
                name: 'hnsw',
              },
            },
            [textFieldName]: {
              type: 'text',
            },
            [metadataFieldName]: {
              type: 'keyword',
            },
          },
        },
      },
    });
    console.log('Response', JSON.stringify(response, null, 2));
    await sleep(60000);
  }
}
