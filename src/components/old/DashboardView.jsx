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

  return (
    <div className="dashboard-view">
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

      <div className="dashboard-grid">
        <section className="ben-section">
          <h2>Estate Interests</h2>

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
        </section>

        <section className="right-col">
          <LoanControls scenario={scenario} />
        </section>
      </div>
    </div>
  );
}
