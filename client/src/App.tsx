import { Routes, Route, NavLink } from 'react-router-dom';
import FindPage from './components/FindPage';
import AddPage from './components/AddPage';
import AboutPage from './components/AboutPage';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<FindPage />} />
        <Route path="/add" element={<AddPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
      <nav className="nav">
        <NavLink to="/">Find</NavLink>
        <NavLink to="/add">Add</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
    </div>
  );
}
