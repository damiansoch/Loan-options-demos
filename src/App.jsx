import { useState, useEffect } from "react";
import { useManifest } from "./hooks/useManifest";
import { useScenario } from "./hooks/useScenario";
import DonutView from "./components/DonutView";
import DashboardView from "./components/DashboardView";
import TreemapView from "./components/TreemapView";
import RadialView from "./components/RadialView";
import "./App.css";

const VIEWS = [
  { id: "donut", label: "Donut", Component: DonutView },
  { id: "dashboard", label: "Dashboard", Component: DashboardView },
  { id: "treemap", label: "Treemap", Component: TreemapView },
  { id: "radial", label: "Radial", Component: RadialView },
];

export default function App() {
  const { manifest, loading: manifestLoading } = useManifest();
  const [scenarioFile, setScenarioFile] = useState(null);
  const [viewId, setViewId] = useState("radial");

  useEffect(() => {
    if (!scenarioFile && manifest && manifest.length > 0) {
      setScenarioFile(manifest[0].file);
    }
  }, [manifest, scenarioFile]);

  const scenario = useScenario(scenarioFile || "standard.json");
  const ActiveView = VIEWS.find((v) => v.id === viewId).Component;

  return (
    <div className="page-shell">
      <div className="card">
        <header className="page-header minimal">
          <div className="title-block">
            <h1>Loan Option Selection</h1>
          </div>
        </header>

        <div className="toolbar minimal-toolbar">
          <label className="scenario-picker">
            <span>Estate</span>
            <select
              value={scenarioFile || ""}
              disabled={manifestLoading}
              onChange={(e) => setScenarioFile(e.target.value)}
            >
              {manifest?.map((m) => (
                <option key={m.file} value={m.file}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <div className="view-tabs" aria-label="Visualisation type">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={"view-tab" + (v.id === viewId ? " active" : "")}
                onClick={() => setViewId(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <main className="app-main">
          {scenario.loading && <p className="status-msg">Loading estate…</p>}
          {scenario.error && (
            <p className="status-msg error">{scenario.error}</p>
          )}
          {scenario.data && !scenario.loading && (
            <ActiveView scenario={scenario} />
          )}
        </main>
      </div>
    </div>
  );
}
