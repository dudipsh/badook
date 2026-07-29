import { useRef, type ChangeEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Send, Paperclip, Mic, Search, X, Loader2, Square } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useStores } from '../../lib/store-context';
import { transcribeAudio } from '../../services/chat.service';
import { AuthImage } from './AuthImage';
import { useVoiceRecorder } from './useVoiceRecorder';

const MAX_CHARS = 3000;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
const MAX_BYTES = 10 * 1024 * 1024;

const formatSeconds = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
};

export const ChatInput = observer(() => {
  const { chatStore } = useStores();
  const { t } = useTranslation('chat');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();

  const submit = () => {
    const value = chatStore.input.trim();
    if ((!value && chatStore.pendingAttachments.length === 0) || chatStore.isTyping) return;
    void chatStore.sendMessage(value);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      toast.error(t('attach.invalidType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('attach.tooBig'));
      return;
    }
    try {
      await chatStore.addAttachment(file);
    } catch {
      toast.error(t('attach.uploadFailed'));
    }
  };

  const handleMic = async () => {
    if (!recorder.isSupported) {
      toast.error(t('voice.notSupported'));
      return;
    }
    if (recorder.state === 'idle') {
      try {
        await recorder.start();
      } catch {
        toast.error(t('voice.permissionDenied'));
      }
      return;
    }
    if (recorder.state === 'recording') {
      try {
        const blob = await recorder.stop();
        if (!blob) {
          recorder.reset();
          return;
        }
        const text = await transcribeAudio(blob);
        chatStore.setInput(((chatStore.input ? chatStore.input + ' ' : '') + text).slice(0, MAX_CHARS));
      } catch {
        toast.error(t('voice.failed'));
      } finally {
        recorder.reset();
      }
    }
  };

  const micDisabled = chatStore.isTyping || recorder.state === 'processing';
  const inputDisabled = chatStore.isTyping || recorder.state !== 'idle';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="w-full max-w-[920px] mx-auto bg-base-100 shadow-[0_8px_40px_rgba(0,0,0,0.06)] rounded-[24px] border border-primary/20 focus-within:ring-[4px] focus-within:ring-primary/10 transition-all relative overflow-hidden"
    >
      {(chatStore.pendingAttachments.length > 0 || chatStore.uploadingAttachment) && (
        <div className="flex flex-wrap gap-2 px-4 pt-3">
          {chatStore.pendingAttachments.map((att) => (
            <div
              key={att.id}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-base-300 bg-base-200 group"
            >
              <AuthImage
                attachmentId={att.id}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => chatStore.removeAttachment(att.id)}
                aria-label={t('attach.remove')}
                className="absolute top-0.5 end-0.5 w-5 h-5 rounded-full bg-base-100/90 text-base-content shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {chatStore.uploadingAttachment && (
            <div className="w-16 h-16 rounded-lg border border-dashed border-base-300 flex items-center justify-center text-base-content/40">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="relative flex items-center pb-2 pt-1 w-full">
        <textarea
          value={chatStore.input}
          onChange={(e) => chatStore.setInput(e.target.value.slice(0, MAX_CHARS))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          dir="auto"
          placeholder={
            recorder.state === 'recording'
              ? t('voice.recording')
              : recorder.state === 'processing'
                ? t('voice.processing')
                : t('inputPlaceholder')
          }
          className="w-full resize-none bg-transparent border-none focus:ring-0 min-h-[56px] max-h-[200px] py-4 ltr:pl-5 rtl:pr-5 ltr:pr-20 rtl:pl-20 text-[17px] font-medium placeholder-base-content/40 focus:outline-none disabled:opacity-50 tracking-tight"
          rows={1}
          disabled={inputDisabled}
        />

        <button
          type="submit"
          aria-label={t('send')}
          disabled={(!chatStore.input.trim() && chatStore.pendingAttachments.length === 0) || chatStore.isTyping}
          className="absolute ltr:right-4 rtl:left-4 btn btn-ghost btn-circle btn-sm hover:bg-base-200 border-none shrink-0 transition-transform active:scale-95 disabled:opacity-30 text-base-content"
        >
          <Send className="w-5 h-5 rtl:-scale-x-100" />
        </button>
      </div>

      <div className="w-full h-px bg-base-200/70" />

      <div className="flex items-center justify-between px-3 py-2 bg-base-100/30">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            hidden
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={chatStore.uploadingAttachment || chatStore.isTyping}
            className="btn btn-ghost btn-xs font-semibold text-base-content/70 hover:text-base-content hover:bg-base-200 h-[30px] px-3 gap-2 rounded-[10px] disabled:opacity-50"
          >
            {chatStore.uploadingAttachment ? (
              <Loader2 className="w-[15px] h-[15px] animate-spin" />
            ) : (
              <Paperclip className="w-[15px] h-[15px]" />
            )}
            {t('attachLabel')}
          </button>

          <div className="w-px h-3.5 bg-base-300 mx-1" />

          <button
            type="button"
            onClick={handleMic}
            disabled={micDisabled}
            title={recorder.state === 'idle' ? t('voice.tapToRecord') : t('voice.recording')}
            className={`btn btn-ghost btn-xs font-semibold h-[30px] px-3 gap-2 rounded-[10px] disabled:opacity-50 transition-colors ${
              recorder.state === 'recording'
                ? 'text-error bg-error/10 hover:bg-error/20'
                : 'text-base-content/70 hover:text-base-content hover:bg-base-200'
            }`}
          >
            {recorder.state === 'recording' ? (
              <>
                <Square className="w-[13px] h-[13px] fill-current" />
                <span className="tabular-nums">{formatSeconds(recorder.elapsed)}</span>
              </>
            ) : recorder.state === 'processing' ? (
              <>
                <Loader2 className="w-[15px] h-[15px] animate-spin" />
                {t('voice.processing')}
              </>
            ) : (
              <>
                <Mic className="w-[15px] h-[15px]" />
                {t('voiceLabel')}
              </>
            )}
          </button>

          <div className="w-px h-3.5 bg-base-300 mx-1 hidden sm:block" />

          <button
            type="button"
            disabled
            title={t('comingSoon')}
            className="btn btn-ghost btn-xs font-semibold text-base-content/40 hover:bg-base-200 h-[30px] px-3 gap-2 rounded-[10px] cursor-not-allowed hidden sm:flex"
          >
            <Search className="w-[15px] h-[15px]" />
            {t('browse')}
          </button>
        </div>

        <div className="text-[14px] font-medium text-base-content/60 px-3 shrink-0 tabular-nums tracking-wide">
          {chatStore.input.length}{' '}
          <span className="text-base-content/30 opacity-70">/ {MAX_CHARS.toLocaleString()}</span>
        </div>
      </div>
    </form>
  );
});
