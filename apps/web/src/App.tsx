import { CapitalProvider } from "./components/CapitalProvider";
import { FacilitiesList } from "./components/FacilitiesList";
import { Header } from "./components/Header";
import { NotDeployed } from "./components/NotDeployed";
import { Originator } from "./components/Originator";
import { PoolBoard } from "./components/PoolBoard";
import { useDeployment } from "./hooks/useDeployment";

export function App() {
  const deployment = useDeployment();
  const isDeployed = !!deployment?.pool;

  return (
    <div className="app">
      <Header />
      <main className="main">
        {isDeployed ? (
          <>
            <PoolBoard />
            <div className="two-col">
              <CapitalProvider />
              <Originator />
            </div>
            <FacilitiesList />
          </>
        ) : (
          <NotDeployed />
        )}
      </main>
    </div>
  );
}
