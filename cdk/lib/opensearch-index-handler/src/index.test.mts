// import {Client} from '@opensearch-project/opensearch';
// import {AwsSigv4Signer} from '@opensearch-project/opensearch/aws';
// import {defaultProvider} from '@aws-sdk/credential-provider-node';
//
// import {test} from 'vitest';
//
// test('Moo', async () => {
//   const region = process.env['AWS_REGION'];
//   if (!region) {
//     throw new Error('AWS_REGION environment variable is required');
//   }
//   const client = new Client({
//     ...AwsSigv4Signer({
//       region,
//       service: 'aoss',
//       getCredentials: () => {
//         // Any other method to acquire a new Credentials object can be used.
//         const credentialsProvider = defaultProvider();
//         return credentialsProvider();
//       },
//     }),
//     node: 'https://u00ng5j06qq697vz6be0.us-west-2.aoss.amazonaws.com/',
//   });
//
//   // See https://docs.aws.amazon.com/opensearch-service/latest/developerguide/serverless-vector-search.html
//   const response = await client.indices.create({
//     index: 'docs',
//     body: {
//       settings: {
//         index: {
//           knn: true,
//           // 'knn.space_type': 'l2',
//           // 'knn.engine': 'FAISS',
//           // 'knn.algo_param.ef_search': 100,
//         },
//       },
//       mappings: {
//         properties: {
//           DocsVector: {
//             type: 'knn_vector',
//             dimension: 1024,
//             method: {
//               engine: 'faiss',
//               name: 'hnsw',
//             },
//           },
//           DocsText: {
//             type: 'text',
//           },
//           DocsMetadata: {
//             type: 'keyword',
//           },
//         },
//       },
//     },
//   });
//   console.log('Response', JSON.stringify(response, null, 2));
//
//   const indexExists = await client.indices.exists({index: 'docs'});
//   console.log('Bark', JSON.stringify(indexExists.body, null, 2));
//   // try {
//   //   const moo = await client.cluster.health({
//   //     index: 'docs',
//   //     wait_for_status: 'yellow',
//   //     timeout: '60s',
//   //   });
//   //   console.log('Oink', JSON.stringify(moo.body, null, 2));
//   // } catch (e) {
//   //   console.log(e);
//   // }
// });
