import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import SampleListPage from '@/pages/SampleListPage/SampleListPage';
import SampleEditorPage from '@/pages/SampleEditorPage/SampleEditorPage';

const App = () => {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { direction: 'rtl' },
        }}
      />
      <Routes>
        <Route path="/" element={<SampleListPage />} />
        <Route path="/samples/:id" element={<SampleEditorPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
