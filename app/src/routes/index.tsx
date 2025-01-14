import {
  $,
  component$,
  sync$,
  useSignal,
  useVisibleTask$,
} from '@builder.io/qwik';
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

const names = [
  'Abigail',
  'Alexander',
  'Alicia',
  'Andrew',
  'Anthony',
  'Benjamin',
  'Brianna',
  'Brandon',
  'Brittany',
  'Caleb',
  'Cameron',
  'Caroline',
  'Charlotte',
  'Chloe',
  'Christopher',
  'Claire',
  'Connor',
  'Daniel',
  'David',
  'Dominic',
  'Dylan',
  'Eleanor',
  'Elizabeth',
  'Ella',
  'Emily',
  'Emma',
  'Ethan',
  'Evan',
  'Faith',
  'Gabriella',
  'Gavin',
  'Grace',
  'Hannah',
  'Harper',
  'Henry',
  'Isabella',
  'Isaac',
  'Jack',
  'Jackson',
  'Jacob',
  'James',
  'Jasmine',
  'Jayden',
  'Jessica',
  'Joseph',
  'Joshua',
  'Julian',
  'Kaitlyn',
  'Kayla',
  'Kevin',
  'Kylie',
  'Lauren',
  'Leah',
  'Liam',
  'Lily',
  'Logan',
  'Lucas',
  'Luke',
  'Madison',
  'Mason',
  'Matthew',
  'Maya',
  'Mia',
  'Michael',
  'Nathan',
  'Natalie',
  'Noah',
  'Olivia',
  'Owen',
  'Parker',
  'Penelope',
  'Peyton',
  'Rachel',
  'Rebecca',
  'Riley',
  'Ryan',
  'Samantha',
  'Samuel',
  'Sarah',
  'Savannah',
  'Sebastian',
  'Sofia',
  'Sophia',
  'Stella',
  'Sydney',
  'Taylor',
  'Thomas',
  'Tyler',
  'Victoria',
  'Violet',
  'William',
  'Wyatt',
  'Xavier',
  'Zachary',
  'Zoe',
  'Zoey',
  'Aiden',
  'Angelina',
  'Bryce',
  'Clara',
];

function getRandomName(): string {
  const randomIndex = Math.floor(Math.random() * names.length);
  return names[randomIndex];
}

type ConfigData = {
  apiKey: string;
  endpoint: string;
  realtimeEndpoint: string;
};

export const sendMessage = server$(
  async (handle: string, message: string, apiKey: string) => {
    console.log('sending message');
    const response = await fetch(config().appSyncEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
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
          handle: handle,
        },
      }),
    });
    console.log(response);
  },
);

export const useConfigData = routeLoader$(
  async function (): Promise<ConfigData> {
    return {
      apiKey: 'anonymous',
      endpoint: config().appSyncEndpoint,
      realtimeEndpoint: config().appSyncRealtimeEndpoint,
    };
  },
);

// export const useGetClientIp = routeLoader$(({clientConn}) => {
//   return {ip: clientConn.ip};
// });

function encodeAppSyncCredentials(url: URL, authorizationToken: string) {
  const creds = {
    host: url.host,
    Authorization: authorizationToken,
  };
  return btoa(JSON.stringify(creds));
}

function getWebsocketUrl(url: URL, apKey: string) {
  const header = encodeAppSyncCredentials(url, apKey);
  const payload = btoa(JSON.stringify({}));
  return `${url.toString()}?header=${header}&payload=${payload}`;
}

function startSubscription(ws: WebSocket, url: URL, authoriationToken: string) {
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
                          replyToMessageId
                        }
                    }`,
      }),
      extensions: {
        authorization: {
          Authorization: authoriationToken,
          host: url.host,
        },
      },
    },
  };
  ws.send(JSON.stringify(subscribeMessage));
}

export default component$(() => {
  const configData = useConfigData();
  const wsStateSignal = useSignal('none'); // connected
  const handleSignal = useSignal(getRandomName());

  const onOpen$: OpenEventFunction = $((ev, ws) => {
    wsStateSignal.value = 'opened';
    console.log('Websocket opened', ev.timeStamp);
    ws.send(JSON.stringify({type: 'connection_init'}));
  });

  const onError$: ErrorEventFunction = $((ev, ws) => {
    wsStateSignal.value = 'errored';
    console.log('Websocket error', ev.timeStamp);
    ws.close();
  });

  const onMessage$: MessageEventFunction = $((ev, ws) => {
    const data = JSON.parse(ev.data as string);
    if (typeof ev.data === 'string') {
      if (data.type === 'connection_ack') {
        startSubscription(
          ws,
          new URL(configData.value.realtimeEndpoint),
          configData.value.apiKey,
        );
        wsStateSignal.value = 'connected';
        return;
      } else if (data.type === 'connection_error') {
        const code = data.payload.errors[0].errorCode;
        if (code === 401 || code === 403 || code === 500) {
          wsStateSignal.value = 'errored';
          console.log('Connection error', JSON.stringify(data, null, 2));
          ws.close();
        }
      } else if (data.type === 'data') {
        console.log('Data received', JSON.stringify(data, null, 2));
        if (data.payload.data.addMessage) {
          const message = data.payload.data.addMessage;
          const contentElement = document.getElementById('content');
          if (message.handle !== 'Bob') {
            const messageElement = document.createElement('div');
            messageElement.innerHTML += `<div class="pb-4 pt-4 flex" id="message-${message.messageId}">
                  <div class="pr-4 font-semibold ${message.handle === 'Bob' ? 'text-brand-primary' : message.handle !== handleSignal.value ? 'text-yellow-600' : 'text-neutral-250'}">${message.handle}:</div>
                  <div>${message.body}</div>
               </div>`;
            messageElement.innerHTML += `<div class="pb-4 pt-4 flex" class="text-neutral-250" id=${'bob-' + message.messageId}>.... working to answer ${message.handle}</div>`;
            if (contentElement) {
              contentElement.appendChild(messageElement);
              messageElement.scrollIntoView({behavior: 'smooth', block: 'end'});
            }
          } else {
            const bobElement = document.getElementById(
              'bob-' + message.replyToMessageId,
            );
            if (bobElement) {
              bobElement!.innerHTML = `<div class="pr-4 font-semibold text-brand-primary">${message.handle}:</div>
                    <div>${message.body}</div>`;
            }
          }
        }
      }
    }
  });

  const onClose$: CloseEventFunction = $((ev, ws, funcs) => {
    console.log('Websocket Closed', ev.timeStamp);
    if (wsStateSignal.value !== 'errored') {
      wsStateSignal.value = 'closed';
      funcs.reconnect();
    }
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

  useVisibleTask$(() => {
    document.getElementById('editor')?.focus();
  });

  // useEffect(() => {
  //   const element = document.getElementById('content');
  //   if (element) {
  //     element.scrollTop = element.scrollHeight;
  //   }
  // }, []);

  return (
    <UniversalLayout class="bg-neutral-850 text-neutral-400">
      <div class="flex h-screen flex-col items-center justify-between">
        <div class="flex flex-col items-center">
          <div class="p-4">
            <a href="https://truemark.io">
              <LogoLight width={200} />
            </a>
          </div>
          {wsStateSignal.value === 'connected' && (
            <>
              <div>
                You are{' '}
                <span class="text-neutral-250 font-semibold">
                  {handleSignal.value}
                </span>
              </div>
              <div class="text-2xl text-neutral-400 pt-5">
                Ask Bob a question...
              </div>
            </>
          )}
          {wsStateSignal.value === 'errored' && (
            <div>
              An error occurred connecting. Please refresh to try again.
            </div>
          )}
        </div>
        <div id="content" class="w-4/5 md:w-1/2 overflow-auto"></div>
        {wsStateSignal.value === 'connected' && (
          <div
            id="editor"
            contentEditable="true"
            class="w-4/5 md:w-1/2 bg-neutral-750 rounded-3xl sm:mb-2 md:mb-12 p-4 outline-none overflow-auto"
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
                    sendMessage(
                      handleSignal.value,
                      element.innerText,
                      configData.value.apiKey,
                    );
                    element.innerText = '';
                  }
                }
              }),
            ]}
          ></div>
        )}
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
