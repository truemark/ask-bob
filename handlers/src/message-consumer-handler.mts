import {SQSEvent} from 'aws-lambda';
import * as logging from '@nr1e/logging';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
  InvokeAgentCommandInput,
} from '@aws-sdk/client-bedrock-agent-runtime';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const level = getEnv('LOG_LEVEL');
if (!logging.isLevel(level)) {
  throw new Error(`Invalid log level: ${level}`);
}
const log = logging.initialize({
  level,
  svc: 'app',
});
log.info().str('logLevel', level).msg('Initializing config');

const agentId = getEnv('AGENT_ID');
const agentAliasId = getEnv('AGENT_ALIAS_ID');
const appSyncApiKey = getEnv('APP_SYNC_API_KEY');
const appSyncEndpoint = getEnv('APP_SYNC_ENDPOINT');

export type Message = {
  messageId: string;
  sessionId: string;
  message: string;
  createdAt: string;
  handle: string;
  body: string;
};

const client = new BedrockAgentRuntimeClient();
const decoder = new TextDecoder('utf-8');

export async function sendMessage(message: string) {
  const response = await fetch(appSyncEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': appSyncApiKey,
    },
    body: JSON.stringify({
      query: `
    mutation CreateMessage($sessionId: String!, $body: String!, $handle: String!) {
      createMessage(sessionId: $sessionId, body: $body, handle: $handle) {
        messageId
        sessionId
        body
        handle
        createdAt
      }
    }
  `,
      variables: {
        sessionId: 'test', // TODO later be dynamic
        body: message,
        handle: 'Bob',
      },
    }),
  });
  console.log(response);
}

export const handler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.body) as Message;
    log.info().unknown('message', message).msg('Processing message');
    // Without this, we loop infinitely
    if (message.handle.toLowerCase() !== 'bob') {
      const response = await client.send(
        new InvokeAgentCommand({
          agentId: agentId,
          agentAliasId: agentAliasId,
          sessionId: message.sessionId,
          inputText: message.message,
        } as InvokeAgentCommandInput),
      );
      let count = 0;
      if (response.completion) {
        for await (const output of response.completion) {
          if (output.chunk) {
            const content = decoder.decode(output.chunk.bytes);
            console.log('Sending message', content);
            await sendMessage(content);
            count++;
          }
        }
      }
      log.info().num('count', count).msg('Sent messages');
    }
  }
};
