import {
  formatCurrency,
  isAssetIncluded,
  qualifiesAlone,
  aloneStatusLabel,
  assetStatusLabel,
  assetColor,
  assetOwnersLabel,
  assetParticipationLabel,
  ownedAssetIcons,
  ASSET_ELIGIBILITY_NOTE,
} from "../utils/calc";
import LoanControls from "./LoanControls";
import "./DashboardView.css";

export default function DashboardView({ scenario }) {
  const { data, selected, includedAssetIds, toggleBeneficiary, toggleAsset } = scenario;

  const segments = [
    ...data.beneficiaries.map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      value: b.share,
      active: selected.has(b.id),
    })),
    ...data.sharedAssets.map((a, i) => ({
      id: a.id,
      name: a.name,
      icon: a.icon,
      color: assetColor(i),
      value: a.value,
      active: isAssetIncluded(a, includedAssetIds),
    })),
  ];
  const grandTotal = segments.reduce((sum, s) => sum + s.value, 0);
  const selectedCount = data.beneficiaries.filter((b) => selected.has(b.id)).length;
  const includedAssetCount = data.sharedAssets.filter((a) =>
    isAssetIncluded(a, includedAssetIds)
  ).length;

  return (
    <div className="dashboard-view">
      <div className="dashboard-topline">
        <div>
          <span className="dashboard-eyebrow">Loan option builder</span>
          <h2>Estate participation overview</h2>
        </div>

        <div className="dashboard-stats" aria-label="Current option summary">
          <span>{selectedCount} beneficiaries selected</span>
          <span>{includedAssetCount} assets included</span>
        </div>
      </div>

      <div className="allocation-shell">
        <div className="allocation-bar">
          {segments.map((s) => (
            <div
              key={s.id}
              className={"allocation-segment" + (s.active ? "" : " inactive")}
              style={{
                width: `${(s.value / grandTotal) * 100}%`,
                background: s.active ? s.color : "#e2e8f0",
              }}
              title={`${s.name} · ${formatCurrency(s.value)}`}
            >
              {s.icon && <span className="segment-icon">{s.icon}</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-grid">
        <section className="ben-section">
          <div className="section-heading">
            <span className="section-kicker">Estate Interests</span>
            <h3>Choose the interests used for this option</h3>
            <p>
              Shared assets stay visually separated from beneficiary shares so it is clear what is
              participating in the loan.
            </p>
          </div>

          {data.sharedAssets.length > 0 && (
            <div className="house-panels">
              {data.sharedAssets.map((a) => {
                const included = isAssetIncluded(a, includedAssetIds);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={"house-panel" + (included ? " active" : "")}
                    onClick={() => toggleAsset(a)}
                  >
                    <span className="house-panel-icon">{a.icon}</span>
                    <span className="house-panel-body">
                      <span className="house-panel-title">
                        {a.name} · {formatCurrency(a.value)}
                      </span>
                      <span className="house-panel-sub">
                        {assetOwnersLabel(a, data.beneficiaries)}
                      </span>
                      <span className="house-panel-participation">
                        {assetParticipationLabel(a, selected)}
                      </span>
                      <span className="house-panel-eligibility">{ASSET_ELIGIBILITY_NOTE}</span>
                    </span>
                    <span className="house-panel-status">{assetStatusLabel(included)}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="beneficiary-card">
            <div className="beneficiary-card-title">
              <span>Beneficiary shares</span>
              <strong>{data.beneficiaries.length}</strong>
            </div>

            <ul className="ben-toggle-list">
              {data.beneficiaries.map((b) => {
                const checked = selected.has(b.id);
                const alone = qualifiesAlone(b, data);
                const flags = ownedAssetIcons(b.id, data, includedAssetIds);
                return (
                  <li key={b.id} className={"ben-toggle-row" + (checked ? " checked" : "")}>
                    <label>
                      <span className="ben-toggle-info">
                        <span className="ben-toggle-dot" style={{ background: b.color }} />
                        <span className="ben-toggle-name">
                          {b.name}
                          {flags.map((f, i) => (
                            <span
                              key={i}
                              className={"ben-toggle-flag" + (f.included ? " included" : "")}
                              title={
                                f.included
                                  ? "This asset is included in the loan"
                                  : "This asset is not included in the loan"
                              }
                            >
                              {f.icon}
                            </span>
                          ))}
                        </span>
                        <span className="ben-toggle-share">{formatCurrency(b.share)}</span>
                        <span className={"ben-toggle-note" + (alone ? " good" : "")}>
                          {aloneStatusLabel(b, data)}
                        </span>
                      </span>
                      <span className="switch">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleBeneficiary(b.id)}
                        />
                        <span className="switch-track">
                          <span className="switch-thumb" />
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <aside className="right-col">
          <div className="loan-command-card">
            <div className="loan-command-header">
              <span className="section-kicker">Summary</span>
              <h3>Requested amount</h3>
            </div>
            <LoanControls scenario={scenario} />
          </div>
        </aside>
      </div>
    </div>
  );
}
