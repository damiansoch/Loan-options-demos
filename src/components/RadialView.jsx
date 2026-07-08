import { useMemo } from "react";
import {
  formatCurrency,
  isAssetIncluded,
  qualifiesAlone,
  aloneStatusLabel,
  assetStatusLabel,
  assetOwnersLabel,
  assetParticipationLabel,
  ownedAssetIcons,
  totalEstateValue,
  ASSET_ELIGIBILITY_NOTE,
} from "../utils/calc";
import { clusterBeneficiaries } from "../utils/radialLayout";
import LoanControls from "./LoanControls";
import "./RadialView.css";

const CX = 150;
const CY = 150;
const R = 108;

// 8 compass sectors instead of 4 — with a dozen beneficiaries packed
// around the wheel, 4 directions puts 3+ labels in the same spot; 8 gives
// adjacent nodes a much better chance of landing in different spots to
// begin with, before the near/far tiering below even kicks in.
const COMPASS = ["right", "bottom-right", "bottom", "bottom-left", "left", "top-left", "top", "top-right"];

function labelDirection(dx, dy) {
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const norm = (deg + 360) % 360;
  const sector = Math.round(norm / 45) % 8;
  return COMPASS[sector];
}

export default function RadialView({ scenario }) {
  const { data, selected, includedAssetIds, toggleBeneficiary, toggleAsset } = scenario;

  // Co-owners of the same asset are chained together here so they land
  // next to each other on the wheel — otherwise a house whose owners are
  // scattered around the circle gets a centroid near the hub instead of
  // near its owners (see radialLayout.js for why).
  const orderedBeneficiaries = useMemo(
    () => clusterBeneficiaries(data.beneficiaries, data.sharedAssets),
    [data.beneficiaries, data.sharedAssets],
  );
  const n = orderedBeneficiaries.length;

  const nodes = orderedBeneficiaries.map((b, i) => {
    const angleDeg = -90 + (360 / n) * i;
    const angleRad = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angleRad);
    const dy = Math.sin(angleRad);
    const x = CX + R * dx;
    const y = CY + R * dy;
    return {
      ...b,
      x,
      y,
      leftPct: (x / 300) * 100,
      topPct: (y / 300) * 100,
      dir: labelDirection(dx, dy),
      active: selected.has(b.id),
      alone: qualifiesAlone(b, data),
      statusLabel: aloneStatusLabel(b, data),
      flags: ownedAssetIcons(b.id, data, includedAssetIds),
    };
  });
  // Two neighboring nodes can still land in the same compass sector (e.g.
  // two people close together on the "right" side). When that happens,
  // push every other one's label further out so they stack at different
  // distances instead of printing on top of each other.
  let lastDir = null;
  let farToggle = false;
  nodes.forEach((nd) => {
    farToggle = nd.dir === lastDir ? !farToggle : false;
    nd.far = farToggle;
    lastDir = nd.dir;
  });

  const nodeById = Object.fromEntries(nodes.map((nd) => [nd.id, nd]));

  // Each badge sits at a fixed distance from the hub, in whatever direction
  // its owners' average position points — a fixed radius (rather than the
  // literal centroid) guarantees it never collapses onto the hub even when
  // owners can't all be clustered together (someone in two houses at once).
  // Badges that end up pointing in nearly the same direction are pushed to
  // alternating rings so they don't stack on top of each other either.
  const NEAR_RING = R * 0.52;
  const FAR_RING = R * 0.78;
  const badgeDirs = data.sharedAssets.map((a) => {
    const owners = a.ownerIds.map((id) => nodeById[id]).filter(Boolean);
    const sumX = owners.reduce((sum, o) => sum + (o.x - CX), 0);
    const sumY = owners.reduce((sum, o) => sum + (o.y - CY), 0);
    const mag = Math.hypot(sumX, sumY);
    const dirX = mag > 1e-6 ? sumX / mag : 1;
    const dirY = mag > 1e-6 ? sumY / mag : 0;
    return { asset: a, owners, angle: Math.atan2(dirY, dirX), dirX, dirY };
  });
  const sortedDirs = [...badgeDirs].sort((p, q) => p.angle - q.angle);
  let prevAngle = null;
  let ringToggle = false;
  sortedDirs.forEach((b) => {
    if (prevAngle !== null) {
      let diff = Math.abs(b.angle - prevAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      ringToggle = diff < (25 * Math.PI) / 180 ? !ringToggle : false;
    }
    b.ring = ringToggle ? FAR_RING : NEAR_RING;
    prevAngle = b.angle;
  });

  const assetBadges = badgeDirs.map((b) => {
    const px = CX + b.dirX * b.ring;
    const py = CY + b.dirY * b.ring;
    return {
      ...b.asset,
      leftPct: (px / 300) * 100,
      topPct: (py / 300) * 100,
      included: isAssetIncluded(b.asset, includedAssetIds),
      owners: b.owners,
    };
  });

  return (
    <div className="radial-view">
      <section className="visual-panel">
        <div className="panel-heading">
          <div className="section-label">
            <span className="step-num">1</span> Estate Relationship Map
          </div>
          <div className="visual-hint">Beneficiaries around the estate hub</div>
        </div>

        <div className="wheel-wrap">
          <div className="wheel">
            <svg viewBox="0 0 300 300">
              {data.sharedAssets.flatMap((a) => {
                const included = isAssetIncluded(a, includedAssetIds);
                const owners = a.ownerIds.map((id) => nodeById[id]).filter(Boolean);
                const edgeCount = owners.length === 2 ? 1 : owners.length;
                return Array.from({ length: edgeCount }, (_, i) => {
                  const from = owners[i];
                  const to = owners[(i + 1) % owners.length];
                  return (
                    <line
                      key={a.id + "-edge-" + i}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={included ? "#059669" : "#e2e8f0"}
                      strokeWidth={included ? 4 : 3.5}
                      strokeDasharray={included ? "0" : "6 6"}
                    />
                  );
                });
              })}
              {nodes.map((nd) => (
                <line
                  key={"spoke-" + nd.id}
                  x1={CX}
                  y1={CY}
                  x2={nd.x}
                  y2={nd.y}
                  stroke={nd.active ? nd.color : "#e2e8f0"}
                  strokeWidth={nd.active ? 6 : 4}
                />
              ))}
            </svg>

            <div className="hub">
              <span className="hub-icon">🏛️</span>
              <span className="hub-label">Estate</span>
              <span className="hub-value">{formatCurrency(totalEstateValue(data))}</span>
            </div>

            {assetBadges.map((a) => (
              <button
                key={a.id}
                type="button"
                className={"house-badge" + (a.included ? " active" : "")}
                style={{ left: `${a.leftPct}%`, top: `${a.topPct}%` }}
                onClick={() => toggleAsset(a)}
                aria-label={`Toggle ${a.name} owners`}
                title={`${a.name} · ${formatCurrency(a.value)} — inherited by ${a.owners
                  .map((o) => o.name)
                  .join(", ")}`}
              >
                {a.icon}
              </button>
            ))}

            {nodes.map((nd) => (
              <label
                key={nd.id}
                className="ben-node"
                style={{ left: `${nd.leftPct}%`, top: `${nd.topPct}%` }}
              >
                <input
                  type="checkbox"
                  className="ben-checkbox"
                  checked={nd.active}
                  onChange={() => toggleBeneficiary(nd.id)}
                />
                <span className="ben-avatar" style={{ background: nd.color }}>
                  {nd.name.charAt(0)}
                  <span className="ben-check">✓</span>
                  {nd.flags.length > 0 && (
                    <span className="ben-house-flag">
                      {nd.flags.map((f, i) => (
                        <span key={i} className={f.included ? "included" : ""}>
                          {f.icon}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
                <span className={"ben-tag dir-" + nd.dir + (nd.far ? " tag-far" : "")}>
                  <span className="ben-tag-name">{nd.name}</span>
                  <span className="ben-tag-value">{formatCurrency(nd.share)}</span>
                  <span className={"ben-tag-status" + (nd.alone ? " good" : "")}>
                    {nd.statusLabel}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <p className="note">
          Tap a beneficiary node or a house icon to toggle it directly on the diagram
          — or use the list alongside it. Both stay in sync.
        </p>
      </section>

      <section className="interests-panel">
        <div className="panel-heading">
          <div className="section-label">
            <span className="step-num">2</span> Estate Interests
          </div>
        </div>

        {data.sharedAssets.length > 0 && (
          <div className="asset-buttons">
            {data.sharedAssets.map((a) => {
              const included = isAssetIncluded(a, includedAssetIds);
              return (
                <button
                  key={a.id}
                  type="button"
                  className={"asset-btn" + (included ? " active" : "")}
                  onClick={() => toggleAsset(a)}
                >
                  <span className="asset-btn-icon">{a.icon}</span>
                  <span className="asset-btn-body">
                    <span className="asset-btn-title">
                      {a.name} · {formatCurrency(a.value)}
                    </span>
                    <span className="asset-btn-sub">
                      {assetOwnersLabel(a, data.beneficiaries)}
                    </span>
                    <span className="asset-btn-participation">
                      {assetParticipationLabel(a, selected)}
                    </span>
                    <span className="asset-btn-eligibility">{ASSET_ELIGIBILITY_NOTE}</span>
                  </span>
                  <span className="asset-btn-status">{assetStatusLabel(included)}</span>
                </button>
              );
            })}
          </div>
        )}

        <ul className="radial-ben-list">
          {data.beneficiaries.map((b) => {
            const checked = selected.has(b.id);
            const alone = qualifiesAlone(b, data);
            const flags = ownedAssetIcons(b.id, data, includedAssetIds);
            return (
              <li key={b.id} className={"radial-ben-row" + (checked ? " checked" : "")}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBeneficiary(b.id)}
                  />
                  <span className="radial-ben-swatch" style={{ background: b.color }} />
                  <span className="radial-ben-name">
                    {b.name}
                    {flags.map((f, i) => (
                      <span
                        key={i}
                        className={"radial-ben-flag" + (f.included ? " included" : "")}
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
                  <span className="radial-ben-share">{formatCurrency(b.share)}</span>
                  <span className={"radial-ben-note" + (alone ? " good" : "")}>
                    {aloneStatusLabel(b, data)}
                  </span>
                  <span className="radial-ben-badge">✓</span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="control-panel">
        <div className="section-label">
          <span className="step-num">3</span> Loan Availability
        </div>

        <LoanControls scenario={scenario} />
      </aside>
    </div>
  );
}
