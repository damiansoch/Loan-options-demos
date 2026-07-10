import { useState } from "react";
import { formatCurrency, clampRequested, computeLoanPresets } from "../utils/calc";
import {
  generateLoanOptions,
  beneficiaryOptionsTotal,
  getPoolsDebugInfo,
  explainOptionGeneration,
  poolLiabilitiesTotal,
} from "../utils/loanOptions";
import { buildRingSegments } from "../utils/donutMath";
import "./OptionsView.css";

const MINI_OUTER_RADIUS = 47;
const MINI_INNER_RADIUS = 30;
const MINI_GAP_DEG = 5;
const REQUEST_STEP = 10000;

function OptionCard({ data, option, index }) {
  const borrowerSet = new Set(option.borrowerIds);
  const consenterSet = new Set(option.consenterIds);
  const notInvolved = data.beneficiaries.filter(
    (b) => !borrowerSet.has(b.id) && !consenterSet.has(b.id),
  );

  const slices = data.beneficiaries.map((b) => ({
    id: b.id,
    color: b.color,
    // A zero-value slice would collapse to a zero-length arc and throw the
    // gap math off — every beneficiary has a real total in practice, but
    // this keeps the ring well-formed even for unusual data.
    value: Math.max(beneficiaryOptionsTotal(b.id, data), 1),
    role: borrowerSet.has(b.id) ? "borrower" : consenterSet.has(b.id) ? "consenter" : "excluded",
  }));

  const segments = buildRingSegments(slices, {
    outerRadius: MINI_OUTER_RADIUS,
    innerRadius: MINI_INNER_RADIUS,
    gapDeg: MINI_GAP_DEG,
  });

  // Already net of each involved pool's own liabilities — a pool's debts
  // only ever come off that pool's own money, never the whole estate's.
  const netEligible = [...borrowerSet, ...consenterSet].reduce(
    (sum, id) => sum + beneficiaryOptionsTotal(id, data),
    0,
  );
  const debtsInThisOption = option.activePools.reduce(
    (sum, pool) => sum + poolLiabilitiesTotal(pool),
    0,
  );
  const maxAdvance = Math.round(netEligible * data.loanToValue);
  const usable = maxAdvance >= data.minLoanAmount;

  const borrowerNames = data.beneficiaries.filter((b) => borrowerSet.has(b.id)).map((b) => b.name);
  const consenterNames = data.beneficiaries.filter((b) => consenterSet.has(b.id)).map((b) => b.name);
  const notInvolvedNames = notInvolved.map((b) => b.name);

  const totalEstateValue = data.totalEstate;
  const presets = usable ? computeLoanPresets(data.minLoanAmount, maxAdvance) : [];
  const [requested, setRequested] = useState(maxAdvance);
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState(false);

  // Tracks the option's own max until the user deliberately picks a value —
  // once touched, the amount stays put and is only ever clamped, never
  // silently snapped back to max.
  const shownAmount = touched ? clampRequested(requested, data.minLoanAmount, maxAdvance) : maxAdvance;
  const [draftAmount, setDraftAmount] = useState(shownAmount.toLocaleString("en-IE"));

  const commit = (value) => {
    const next = clampRequested(value, data.minLoanAmount, maxAdvance);
    setTouched(true);
    setRequested(next);
    setDraftAmount(next.toLocaleString("en-IE"));
  };

  const typeAmount = (raw) => {
    const digitsOnly = raw.replace(/[^0-9]/g, "");
    if (digitsOnly === "") {
      setDraftAmount("");
      return;
    }
    setDraftAmount(Number(digitsOnly).toLocaleString("en-IE"));
    setTouched(true);
    setRequested(Math.min(Number(digitsOnly), maxAdvance));
  };

  const step = REQUEST_STEP;

  return (
    <div className={"option-card" + (usable ? "" : " ineligible")}>
      <div className="option-card-heading">
        Option {index + 1}
        {!usable && <span className="option-na-badge">Not eligible</span>}
      </div>

      <div className="option-donut">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          {segments.map((seg) => (
            <path
              key={seg.id}
              className={"option-segment " + seg.role}
              d={seg.d}
              fill={seg.role === "excluded" ? "#e2e8f0" : seg.color}
            />
          ))}
          <circle className="option-center-disk" cx="50" cy="50" r={MINI_INNER_RADIUS - 1} />
        </svg>
        <div className="option-hole">
          <span className="option-hole-label">Max advance</span>
          <span className="option-hole-value">{formatCurrency(maxAdvance)}</span>
        </div>
      </div>

      <div className="option-stats">
        <div className="option-stat">
          <span className="option-stat-label">Total estate</span>
          <strong className="option-stat-value">{formatCurrency(totalEstateValue)}</strong>
        </div>
        <div className="option-stat">
          <span className="option-stat-label">Lendable value</span>
          <strong className="option-stat-value">{formatCurrency(netEligible)}</strong>
        </div>
        <div className={"option-stat" + (usable ? " highlight" : "")}>
          <span className="option-stat-label">Max advance</span>
          <strong className="option-stat-value">{formatCurrency(maxAdvance)}</strong>
        </div>
      </div>

      {debtsInThisOption > 0 && (
        <div className="option-debts-note">
          Lendable value is already net of {formatCurrency(debtsInThisOption)} in debts tied to
          the pools involved here (funeral expenses, outstanding loans/mortgage).
        </div>
      )}

      <div className="option-legend">
        <div className="option-legend-row borrower">
          <span className="legend-dot" />
          <span>
            <strong>Borrower{borrowerNames.length > 1 ? "s" : ""}:</strong>{" "}
            {borrowerNames.join(", ")}
          </span>
        </div>
        <div className="option-legend-row consenter">
          <span className="legend-dot" />
          <span>
            <strong>Must consent:</strong>{" "}
            {consenterNames.length > 0 ? consenterNames.join(", ") : "No one else"}
          </span>
        </div>
        <div className="option-legend-row not-involved">
          <span className="legend-dot" />
          <span>
            <strong>Not involved:</strong>{" "}
            {notInvolvedNames.length > 0 ? notInvolvedNames.join(", ") : "Everyone is involved"}
          </span>
        </div>
      </div>

      {usable ? (
        <div className="option-request">
          <span className="option-request-label">Requested amount</span>
          <div className="option-request-field">
            <button
              type="button"
              className="option-step-btn"
              disabled={shownAmount <= data.minLoanAmount}
              onClick={() => commit(shownAmount - step)}
              aria-label="Decrease requested amount"
            >
              −
            </button>
            <label className="option-money-field">
              <span className="option-money-currency">€</span>
              <input
                type="text"
                inputMode="numeric"
                className="option-money-input"
                value={draftAmount}
                onChange={(e) => typeAmount(e.target.value)}
                onBlur={() => commit(Number(draftAmount.replace(/[^0-9]/g, "")) || data.minLoanAmount)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                aria-label="Requested amount for this option"
              />
            </label>
            <button
              type="button"
              className="option-step-btn"
              disabled={shownAmount >= maxAdvance}
              onClick={() => commit(shownAmount + step)}
              aria-label="Increase requested amount"
            >
              +
            </button>
          </div>
          <div className="option-request-bounds">
            <span>Min {formatCurrency(data.minLoanAmount)}</span>
            <span>Max {formatCurrency(maxAdvance)}</span>
          </div>
          <div className="option-request-chips">
            {presets.map((p) => (
              <button
                key={p.value}
                type="button"
                className={"option-chip" + (shownAmount === p.value ? " active" : "")}
                onClick={() => commit(p.value)}
              >
                {p.label ?? formatCurrency(p.value)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="option-request option-request-na">
          Combined eligible share falls below the {formatCurrency(data.minLoanAmount)} minimum
          advance, so this option can't be drawn down on its own.
        </div>
      )}

      <button
        type="button"
        className={"option-select-btn" + (selected ? " selected" : "")}
        disabled={!usable}
        onClick={() => setSelected((s) => !s)}
      >
        {selected ? "✓ Selected" : "Select Option"}
      </button>
    </div>
  );
}

function OptionsExplainer({ data, borrowerIds, nameOf }) {
  const explanation = explainOptionGeneration(data, borrowerIds);
  const borrowerNames = explanation.borrowerIds.map(nameOf);
  const componentLabel = (c) => c.pools.map((p) => p.name).join(" + ");
  const isIn = (option, component) =>
    component.pools.every((p) => option.activePools.some((ap) => ap.id === p.id));

  return (
    <div className="debug-explain">
      <div className="debug-explain-heading">
        Why {explanation.options.length} option{explanation.options.length === 1 ? "" : "s"} for{" "}
        {borrowerNames.join(" & ")}?
      </div>
      <p className="debug-note">
        Step by step: check every share each affected person is part of, one person and one
        share at a time. Anyone found in one of those shares becomes affected too. Once a round
        of checking turns up no one new, the cascade for option 1 is complete — only then does it
        check the rest of the estate for shares that never touched anyone affected at all.
      </p>

      <div className="debug-step-title">Option 1 — the minimum required group</div>
      <ol className="debug-waves">
        <li className="debug-wave">
          <div className="debug-step-title">
            Round 0 — Borrower{borrowerNames.length > 1 ? "s" : ""} taking the loan
          </div>
          <div className="debug-wave-members">{borrowerNames.join(", ")}</div>
        </li>

        {explanation.rounds.map((round, i) => (
          <li key={i} className="debug-wave">
            <div className="debug-step-title">
              Round {i + 1} — check every share each person from round {i} is part of
            </div>

            <div className="debug-person-checks">
              {round.personChecks.map((pc) => (
                <div key={pc.personId} className="debug-person-check">
                  <div className="debug-person-check-name">
                    Checking {nameOf(pc.personId)}'s shares
                  </div>
                  {pc.poolChecks.length === 0 ? (
                    <p className="debug-note">Not part of any bank account or house.</p>
                  ) : (
                    <ul className="debug-pool-trace">
                      {pc.poolChecks.map((pcheck) => (
                        <li key={pcheck.pool.id}>
                          <span className="debug-trace-pool">
                            {pcheck.pool.icon} {pcheck.pool.name}
                            {pcheck.alreadyChecked && (
                              <span className="debug-already-tag">already checked</span>
                            )}
                          </span>
                          <span className="debug-trace-detail">
                            members: {pcheck.pool.ownerIds.map(nameOf).join(", ")} —{" "}
                            {pcheck.alreadyChecked
                              ? "seen before, skipping"
                              : pcheck.newMemberIds.length > 0
                                ? `newly affected: ${pcheck.newMemberIds.map(nameOf).join(", ")}`
                                : "everyone here is already affected"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>

            <div className="debug-wave-members">
              Newly affected after this round:{" "}
              <strong>
                {round.newlyAffectedIds.length > 0
                  ? round.newlyAffectedIds.map(nameOf).join(", ")
                  : "no one — cascade complete"}
              </strong>
            </div>
          </li>
        ))}
      </ol>

      <div className="debug-forced-summary">
        Option 1 required consent:{" "}
        <strong>
          {explanation.consenterIds.length > 0
            ? explanation.consenterIds.map(nameOf).join(", ")
            : "no one — the borrower(s) don't share any bank account or house with anyone else"}
        </strong>
      </div>

      {explanation.extraComponents.length > 0 && (
        <>
          <div className="debug-step-title" style={{ marginTop: 14 }}>
            No further shares touch anyone affected — checking the rest of the estate for shares
            that don't involve any affected beneficiary at all. Each one found (whether it's a
            single sole-owned account or a whole cluster of shared ones) is a separate, optional
            add-on.
          </div>
          <ul className="debug-pool-trace">
            {explanation.extraComponents.map((c, i) => (
              <li key={i}>
                <span className="debug-trace-pool">{componentLabel(c)}</span>
                <span className="debug-trace-detail">
                  members: {[...c.beneficiaryIds].map(nameOf).join(", ")}
                </span>
              </li>
            ))}
          </ul>

          <div className="debug-matrix-wrap">
            <div className="debug-matrix-heading">Which add-ons make up each option</div>
            <table className="debug-matrix">
              <thead>
                <tr>
                  <th>Option</th>
                  {explanation.extraComponents.map((c, i) => (
                    <th key={i} title={componentLabel(c)}>
                      {c.pools.map((p) => p.icon).join("")}
                    </th>
                  ))}
                  <th>Consents</th>
                </tr>
              </thead>
              <tbody>
                {explanation.options.map((opt, i) => (
                  <tr key={opt.id}>
                    <td className="debug-matrix-optlabel">Option {i + 1}</td>
                    {explanation.extraComponents.map((c, ci) => (
                      <td key={ci} className={isIn(opt, c) ? "on" : "off"}>
                        {isIn(opt, c) ? "✓" : "—"}
                      </td>
                    ))}
                    <td className="debug-matrix-optlabel">{opt.consenterIds.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function DebugPanel({ data, borrowerIds = [] }) {
  const { pools, multiPool } = getPoolsDebugInfo(data);
  const nameOf = (id) => data.beneficiaries.find((b) => b.id === id)?.name ?? id;
  const assignedDebtIds = new Set(pools.flatMap((p) => p.liabilities.map((d) => d.id)));
  const unassignedDebts = (data.estate?.debts || []).filter((d) => !assignedDebtIds.has(d.id));

  return (
    <details className="debug-panel">
      <summary>
        <span className="debug-badge">DEBUG</span>
        Shares &amp; pool membership preview
      </summary>
      <p className="debug-note">
        Internal preview only — raw pool data used to build the options above. Not part of the
        production UI.
      </p>

      {borrowerIds.length > 0 && (
        <OptionsExplainer data={data} borrowerIds={borrowerIds} nameOf={nameOf} />
      )}

      <p className="debug-note">
        Real & leasehold property, financial assets, and debts belong to the deceased, not to any
        beneficiary — they're flat estate records. A pool is what explicitly assigns beneficiaries
        and estate items together (mirroring <code>ManualPool</code>); its net value is only then
        divided evenly across its members.
      </p>

      <div className="debug-pools-heading">All pools in this estate</div>
      <div className="debug-pools">
        {pools.map((p) => (
          <div key={p.id} className="debug-pool">
            <div className="debug-pool-heading">
              <span>{p.icon}</span>
              <span>{p.name}</span>
              <span className="debug-pool-kind">{p.kind}</span>
            </div>

            <div className="debug-pool-sub-label">Beneficiaries</div>
            <ul className="debug-pool-members">
              {p.members.map((m) => (
                <li key={m.beneficiaryId}>
                  {nameOf(m.beneficiaryId)} — {formatCurrency(m.amount)} each
                </li>
              ))}
            </ul>

            <div className="debug-pool-sub-label">Estate assets in this pool</div>
            <ul className="debug-pool-members">
              {p.assets.map((a) => (
                <li key={a.id}>
                  {a.icon} {a.name} — {formatCurrency(a.value)}
                </li>
              ))}
            </ul>

            {p.liabilities.length > 0 && (
              <>
                <div className="debug-pool-sub-label">Liabilities on this pool</div>
                <ul className="debug-pool-members">
                  {p.liabilities.map((d) => (
                    <li key={d.id}>
                      {d.creditor} — {formatCurrency(d.value)}
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="debug-pool-net">
              {formatCurrency(p.assetsTotal)}
              {p.liabilitiesTotal > 0 && ` − ${formatCurrency(p.liabilitiesTotal)} debts`} ={" "}
              <strong>{formatCurrency(p.netValue)} net</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="debug-multi">
        <div className="debug-multi-heading">Beneficiaries in more than one pool</div>
        {multiPool.length === 0 ? (
          <p className="debug-note">No beneficiary sits in more than one pool in this estate.</p>
        ) : (
          <ul>
            {multiPool.map((entry) => (
              <li key={entry.beneficiaryId}>
                <strong>{nameOf(entry.beneficiaryId)}</strong> is in{" "}
                {entry.pools.map((p) => `${p.icon} ${p.name}`).join(", ")}
              </li>
            ))}
          </ul>
        )}
      </div>

      {unassignedDebts.length > 0 && (
        <div className="debug-multi">
          <div className="debug-multi-heading">
            Unassigned estate debts — not tied to any pool, so not deducted anywhere
          </div>
          <ul className="debug-pool-trace">
            {unassignedDebts.map((d) => (
              <li key={d.id}>
                <span className="debug-trace-pool">{d.creditor}</span>
                <span className="debug-trace-detail">
                  {d.description} — {formatCurrency(d.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.estate?.otherAssets?.length > 0 && (
        <div className="debug-multi">
          <div className="debug-multi-heading">
            Other estate assets — not eligible for this loan
          </div>
          <p className="debug-note">
            Not <code>is_main</code> + <code>lendable</code> in the real system (vehicles,
            contents, securities, business assets, etc.) — deceased-owned estate records like
            everything above, but never referenced by any pool, so never counted toward any
            beneficiary's total or any option.
          </p>
          <ul className="debug-pool-trace">
            {data.estate.otherAssets.map((a) => (
              <li key={a.id}>
                <span className="debug-trace-pool">
                  {a.category}: {a.description}
                </span>
                <span className="debug-trace-detail">{formatCurrency(a.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

export default function OptionsView({ scenario, selectedBorrowers }) {
  const { data } = scenario;
  const borrowerIds = [...selectedBorrowers];

  if (borrowerIds.length === 0) {
    return (
      <div className="options-view">
        <div className="options-empty">
          <p>
            Select one or more beneficiaries above as the borrower(s) to see the loan options
            available to them.
          </p>
        </div>
        <DebugPanel data={data} />
      </div>
    );
  }

  const options = generateLoanOptions(data, borrowerIds);

  return (
    <div className="options-view">
      <div className="options-heading">
        <h2>Available Loan Options</h2>
        <p>
          Option 1 is the minimum required group: who's actually taking out the loan, and who
          else must consent because their money is connected to it. If the estate holds other
          money that's completely unrelated to that group, each combination of also drawing on
          it becomes its own option — bigger loan, more consents needed. These are informational
          previews, not a selection — nothing here feeds a calculation.
        </p>
      </div>

      <div className={"options-grid" + (options.length === 1 ? " single" : "")}>
        {options.map((opt, i) => (
          <OptionCard key={opt.id} data={data} option={opt} index={i} />
        ))}
      </div>

      <DebugPanel data={data} borrowerIds={borrowerIds} />
    </div>
  );
}
