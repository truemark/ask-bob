import {$, component$, sync$} from '@builder.io/qwik';
import type {DocumentHead} from '@builder.io/qwik-city';
import UniversalLayout from '~/components/universal-layout';
import LogoLight from '~/components/images/logo-light';

export default component$(() => {
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
            $(() => {
              console.log('Enter pressed');
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
