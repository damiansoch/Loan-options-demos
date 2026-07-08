import { useState, useEffect, useCallback, useMemo } from "react";
import { computeTotals, clampRequested } from "../utils/calc";

export function useScenario(file) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [includedAssetIds, setIncludedAssetIds] = useState(new Set());
  const [requestedAmount, setRequestedAmountState] = useState(null);
  const [requestedManuallySet, setRequestedManuallySet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/data/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        return res.json();
      })
      .then((json) => {
        if (cancelled) return;
        setData(json);
        setSelected(new Set(json.defaultSelected || []));
        setIncludedAssetIds(new Set());
        setRequestedAmountState(null);
        setRequestedManuallySet(false);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const totals = useMemo(() => {
    if (!data) return null;
    return computeTotals(data, selected, includedAssetIds);
  }, [data, selected, includedAssetIds]);

  const resolvedRequested = useMemo(() => {
    if (!data || !totals || !totals.usable) return 0;
    return requestedManuallySet
      ? clampRequested(requestedAmount, data.minLoanAmount, totals.maxAdvance)
      : totals.maxAdvance;
  }, [data, totals, requestedAmount, requestedManuallySet]);

  const toggleBeneficiary = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Independent of toggleBeneficiary — whether a shared asset's value is
  // financed is its own decision, not a side effect of selecting its
  // owners. Owners might want the loan against their individual shares
  // only, or against the house only, or both, or neither.
  const toggleAsset = useCallback((asset) => {
    setIncludedAssetIds((prev) => {
      const next = new Set(prev);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.add(asset.id);
      return next;
    });
  }, []);

  const setRequestedAmount = useCallback((value) => {
    setRequestedAmountState(value);
    setRequestedManuallySet(true);
  }, []);

  return {
    data,
    loading,
    error,
    selected,
    includedAssetIds,
    toggleBeneficiary,
    toggleAsset,
    totals,
    requestedAmount: resolvedRequested,
    setRequestedAmount,
  };
}
