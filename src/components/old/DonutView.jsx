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

const DONUT_OUTER_RADIUS = 48;
const DONUT_INNER_RADIUS = 31;
const DONUT_CENTER_RADIUS = 30.2;
const DONUT_SEGMENT_GAP_DEG = 5.8;

// Badge centres sit just outside the outer ring, like the concept image.
const DONUT_MARKER_RADIUS_PCT = 52.5;

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;

  return {
    x: centerX + radius * Math.sin(angleInRadians),
    y: centerY - radius * Math.cos(angleInRadians),
  };
};

const describeRingSegment = (startAngle, endAngle) => {
  const outerStart = polarToCartesian(50, 50, DONUT_OUTER_RADIUS, startAngle);
  const outerEnd = polarToCartesian(50, 50, DONUT_OUTER_RADIUS, endAngle);
  const innerEnd = polarToCartesian(50, 50, DONUT_INNER_RADIUS, endAngle);
  const innerStart = polarToCartesian(50, 50, DONUT_INNER_RADIUS, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? "1" : "0";

  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    DONUT_OUTER_RADIUS,
    DONUT_OUTER_RADIUS,
    0,
    largeArcFlag,
    1,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerEnd.x,
    innerEnd.y,
    "A",
    DONUT_INNER_RADIUS,
    DONUT_INNER_RADIUS,
    0,
    largeArcFlag,
    0,
    innerStart.x,
    innerStart.y,
    "Z",
  ].join(" ");
};

const firstNumber = (...values) => values.find((value) => typeof value === "number" && !Number.isNaN(value));

const formatPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—";
  const normalized = value <= 1 ? value * 100 : value;
  return `${normalized.toFixed(normalized % 1 === 0 ? 0 : 1)}%`;
};

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
  ].filter((s) => typeof s.value === "number" && s.value > 0);

  const grandTotal = slices.reduce((sum, s) => sum + s.value, 0);
  const gapSize = slices.length > 1 ? DONUT_SEGMENT_GAP_DEG : 0;

  let cursor = 0;
  const segments = [];
  const donutMarkers = [];

  slices.forEach((s) => {
    const startDeg = grandTotal > 0 ? (cursor / grandTotal) * 360 : 0;
    cursor += s.value;
    const endDeg = grandTotal > 0 ? (cursor / grandTotal) * 360 : 360;
    const rawLength = Math.max(endDeg - startDeg, 0);
    const appliedGap = Math.min(gapSize, Math.max(rawLength * 0.36, 0));
    const segmentStart = startDeg + appliedGap / 2;
    const segmentEnd = endDeg - appliedGap / 2;
    const color = s.active ? s.color : "#e8eef7";

    segments.push({
      id: `${s.kind}-${s.id}`,
      color,
      active: s.active,
      d: describeRingSegment(segmentStart, segmentEnd),
    });

    const midRad = (((startDeg + endDeg) / 2) * Math.PI) / 180;
    donutMarkers.push({
      id: `${s.kind}-${s.id}`,
      kind: s.kind,
      icon: s.icon,
      color: s.color,
      active: s.active,
      leftPct: 50 + DONUT_MARKER_RADIUS_PCT * Math.sin(midRad),
      topPct: 50 - DONUT_MARKER_RADIUS_PCT * Math.cos(midRad),
    });
  });

  const totalEstateValue = firstNumber(
    totals?.totalEstateValue,
    totals?.estateValue,
    data.beneficiaries.reduce((sum, b) => sum + b.share, 0) + data.sharedAssets.reduce((sum, a) => sum + a.value, 0)
  );
  const selectedInterest = firstNumber(totals?.selectedInterest, totals?.selectedValue, totals?.eligibleValue);
  const requestedAmount = firstNumber(totals?.requestedAmount, totals?.loanAmount, scenario.requestedAmount, scenario.loanAmount);
  const availableAmount = firstNumber(totals?.availableAmount, totals?.availableEquity, totals?.maxAdvance);
  const currentLtv = firstNumber(totals?.ltv, totals?.currentLtv, totals?.requestedLtv);

  const summaryRows = [
    { label: "Total estate value", value: formatCurrency(totalEstateValue) },
    selectedInterest !== undefined && { label: "Selected interest", value: formatCurrency(selectedInterest) },
    { label: "Maximum advance", value: formatCurrency(totals.maxAdvance), highlight: true, blocked: totals.belowMin },
    requestedAmount !== undefined && { label: "Requested amount", value: formatCurrency(requestedAmount), strong: true },
    currentLtv !== undefined && { label: "Current LTV", value: formatPercent(currentLtv) },
    availableAmount !== undefined && { label: "Available amount", value: formatCurrency(availableAmount) },
  ].filter(Boolean);

  return (
    <div className="donut-view">
      <section className="estate-panel">
        <div className="panel-heading">
          <span className="panel-kicker">Input</span>
          <h2>Estate Interests</h2>
          <p>Choose which beneficiaries and shared assets are included in the loan option.</p>
        </div>

        {data.sharedAssets.length > 0 && (
          <div className="estate-section">
            <div className="section-title">Shared assets</div>
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
                      <span className="asset-owners">{assetOwnersLabel(a, data.beneficiaries)}</span>
                      <span className="asset-participation">{assetParticipationLabel(a, selected)}</span>
                      <span className="asset-eligibility">{ASSET_ELIGIBILITY_NOTE}</span>
                    </span>
                    <span className="asset-status">{assetStatusLabel(included)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="estate-section">
          <div className="section-title">Beneficiaries</div>
          <ul className="ben-list">
            {data.beneficiaries.map((b) => {
              const checked = selected.has(b.id);
              const alone = qualifiesAlone(b, data);
              const flags = ownedAssetIcons(b.id, data, includedAssetIds);
              return (
                <li key={b.id} className={"ben-row" + (checked ? " checked" : "")}>
                  <label>
                    <input type="checkbox" checked={checked} onChange={() => toggleBeneficiary(b.id)} />
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
                    <span className={"ben-note" + (alone ? " good" : "")}>{aloneStatusLabel(b, data)}</span>
                    <span className="ben-badge">✓</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      <section className="calculator-panel">
        <div className="panel-heading calculator-heading">
          <span className="panel-kicker">Output</span>
          <h2>Loan Calculator</h2>
          <p>Visual breakdown, summary figures and requested loan controls.</p>
        </div>

        <div className="calculator-grid">
          <div className="calc-card donut-card">
            <div className="donut-chart">
              <svg className="donut-segments" viewBox="0 0 100 100" aria-hidden="true">
                {segments.map((segment) => (
                  <path
                    key={segment.id}
                    className={"donut-segment" + (segment.active ? " active" : "")}
                    d={segment.d}
                    fill={segment.color}
                  />
                ))}
                <circle className="donut-center-disk" cx="50" cy="50" r={DONUT_CENTER_RADIUS} />
              </svg>

              {donutMarkers.map((marker) => (
                <span
                  key={marker.id}
                  className={
                    "donut-marker" +
                    (marker.active ? " active" : "") +
                    (marker.kind === "asset" ? " asset-marker" : " beneficiary-marker")
                  }
                  style={{
                    left: `${marker.leftPct}%`,
                    top: `${marker.topPct}%`,
                    "--marker-color": marker.color,
                  }}
                >
                  {marker.kind === "asset" ? (
                    <span className="donut-marker-emoji">{marker.icon}</span>
                  ) : (
                    <svg className="donut-marker-svg" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 12.25c2.35 0 4.25-1.9 4.25-4.25S14.35 3.75 12 3.75 7.75 5.65 7.75 8s1.9 4.25 4.25 4.25Z" />
                      <path d="M4.75 20.25c.55-3.42 3.48-5.75 7.25-5.75s6.7 2.33 7.25 5.75H4.75Z" />
                    </svg>
                  )}
                </span>
              ))}
              <div className="donut-hole">
                <span className="donut-hole-label">Maximum advance</span>
                <span className={"donut-hole-value" + (totals.belowMin ? " blocked" : "")}>
                  {formatCurrency(totals.maxAdvance)}
                </span>
              </div>
            </div>
          </div>

          <div className="calc-card summary-card">
            <div className="card-heading">
              <span>Loan Summary</span>
              {totals.belowMin && <strong className="summary-warning">Below minimum</strong>}
            </div>
            <div className="summary-list">
              {summaryRows.map((row) => (
                <div
                  key={row.label}
                  className={
                    "summary-row" +
                    (row.highlight ? " highlight" : "") +
                    (row.blocked ? " blocked" : "") +
                    (row.strong ? " strong" : "")
                  }
                >
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="calc-card requested-card">
          <div className="card-heading">
            <span>Requested Amount</span>
          </div>
          <LoanControls scenario={scenario} />
        </div>
      </section>
    </div>
  );
}
