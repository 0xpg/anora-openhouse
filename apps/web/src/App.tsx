import { CapitalProvider } from "./components/CapitalProvider";
import { FacilitiesList } from "./components/FacilitiesList";
import { Header } from "./components/Header";
import { Originator } from "./components/Originator";
import { PoolBoard } from "./components/PoolBoard";

export function App() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <PoolBoard />
        <div className="two-col">
          <CapitalProvider />
          <Originator />
        </div>
        <FacilitiesList />
      </main>
    </div>
  );
}
