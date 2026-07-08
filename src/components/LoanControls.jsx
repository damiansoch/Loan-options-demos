import { formatCurrency, computeLoanPresets } from "../utils/calc";
import "./LoanControls.css";

const STEP = 5000;

export default function LoanControls({ scenario }) {
  const { data, totals, requestedAmount, setRequestedAmount } = scenario;
  const usable = totals.usable;

  const presets = usable ? computeLoanPresets(data.minLoanAmount, totals.maxAdvance) : [];

  return (
    <div className="loan-controls">
      <div className="calc-strip">
        <div className="calc-term">
          <span className="calc-value">{formatCurrency(totals.totalValue)}</span>
          <span className="calc-caption">Eligible portion</span>
        </div>
        <span className="calc-op">×</span>
        <div className="calc-term">
          <span className="calc-value">{Math.round(data.loanToValue * 100)}%</span>
          <span className="calc-caption">Loan-to-value</span>
        </div>
        <span className="calc-op">=</span>
        <div className="calc-term calc-result">
          <span className={"calc-value" + (totals.belowMin ? " blocked" : "")}>
            {formatCurrency(totals.maxAdvance)}
          </span>
          <span className="calc-caption">Maximum advance</span>
        </div>
      </div>

      {totals.belowMin && (
        <div className="below-min-banner">
          Below the {formatCurrency(data.minLoanAmount)} minimum loan — select more
          beneficiaries or unlock a shared asset.
        </div>
      )}

      <div className={"requested-section" + (!usable ? " disabled" : "")}>
        <label className="requested-label" htmlFor="requestedInput">
          Requested loan amount
        </label>
        <div className="requested-input-row">
          <button
            type="button"
            className="step-btn"
            disabled={!usable}
            onClick={() => setRequestedAmount(requestedAmount - STEP)}
            aria-label="Decrease"
          >
            −
          </button>
          <input
            id="requestedInput"
            type="number"
            className="requested-input"
            disabled={!usable}
            value={usable ? requestedAmount : ""}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              setRequestedAmount(Number.isNaN(parsed) ? data.minLoanAmount : parsed);
            }}
          />
          <button
            type="button"
            className="step-btn"
            disabled={!usable}
            onClick={() => setRequestedAmount(requestedAmount + STEP)}
            aria-label="Increase"
          >
            +
          </button>
        </div>
        <div className="preset-chips">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              className={"chip" + (requestedAmount === p.value ? " active" : "")}
              onClick={() => setRequestedAmount(p.value)}
            >
              {p.label ? `${p.label} (${formatCurrency(p.value)})` : formatCurrency(p.value)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
