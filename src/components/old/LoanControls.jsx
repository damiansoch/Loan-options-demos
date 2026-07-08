import { formatCurrency, computeLoanPresets } from "../utils/calc";
import "./LoanControls.css";

const STEP = 5000;

const firstNumber = (...values) =>
  values.find((value) => typeof value === "number" && !Number.isNaN(value));

const clampPercent = (value) => Math.max(0, Math.min(100, value));

export default function LoanControls({ scenario }) {
  const { data, totals, requestedAmount, setRequestedAmount } = scenario;
  const usable = totals.usable;

  const minLimit = data.minLoanAmount || 0;

  const totalEstateValue = firstNumber(
    totals?.totalEstateValue,
    totals?.estateValue,
    data.beneficiaries.reduce((sum, b) => sum + b.share, 0) +
      data.sharedAssets.reduce((sum, a) => sum + a.value, 0),
  );

  const eligibleValue = firstNumber(
    totals?.totalValue,
    totals?.selectedInterest,
    totals?.eligibleValue,
    0,
  );

  const maxAdvance = firstNumber(totals?.maxAdvance, 0);
  const requested = usable ? firstNumber(requestedAmount, 0) : 0;
  const availableAfterRequest = usable
    ? Math.max(maxAdvance - requested, 0)
    : 0;

  const estateSelectedPercent =
    totalEstateValue > 0
      ? clampPercent((eligibleValue / totalEstateValue) * 100)
      : 0;

  const requestPercent =
    maxAdvance > 0 ? clampPercent((requested / maxAdvance) * 100) : 0;
  const presets = usable ? computeLoanPresets(minLimit, maxAdvance) : [];

  // 1. Allows natural typing without blocking midway digits
  const updateRequestedAmount = (nextValue) => {
    if (nextValue === "") {
      setRequestedAmount("");
      return;
    }
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) return;
    setRequestedAmount(parsed);
  };

  // 2. Enforces min/max boundaries when user finishes typing
  const handleBlur = () => {
    const current = Number(requestedAmount);
    if (!Number.isFinite(current) || current < minLimit) {
      setRequestedAmount(minLimit);
    } else if (current > maxAdvance) {
      setRequestedAmount(maxAdvance);
    }
  };

  // 3. Simple inline bounds clamping for the step buttons
  const stepAmount = (amount) => {
    const next = Math.min(Math.max(amount, minLimit), maxAdvance);
    setRequestedAmount(next);
  };

  const metrics = [
    {
      label: "Estate",
      value: formatCurrency(totalEstateValue),
      detail: "Total value",
      type: "estate",
      progress: estateSelectedPercent,
    },
    {
      label: "Eligible",
      value: formatCurrency(eligibleValue),
      detail: `${Math.round(estateSelectedPercent)}% selected`,
      type: "eligible",
    },
    {
      label: "LTV",
      value: `${Math.round(data.loanToValue * 100)}%`,
      detail: "Policy limit",
      type: "ltv",
    },
    {
      label: "Max loan",
      value: formatCurrency(maxAdvance),
      detail: "Eligible × LTV",
      type: totals.belowMin ? "blocked" : "max",
    },
  ];

  return (
    <section className="loan-controls" aria-label="Loan controls">
      <div className="loan-controls-header">
        <div className="loan-title-group">
          <span className="loan-eyebrow">Loan Summary</span>
          <h3>Requested Amount</h3>
        </div>
        <div className={`loan-status ${usable ? "live" : "blocked"}`}>
          {usable ? "Available" : "Unavailable"}
        </div>
      </div>

      <div className="loan-metrics" aria-label="Loan availability summary">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className={`metric-card metric-${metric.type}`}
          >
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-detail">{metric.detail}</span>
            {typeof metric.progress === "number" && (
              <span className="metric-progress" aria-hidden="true">
                <span style={{ width: `${metric.progress}%` }} />
              </span>
            )}
          </article>
        ))}
      </div>

      <div className={`request-panel ${!usable ? "disabled" : ""}`}>
        <div className="request-summary">
          <div>
            <span className="metric-label">Requested</span>
            <strong className="request-value">
              {usable && requestedAmount !== ""
                ? formatCurrency(requested)
                : "—"}
            </strong>
          </div>
          <div className="request-remaining">
            <span>Remaining</span>
            <strong>
              {usable && requestedAmount !== ""
                ? formatCurrency(availableAfterRequest)
                : "—"}
            </strong>
          </div>
        </div>

        <span className="metric-progress" aria-hidden="true">
          <span style={{ width: `${requestPercent}%` }} />
        </span>

        <div className="request-actions">
          <div className="requested-input-row">
            <button
              type="button"
              className="step-btn"
              disabled={!usable || requested <= minLimit}
              onClick={() => stepAmount(requested - STEP)}
              aria-label="Decrease requested loan amount"
            >
              −
            </button>
            <div className="requested-money-input">
              <span className="currency">€</span>

              <input
                id="requestedInput"
                type="number"
                className="requested-input"
                disabled={!usable}
                min={minLimit}
                max={maxAdvance}
                step={1000}
                value={requestedAmount}
                onChange={(e) => updateRequestedAmount(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => e.key === "Enter" && handleBlur()}
              />
            </div>
            <button
              type="button"
              className="step-btn"
              disabled={!usable || requested >= maxAdvance}
              onClick={() => stepAmount(requested + STEP)}
              aria-label="Increase requested loan amount"
            >
              +
            </button>
          </div>

          {presets.length > 0 && (
            <div className="preset-chips" aria-label="Suggested loan amounts">
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`chip ${requestedAmount === p.value ? "active" : ""}`}
                  onClick={() => updateRequestedAmount(p.value)}
                  title={formatCurrency(p.value)}
                >
                  {p.label || formatCurrency(p.value)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {totals.belowMin && (
        <div className="below-min-banner">
          <strong>Below minimum.</strong>
          <span>
            Select more beneficiaries or unlock a shared asset to reach{" "}
            {formatCurrency(minLimit)}.
          </span>
        </div>
      )}
    </section>
  );
}
