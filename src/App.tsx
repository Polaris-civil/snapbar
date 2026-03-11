import { HashRouter, Routes, Route } from 'react-router-dom';
import MainPanel from './routes/MainPanel';
import './App.css';

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainPanel />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
