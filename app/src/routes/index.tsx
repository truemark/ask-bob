import {$, component$, sync$} from '@builder.io/qwik';
import {routeLoader$, server$, type DocumentHead} from '@builder.io/qwik-city';
import UniversalLayout from '~/components/universal-layout';
import LogoLight from '~/components/images/logo-light';
import {
  CloseEventFunction,
  ErrorEventFunction,
  MessageEventFunction,
  OpenEventFunction,
  useWs,
} from '~/components/use-ws';
import config from '~/lib/config.server';
import {v4 as uuidv4} from 'uuid';

type ConfigData = {
  apiKey: string;
  endpoint: string;
  realtimeEndpoint: string;
};

export const sendMessage = server$(async (message: string) => {
  const response = await fetch(config().appSyncEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config().appSyncApiKey,
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
        handle: 'meow', // TODO later be dynamic
      },
    }),
  });
  console.log(response);
});

// TODO 100% Not Safe, we'll deal with real auth later once it works
export const useConfigData = routeLoader$(
  async function (): Promise<ConfigData> {
    return {
      apiKey: config().appSyncApiKey,
      endpoint: config().appSyncEndpoint,
      realtimeEndpoint: config().appSyncRealtimeEndpoint,
    };
  },
);

function encodeAppSyncCredentials(url: URL, apiKey: string) {
  const creds = {
    'host': url.host,
    'x-api-key': apiKey,
  };
  return btoa(JSON.stringify(creds));
}

function getWebsocketUrl(url: URL, apKey: string) {
  const header = encodeAppSyncCredentials(url, apKey);
  const payload = btoa(JSON.stringify({}));
  return `${url.toString()}?header=${header}&payload=${payload}`;
}

function startSubscription(ws: WebSocket, url: URL, apiKey: string) {
  const subscribeMessage = {
    id: uuidv4(),
    type: 'start',
    payload: {
      data: JSON.stringify({
        query: `subscription addMessage {
                        addMessage {
                          messageId
                          sessionId
                          body
                          handle
                          createdAt
                        }
                    }`,
      }),
      extensions: {
        authorization: {
          'x-api-key': apiKey,
          'host': url.host,
        },
      },
    },
  };
  ws.send(JSON.stringify(subscribeMessage));
}

export default component$(() => {
  const configData = useConfigData();

  const onOpen$: OpenEventFunction = $((ev, ws) => {
    ws.send(JSON.stringify({type: 'connection_init'}));
  });

  const onError$: ErrorEventFunction = $((ev, ws) => {
    console.log('Received error');

    ws.close();
  });

  const onMessage$: MessageEventFunction = $((ev, ws) => {
    if (typeof ev.data === 'string') {
      const data = JSON.parse(ev.data);
      if (data.type === 'connection_ack') {
        startSubscription(
          ws,
          new URL(configData.value.realtimeEndpoint),
          configData.value.apiKey,
        );
        return;
      }
      if (data.type === 'data') {
        if (data.payload.data.addMessage) {
          console.log('Meow', data.payload.data.addMessage.body);
          document.getElementById('content')!.innerHTML +=
            `<div class="text-white">${data.payload.data.addMessage.body}</div>`;
        }
      }
    }
  });

  const onClose$: CloseEventFunction = $((ev, ws, funcs) => {
    console.log('Websocket Closed', ev.timeStamp);
    console.log(ws.readyState);

    // Events can access the additional websocket functions provided in the 3rd argument.
    funcs.reconnect();
  });

  const webSocketUrl = getWebsocketUrl(
    new URL(configData.value.realtimeEndpoint),
    configData.value.apiKey,
  );

  useWs(webSocketUrl, {
    protocols: ['graphql-ws'],
    onOpen$,
    onError$,
    onMessage$,
    onClose$,
  });

  return (
    <UniversalLayout class="bg-neutral-850 text-neutral-400">
      <div class="flex h-screen flex-col items-center justify-between">
        <div class="flex flex-col items-center">
          <div class="p-4">
            <a href="https://truemark.io">
              <LogoLight width={200} />
            </a>
          </div>
          <div class="text-2xl text-neutral-400">Ask Bob</div>
        </div>
        <div id="content"></div>
        <div
          id="editor"
          contentEditable="true"
          class="w-5/6 md:w-2/3 bg-neutral-750 rounded-3xl sm:mb-2 md:mb-12 p-4 outline-none overflow-auto"
          // onPaste$={[
          //   sync$((e: ClipboardEvent) => e.preventDefault()),
          //   $((e) => {
          //     if (e.clipboardData) {
          //       const text = e.clipboardData.getData('text/plain');
          //       const selection = document.getSelection();
          //       if (selection) {
          //         const range = selection.getRangeAt(0);
          //         range.deleteContents();
          //         const textNode = document.createTextNode(text);
          //         range.insertNode(textNode);
          //         range.setStartAfter(textNode);
          //         selection.removeAllRanges();
          //         selection.addRange(range);
          //       }
          //     }
          //   }),
          // ]}
          onKeyDown$={[
            sync$(
              (e: KeyboardEvent) => e.key === 'Enter' && e.preventDefault(),
            ),
            $((e) => {
              if (e.key === 'Enter') {
                const element = document.getElementById('editor');
                if (element) {
                  sendMessage(element.innerText);
                  element.innerText = '';
                }
              }
            }),
          ]}
        ></div>
      </div>
    </UniversalLayout>
  );
});

export const head: DocumentHead = {
  title: 'Ask Bob, a Generative AI Chatbot create by TrueMark run on AWS',
  meta: [
    {
      name: 'description',
      content:
        'Welcome to Ask Bob, a generative AI chatbot created by TrueMark. Ask Bob anything and he will generate a response for you.',
    },
  ],
};
