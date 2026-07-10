import { useEffect, useMemo, useState } from "react";
import { formatCurrency, computeLoanPresets } from "../utils/calc";
import "./LoanControls.css";

const STEP = 5000;

const firstNumber = (...values) =>
  values.find((value) => typeof value === "number" && !Number.isNaN(value));

const clampPercent = (value) => Math.max(0, Math.min(100, value));

const clampAmount = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const toInputValue = (value) => {
  if (value === "" || value === null || value === undefined) return "";
  return String(value);
};

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

  const debts = firstNumber(totals?.debts, 0);
  const maxAdvance = firstNumber(totals?.maxAdvance, 0);
  const requested = usable ? firstNumber(Number(requestedAmount), 0) : 0;

  const [draftAmount, setDraftAmount] = useState(toInputValue(requestedAmount));

  useEffect(() => {
    setDraftAmount(toInputValue(requestedAmount));
  }, [requestedAmount]);

  const availableAfterRequest = usable
    ? Math.max(maxAdvance - requested, 0)
    : 0;

  const estateSelectedPercent =
    totalEstateValue > 0
      ? clampPercent((eligibleValue / totalEstateValue) * 100)
      : 0;

  const requestPercent =
    maxAdvance > 0 ? clampPercent((requested / maxAdvance) * 100) : 0;

  const presets = useMemo(
    () => (usable ? computeLoanPresets(minLimit, maxAdvance) : []),
    [usable, minLimit, maxAdvance],
  );

  const commitRequestedAmount = (value) => {
    const parsed = Number(value);
    const next = clampAmount(parsed, minLimit, maxAdvance);
    setRequestedAmount(next);
    setDraftAmount(String(next));
  };

  const updateRequestedAmount = (nextValue) => {
    const cleanValue = nextValue.replace(/[^0-9]/g, "");
    setDraftAmount(cleanValue);

    if (cleanValue === "") return;

    const parsed = Number(cleanValue);
    if (!Number.isFinite(parsed)) return;

    const liveValue = Math.min(parsed, maxAdvance);
    setRequestedAmount(liveValue);
  };

  const handleBlur = () => {
    commitRequestedAmount(draftAmount);
  };

  const stepAmount = (amount) => {
    const next = clampAmount(amount, minLimit, maxAdvance);
    setRequestedAmount(next);
    setDraftAmount(String(next));
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
      detail:
        debts > 0
          ? `${Math.round(estateSelectedPercent)}% selected, less ${formatCurrency(debts)} debts`
          : `${Math.round(estateSelectedPercent)}% selected`,
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
              {usable && draftAmount !== "" ? formatCurrency(requested) : "—"}
            </strong>
          </div>
          <div className="request-remaining">
            <span>Remaining</span>
            <strong>
              {usable && draftAmount !== ""
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

            <label className="requested-money-field" htmlFor="requestedInput">
              <span className="requested-currency">€</span>
              <input
                id="requestedInput"
                type="text"
                inputMode="numeric"
                className="requested-input"
                disabled={!usable}
                value={draftAmount}
                onChange={(e) => updateRequestedAmount(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                placeholder={String(minLimit)}
                aria-label="Requested loan amount"
              />
            </label>

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
                  className={`chip ${requested === p.value ? "active" : ""}`}
                  onClick={() => stepAmount(p.value)}
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
