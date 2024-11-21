import {test} from 'vitest';
import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime';

test(
  'OneOff',
  async () => {
    process.env['AWS_PROFILE'] = 'truemark-dev-ejensen';
    const client = new BedrockAgentRuntimeClient({region: 'us-west-2'});
    const response = await client.send(
      new InvokeAgentCommand({
        agentId: 'BA66DEBWZH',
        agentAliasId: '1KYBVTHJZ9',
        sessionId: 'test',
        inputText: 'Who is Ben Gillett?',
      }),
    );
    const decoder = new TextDecoder('utf-8');
    if (response.completion) {
      for await (const output of response.completion) {
        if (output.chunk) {
          process.stdout.write(decoder.decode(output.chunk.bytes));
        }
      }
    }
  },
  {
    timeout: 60000,
  },
);
