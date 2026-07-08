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
import "./DonutView.css";

// Ring band sits between the donut-hole's edge and the outer edge (35%-50%
// of the chart's radius at the current sizing) — this places asset icons
// centered inside their own colored band, not floating outside it.
const RING_ICON_RADIUS_PCT = 42.5;

export default function DonutView({ scenario }) {
  const { data, selected, includedAssetIds, toggleBeneficiary, toggleAsset, totals } = scenario;

  const slices = [
    ...data.beneficiaries.map((b) => ({
      kind: "ben",
      id: b.id,
      color: b.color,
      value: b.share,
      active: selected.has(b.id),
    })),
    ...data.sharedAssets.map((a, i) => ({
      kind: "asset",
      id: a.id,
      icon: a.icon,
      color: assetColor(i),
      value: a.value,
      active: isAssetIncluded(a, includedAssetIds),
    })),
  ];
  const grandTotal = slices.reduce((sum, s) => sum + s.value, 0);

  let cursor = 0;
  const stops = [];
  const assetIcons = [];
  slices.forEach((s) => {
    const start = (cursor / grandTotal) * 360;
    cursor += s.value;
    const end = (cursor / grandTotal) * 360;
    const color = s.active ? s.color : "#e2e8f0";
    stops.push(`${color} ${start}deg ${end}deg`);
    if (s.kind === "asset") {
      const midRad = (((start + end) / 2) * Math.PI) / 180;
      assetIcons.push({
        id: s.id,
        icon: s.icon,
        active: s.active,
        leftPct: 50 + RING_ICON_RADIUS_PCT * Math.sin(midRad),
        topPct: 50 - RING_ICON_RADIUS_PCT * Math.cos(midRad),
      });
    }
  });
  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="donut-view">
      <section className="donut-panel">
        <div className="donut-chart" style={{ background: gradient }}>
          {assetIcons.map((b) => (
            <span
              key={b.id}
              className={"donut-asset-icon" + (b.active ? " active" : "")}
              style={{ left: `${b.leftPct}%`, top: `${b.topPct}%` }}
            >
              {b.icon}
            </span>
          ))}
          <div className="donut-hole">
            <span className="donut-hole-label">Maximum advance</span>
            <span className={"donut-hole-value" + (totals.belowMin ? " blocked" : "")}>
              {formatCurrency(totals.maxAdvance)}
            </span>
          </div>
        </div>
      </section>

      <section className="ben-panel">
        <h2>Estate Interests</h2>
        {data.sharedAssets.length > 0 && (
          <div className="shared-assets-row">
            {data.sharedAssets.map((a) => {
              const included = isAssetIncluded(a, includedAssetIds);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={"asset-pill" + (included ? " active" : "")}
                  onClick={() => toggleAsset(a)}
                >
                  <span className="asset-icon">{a.icon}</span>
                  <span className="asset-body">
                    <span className="asset-name">
                      {a.name} · {formatCurrency(a.value)}
                    </span>
                    <span className="asset-owners">
                      {assetOwnersLabel(a, data.beneficiaries)}
                    </span>
                    <span className="asset-participation">
                      {assetParticipationLabel(a, selected)}
                    </span>
                    <span className="asset-eligibility">{ASSET_ELIGIBILITY_NOTE}</span>
                  </span>
                  <span className="asset-status">{assetStatusLabel(included)}</span>
                </button>
              );
            })}
          </div>
        )}
        <ul className="ben-list">
          {data.beneficiaries.map((b) => {
            const checked = selected.has(b.id);
            const alone = qualifiesAlone(b, data);
            const flags = ownedAssetIcons(b.id, data, includedAssetIds);
            return (
              <li key={b.id} className={"ben-row" + (checked ? " checked" : "")}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBeneficiary(b.id)}
                  />
                  <span className="ben-swatch" style={{ background: b.color }} />
                  <span className="ben-name">
                    {b.name}
                    {flags.map((f, i) => (
                      <span
                        key={i}
                        className={"ben-flag" + (f.included ? " included" : "")}
                        title={f.included ? "This asset is included in the loan" : "This asset is not included in the loan"}
                      >
                        {f.icon}
                      </span>
                    ))}
                  </span>
                  <span className="ben-share">{formatCurrency(b.share)}</span>
                  <span className={"ben-note" + (alone ? " good" : "")}>
                    {aloneStatusLabel(b, data)}
                  </span>
                  <span className="ben-badge">✓</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="controls-panel">
        <LoanControls scenario={scenario} />
      </section>
    </div>
  );
}
