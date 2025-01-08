// See https://aws.amazon.com/blogs/mobile/appsync-lambda-auth
export const handler = async (event: unknown) => {
  console.log('Event', JSON.stringify(event, null, 2)); // For debugging purposes
  return {
    isAuthorized: true,
    resolverContext: {
      userid: 'anonymous',
    },
    deniedFields: [],
    ttlOverride: 10,
  };
};
