import {
  formatCurrency,
  isAssetIncluded,
  qualifiesAlone,
  aloneStatusLabel,
  assetStatusLabel,
  assetOwnersLabel,
  assetParticipationLabel,
  ownedAssetIcons,
  ASSET_ELIGIBILITY_NOTE,
} from "../utils/calc";
import LoanControls from "./LoanControls";
import "./TreemapView.css";

function squarifyLite(items, x, y, w, h) {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, w, h }];

  const total = items.reduce((sum, i) => sum + i.value, 0);
  let running = 0;
  let splitIdx = 1;
  for (let i = 0; i < items.length; i++) {
    running += items[i].value;
    if (running >= total / 2) {
      splitIdx = i + 1;
      break;
    }
  }
  splitIdx = Math.max(1, Math.min(items.length - 1, splitIdx));

  const groupA = items.slice(0, splitIdx);
  const groupB = items.slice(splitIdx);
  const fracA = groupA.reduce((sum, i) => sum + i.value, 0) / total;

  if (w >= h) {
    const wA = w * fracA;
    return [
      ...squarifyLite(groupA, x, y, wA, h),
      ...squarifyLite(groupB, x + wA, y, w - wA, h),
    ];
  }
  const hA = h * fracA;
  return [
    ...squarifyLite(groupA, x, y, w, hA),
    ...squarifyLite(groupB, x, y + hA, w, h - hA),
  ];
}

export default function TreemapView({ scenario }) {
  const { data, selected, includedAssetIds, toggleBeneficiary, toggleAsset } = scenario;

  const items = data.beneficiaries
    .map((b) => ({
      id: b.id,
      name: b.name,
      color: b.color,
      value: b.share,
      active: selected.has(b.id),
      alone: qualifiesAlone(b, data),
      statusLabel: aloneStatusLabel(b, data),
      flags: ownedAssetIcons(b.id, data, includedAssetIds),
    }))
    .sort((p, q) => q.value - p.value);

  const tiles = squarifyLite(items, 0, 0, 100, 100);

  return (
    <div className="treemap-view">
      <section className="treemap-panel">
        <div className="panel-header">
          <p className="section-label">Estate Interests</p>
          <p className="section-hint">Box size reflects share value</p>
        </div>
        <div className="treemap-canvas">
          {tiles.map((t) => (
            <button
              key={t.id}
              type="button"
              className={"treemap-tile" + (t.active ? " active" : "")}
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: `${t.w}%`,
                height: `${t.h}%`,
                "--tile-color": t.color,
              }}
              onClick={() => toggleBeneficiary(t.id)}
            >
              {t.flags.length > 0 && (
                <span className="tile-flag">
                  {t.flags.map((f, i) => (
                    <span key={i} className={f.included ? "included" : ""}>
                      {f.icon}
                    </span>
                  ))}
                </span>
              )}
              <span className="tile-name">{t.name}</span>
              <span className="tile-value">{formatCurrency(t.value)}</span>
              <span className={"tile-status" + (t.alone ? " good" : "")}>
                {t.statusLabel}
              </span>
            </button>
          ))}
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
      </section>

      <section className="treemap-side">
        <LoanControls scenario={scenario} />
      </section>
    </div>
  );
}
