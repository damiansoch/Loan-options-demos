import { useState, useEffect, useMemo } from "react";
import { useManifest } from "./hooks/useManifest";
import { useScenario } from "./hooks/useScenario";
import { getPoolsDebugInfo } from "./utils/loanOptions";
import DonutView from "./components/DonutView";
import DashboardView from "./components/DashboardView";
import TreemapView from "./components/TreemapView";
import RadialView from "./components/RadialView";
import OptionsView from "./components/OptionsView";
import "./App.css";

const VIEWS = [
  { id: "donut", label: "Donut", Component: DonutView },
  { id: "dashboard", label: "Dashboard", Component: DashboardView },
  { id: "treemap", label: "Treemap", Component: TreemapView },
  { id: "radial", label: "Radial", Component: RadialView },
  { id: "options", label: "Options", Component: OptionsView },
];

export default function App() {
  const { manifest, loading: manifestLoading } = useManifest();
  const [scenarioFile, setScenarioFile] = useState(null);
  const [viewId, setViewId] = useState("radial");
  // Independent from each view's own "selected" beneficiary state — this is
  // specifically who's chosen as a borrower for the Options view, and has
  // no bearing on the other 4 views (or vice versa).
  const [selectedBorrowers, setSelectedBorrowers] = useState(new Set());

  useEffect(() => {
    if (!scenarioFile && manifest && manifest.length > 0) {
      setScenarioFile(manifest[0].file);
    }
  }, [manifest, scenarioFile]);

  useEffect(() => {
    setSelectedBorrowers(new Set());
  }, [scenarioFile]);

  const scenario = useScenario(scenarioFile || "standard.json");
  const ActiveView = VIEWS.find((v) => v.id === viewId).Component;

  // Which shares (bank accounts / houses) each beneficiary sits in, so the
  // borrower picker can hint at their pool membership before you even pick
  // them — reused straight from the same debug pool breakdown shown lower
  // down, just indexed by beneficiary instead of by pool.
  const sharesByBeneficiary = useMemo(() => {
    if (!scenario.data) return {};
    const { pools } = getPoolsDebugInfo(scenario.data);
    const map = {};
    pools.forEach((p) => {
      p.ownerIds.forEach((id) => {
        (map[id] ??= []).push(p);
      });
    });
    return map;
  }, [scenario.data]);

  const toggleBorrower = (id) => {
    setSelectedBorrowers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

        {viewId === "options" && scenario.data && (
          <div className="borrower-picker">
            <span className="borrower-picker-label">Borrower(s)</span>
            <div className="borrower-chips">
              {scenario.data.beneficiaries.map((b) => {
                const shares = sharesByBeneficiary[b.id] || [];
                return (
                  <button
                    key={b.id}
                    type="button"
                    className={"borrower-chip" + (selectedBorrowers.has(b.id) ? " active" : "")}
                    onClick={() => toggleBorrower(b.id)}
                    title={shares.length > 0 ? shares.map((s) => s.name).join(", ") : "No shared bank account or house"}
                  >
                    <span className="borrower-chip-dot" style={{ background: b.color }} />
                    {b.name}
                    {shares.length > 0 && (
                      <span className="borrower-chip-shares" aria-hidden="true">
                        {shares.map((s) => s.icon).join("")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <main className="app-main">
          {scenario.loading && <p className="status-msg">Loading estate…</p>}
          {scenario.error && (
            <p className="status-msg error">{scenario.error}</p>
          )}
          {scenario.data && !scenario.loading && (
            <ActiveView scenario={scenario} selectedBorrowers={selectedBorrowers} />
          )}
        </main>
      </div>
    </div>
  );
}
