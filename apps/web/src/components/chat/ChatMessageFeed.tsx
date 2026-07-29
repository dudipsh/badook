import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Sparkles } from 'lucide-react';
import { useStores } from '../../lib/store-context';
import { ChatAttachment } from '../../services/chat.service';
import { AuthImage } from './AuthImage';
import { ChatCardRenderer } from './cards/ChatCardRenderer';
import { ChatMarkdown } from './ChatMarkdown';

const Avatar = () => (
  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5 outline outline-1 outline-base-300 shadow-sm bg-base-100">
    <Sparkles className="w-4 h-4" stroke="url(#badookGradient)" fill="url(#badookGradient)" />
  </div>
);

const Attachments = ({ attachments }: { attachments: ChatAttachment[] }) => (
  <div className="flex flex-wrap gap-2">
    {attachments.map((att) => (
      <div key={att.id} className="rounded-2xl overflow-hidden border border-base-200">
        <AuthImage attachmentId={att.id} className="max-h-64 max-w-xs object-cover block" />
      </div>
    ))}
  </div>
);

export const ChatMessageFeed = observer(() => {
  const { chatStore } = useStores();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    chatStore.messages.length,
    chatStore.messages[chatStore.messages.length - 1]?.content,
    chatStore.messages[chatStore.messages.length - 1]?.cards?.length,
    chatStore.isTyping,
  ]);

  return (
    <div className="w-full max-w-[920px] flex flex-col gap-7">
      {chatStore.messages.map((msg) => {
        const isUser = msg.role === 'USER';
        const cards = msg.cards ?? [];
        const isLast = msg === chatStore.messages[chatStore.messages.length - 1];
        const isThinking = !isUser && chatStore.isTyping && !msg.content && cards.length === 0 && isLast;

        if (isUser) {
          // User on the LEFT — justify-end resolves to the left edge under RTL
          return (
            <div key={msg.id} className="flex w-full justify-end">
              <div className="flex flex-col gap-1.5 items-start max-w-[88%] md:max-w-[78%]">
                {msg.attachments && msg.attachments.length > 0 && (
                  <Attachments attachments={msg.attachments} />
                )}
                {msg.content && (
                  <div className="px-5 py-3 text-[15.5px] leading-relaxed whitespace-pre-wrap bg-base-200/60 text-base-content/90 rounded-[22px] font-medium shadow-sm">
                    {msg.content}
                  </div>
                )}
              </div>
            </div>
          );
        }

        // Assistant on the RIGHT — justify-start resolves to the right edge under RTL.
        // DOM-first child sits at the start (right), so the avatar hugs the right edge.
        return (
          <div key={msg.id} className="flex w-full justify-start">
            <div className="flex items-start gap-3 max-w-[96%] md:max-w-[94%]">
              <Avatar />
              <div className="flex flex-col gap-2 items-start min-w-0">
                {isThinking ? (
                  <div className="px-1 py-2 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-base-content/30 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-base-content/30 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-base-content/30 rounded-full animate-bounce" />
                  </div>
                ) : (
                  <>
                    {msg.content && <ChatMarkdown content={msg.content} />}
                    {cards.map((card) => (
                      <ChatCardRenderer
                        key={card.id}
                        card={card}
                        onDismiss={() => chatStore.dismissCard(msg.id, card.id)}
                      />
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
});
