import { observer } from 'mobx-react-lite';
import { useStores } from '../../lib/store-context';
import { BadookGradient } from './BadookGradient';
import { BadookFloatingButton } from './BadookFloatingButton';
import { ChatModal } from './ChatModal';

export const BadookBot = observer(() => {
  const { chatStore } = useStores();

  return (
    <>
      <BadookGradient />
      {!chatStore.isOpen && <BadookFloatingButton />}
      <ChatModal />
    </>
  );
});
