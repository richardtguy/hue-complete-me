import './App.css';

export default function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">Hue Complete Me</h1>
      </header>
      <main className="app__main">
        <div className="app__board-placeholder" aria-hidden="true" />
      </main>
    </div>
  );
}
