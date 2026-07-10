// Real & leasehold property and financial assets belong to the DECEASED —
// they're flat estate records with no beneficiary attached (mirroring
// RealAndLeaseholdProperty / FinancialAsset), same as debts belong to the
// estate, not to any one beneficiary (mirroring IrishDebt). The only place
// beneficiaries get linked to any of this is `data.pools` — an explicit,
// agent-defined grouping (mirroring ManualPool) that says "these people, this
// money, these liabilities". A pool is the unit of co-mingling: touching any
// part of it requires everyone in it to consent, no partial draws. A
// beneficiary can be listed in more than one pool — that's what lets the
// cascade jump from one pool to another.
function resolveAsset(assetId, data) {
  const estate = data.estate || {};
  return (
    (estate.realAndLeaseholdProperty || []).find((a) => a.id === assetId) ||
    (estate.financialAssets || []).find((a) => a.id === assetId)
  );
}

function resolveDebt(debtId, data) {
  return (data.estate?.debts || []).find((d) => d.id === debtId);
}

function getPools(data) {
  return (data.pools || []).map((p) => {
    const assets = (p.lendableAssetIds || []).map((id) => resolveAsset(id, data)).filter(Boolean);
    const liabilities = (p.liabilityIds || []).map((id) => resolveDebt(id, data)).filter(Boolean);
    return {
      id: p.id,
      kind: "pool",
      name: p.name,
      icon: assets.map((a) => a.icon).join("") || "💼",
      ownerIds: p.beneficiaryIds,
      assets,
      liabilities,
    };
  });
}

// A pool's own money, and what's already owed out of it — mirrors how
// PoolManualLiability ties specific debts to specific pools rather than
// deducting them from the whole estate at once.
export function poolAssetsTotal(pool) {
  return pool.assets.reduce((sum, a) => sum + a.value, 0);
}

export function poolLiabilitiesTotal(pool) {
  return pool.liabilities.reduce((sum, d) => sum + d.value, 0);
}

export function poolNetValue(pool) {
  return Math.max(poolAssetsTotal(pool) - poolLiabilitiesTotal(pool), 0);
}

// A beneficiary's total benefit for this view — unlike the other 4 examples,
// there's no separate "share" field here, and there's no per-beneficiary
// split recorded anywhere in the real system either: a pool's net value
// (after its own liabilities) is simply divided evenly across everyone in
// it, the same way a jointly-owned property's value already was.
export function beneficiaryOptionsTotal(beneficiaryId, data) {
  return getPools(data).reduce((sum, pool) => {
    if (!pool.ownerIds.includes(beneficiaryId)) return sum;
    return sum + poolNetValue(pool) / pool.ownerIds.length;
  }, 0);
}

function growReachable(seed, pools) {
  const reach = new Set(seed);
  let changed = true;
  while (changed) {
    changed = false;
    pools.forEach((p) => {
      if (p.ownerIds.some((id) => reach.has(id))) {
        p.ownerIds.forEach((id) => {
          if (!reach.has(id)) {
            reach.add(id);
            changed = true;
          }
        });
      }
    });
  }
  return reach;
}

// Splits a set of pools into their disjoint connected components — groups of
// pools/beneficiaries that touch each other, with zero overlap between
// groups. Used to find money that's completely unrelated to the pools
// already being drawn on, as opposed to a pool that's merely not yet
// visited but still reachable from them.
function partitionPoolsIntoComponents(pools) {
  const components = [];
  const consumed = new Set();

  pools.forEach((seedPool) => {
    if (consumed.has(seedPool.id)) return;
    const remaining = pools.filter((p) => !consumed.has(p.id));
    const beneficiaryIds = growReachable(new Set(seedPool.ownerIds), remaining);
    const componentPools = remaining.filter((p) => p.ownerIds.some((id) => beneficiaryIds.has(id)));
    componentPools.forEach((p) => consumed.add(p.id));
    components.push({ pools: componentPools, beneficiaryIds });
  });

  return components;
}

// Any beneficiary pulled into the loan — whether a borrower or forced in
// because their money sits in a shared pool with someone already affected —
// drags in everyone else in *every* pool they belong to, who then drag in
// everyone in every pool *they* belong to, and so on: a fountain, no partial
// draws within a connected group of shares. That fully determines a single
// "minimum required" option (option 1).
//
// But the estate can also hold other money that's completely separate from
// that group — a different bank account or house with no beneficiary in
// common with anyone already affected. Pulling one of those in is a genuine
// choice (it grows the loan, at the cost of needing that group's consent
// too), and each one it touches cascades fully by the same fountain rule.
// Every combination of "which separate chunks to also pull in" is checked,
// each producing its own option, until every combination has been tried.
export function generateLoanOptions(data, borrowerIds) {
  const borrowerSet = new Set(borrowerIds);
  if (borrowerSet.size === 0) return [];

  const pools = getPools(data);
  const coreReach = growReachable(borrowerSet, pools);
  const corePools = pools.filter((p) => p.ownerIds.some((id) => coreReach.has(id)));
  const remainingPools = pools.filter((p) => !corePools.includes(p));
  const extraComponents = partitionPoolsIntoComponents(remainingPools);

  const results = [];
  const seen = new Set();
  const total = 1 << extraComponents.length;

  for (let mask = 0; mask < total; mask++) {
    const reach = new Set(coreReach);
    const activePools = [...corePools];

    extraComponents.forEach((c, idx) => {
      if (mask & (1 << idx)) {
        c.beneficiaryIds.forEach((id) => reach.add(id));
        activePools.push(...c.pools);
      }
    });

    const consenterIds = [...reach].filter((id) => !borrowerSet.has(id)).sort();
    const key = consenterIds.join(",");
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: `option-${results.length}`,
      borrowerIds: [...borrowerSet],
      consenterIds,
      activePools,
    });
  }

  return results;
}

// Debug-only view of the raw pool structure — every pool, who's in it, what
// estate assets and liabilities feed into it, and its resulting net value
// (evenly divided across its members) — plus a flat list of beneficiaries
// who sit in more than one pool (the people whose consent actually cascades
// between options). Not used by the option-generation algorithm itself;
// this exists purely so the shape of the underlying data can be sanity-
// checked on screen.
export function getPoolsDebugInfo(data) {
  const pools = getPools(data).map((p) => {
    const netValue = poolNetValue(p);
    return {
      ...p,
      assetsTotal: poolAssetsTotal(p),
      liabilitiesTotal: poolLiabilitiesTotal(p),
      netValue,
      members: p.ownerIds.map((id) => ({
        beneficiaryId: id,
        amount: netValue / p.ownerIds.length,
      })),
    };
  });

  const membership = {};
  pools.forEach((p) => {
    p.members.forEach((m) => {
      (membership[m.beneficiaryId] ??= []).push(p);
    });
  });

  const multiPool = Object.entries(membership)
    .filter(([, poolsForId]) => poolsForId.length > 1)
    .map(([beneficiaryId, poolsForId]) => ({ beneficiaryId, pools: poolsForId }));

  return { pools, multiPool };
}

// Debug-only trace of *why* generateLoanOptions produced what it did, for
// the currently-selected borrower(s) — walked one person and one share at a
// time, not just summarized wave-by-wave, so every check the algorithm
// makes is visible on screen. Round 1 checks each borrower's own shares one
// by one, marking everyone found in them as affected. Round 2 then checks
// each of THOSE newly-affected people's shares, one by one — noting which
// shares are brand new versus already checked, and who (if anyone) each one
// adds — and so on, round after round, until a round finds no one new at
// all. Only once the cascade fully stops does it check whether any share in
// the estate never got touched by any of this — those are the separate,
// completely unrelated chunks of money that become optional add-ons, the
// source of every option after the first.
export function explainOptionGeneration(data, borrowerIds) {
  const borrowerSet = new Set(borrowerIds);
  const pools = getPools(data);

  const reach = new Set(borrowerSet);
  const checkedPoolIds = new Set();
  const rounds = [];
  let frontier = [...borrowerSet];

  while (frontier.length > 0) {
    const newlyAffected = new Set();

    const personChecks = frontier.map((personId) => {
      const personPools = pools.filter((p) => p.ownerIds.includes(personId));

      const poolChecks = personPools.map((p) => {
        const alreadyChecked = checkedPoolIds.has(p.id);
        checkedPoolIds.add(p.id);

        const newMemberIds = [];
        p.ownerIds.forEach((id) => {
          if (!reach.has(id) && !newlyAffected.has(id)) {
            newlyAffected.add(id);
            newMemberIds.push(id);
          }
        });

        return { pool: p, alreadyChecked, newMemberIds };
      });

      return { personId, poolChecks };
    });

    newlyAffected.forEach((id) => reach.add(id));
    rounds.push({ personChecks, newlyAffectedIds: [...newlyAffected] });
    frontier = [...newlyAffected];
  }

  const consenterIds = [...reach].filter((id) => !borrowerSet.has(id)).sort();
  const remainingPools = pools.filter((p) => !checkedPoolIds.has(p.id));
  const extraComponents = partitionPoolsIntoComponents(remainingPools);

  return {
    borrowerIds: [...borrowerSet],
    rounds,
    consenterIds,
    extraComponents,
    options: generateLoanOptions(data, borrowerIds),
  };
}
