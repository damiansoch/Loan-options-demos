// Everything in the Options view is derived from "pools" — bank accounts and
// shared assets (houses) alike — each just a group of beneficiary ids whose
// money is co-mingled, so touching any one of them requires everyone in the
// pool to consent. Bank accounts carry their own per-beneficiary allocations;
// a house's value is split evenly across its owners, same as any other
// jointly-held pool — an owner's stake is their own slice of it, not the
// whole property.

// A beneficiary's total benefit for this view — unlike the other 4 examples,
// there's no separate "share" field here: it's rebuilt from whichever bank
// accounts and houses actually pay into it, then summed into one figure.
export function beneficiaryOptionsTotal(beneficiaryId, data) {
  const accountTotal = (data.bankAccounts || []).reduce((sum, acc) => {
    const allocation = acc.allocations.find((a) => a.beneficiaryId === beneficiaryId);
    return sum + (allocation ? allocation.amount : 0);
  }, 0);
  const houseTotal = data.sharedAssets.reduce(
    (sum, asset) =>
      sum + (asset.ownerIds.includes(beneficiaryId) ? asset.value / asset.ownerIds.length : 0),
    0,
  );
  return accountTotal + houseTotal;
}

function getPools(data) {
  const accountPools = (data.bankAccounts || []).map((acc) => ({
    id: acc.id,
    kind: "account",
    name: acc.name,
    icon: acc.icon,
    ownerIds: acc.allocations.map((a) => a.beneficiaryId),
  }));
  const assetPools = data.sharedAssets.map((a) => ({
    id: a.id,
    kind: "asset",
    name: a.name,
    icon: a.icon,
    ownerIds: a.ownerIds,
  }));
  return [...accountPools, ...assetPools];
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

// Debug-only view of the raw pool structure — every bank account and house,
// who's in it and for how much, plus a flat list of beneficiaries who sit in
// more than one pool (the people whose consent actually cascades between
// options). Not used by the option-generation algorithm itself; this exists
// purely so the shape of the underlying data can be sanity-checked on screen.
export function getPoolsDebugInfo(data) {
  const pools = getPools(data).map((p) => ({
    ...p,
    members: p.ownerIds.map((id) => ({
      beneficiaryId: id,
      amount:
        p.kind === "account"
          ? data.bankAccounts.find((acc) => acc.id === p.id).allocations.find(
              (a) => a.beneficiaryId === id,
            ).amount
          : data.sharedAssets.find((a) => a.id === p.id).value / p.ownerIds.length,
    })),
  }));

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
// the currently-selected borrower(s). Two parts: a wave-by-wave trace of
// the mandatory fountain cascade that builds option 1 (wave 1 is whoever's
// pulled in by a pool touching a borrower directly, wave 2 is whoever's
// pulled in by a pool touching someone new from wave 1, and so on until
// nothing new turns up), then the separate, completely unrelated chunks of
// money that are each an optional add-on — the source of every option after
// the first.
export function explainOptionGeneration(data, borrowerIds) {
  const borrowerSet = new Set(borrowerIds);
  const pools = getPools(data);

  const reach = new Set(borrowerSet);
  const waves = [];
  const consumedPoolIds = new Set();
  let frontier = new Set(borrowerSet);

  while (frontier.size > 0) {
    const touchedPools = pools.filter(
      (p) => !consumedPoolIds.has(p.id) && p.ownerIds.some((id) => frontier.has(id)),
    );
    if (touchedPools.length === 0) break;

    const newMembers = new Set();
    touchedPools.forEach((p) => {
      consumedPoolIds.add(p.id);
      p.ownerIds.forEach((id) => {
        if (!reach.has(id)) {
          reach.add(id);
          newMembers.add(id);
        }
      });
    });

    waves.push({ pools: touchedPools, newMemberIds: [...newMembers] });
    frontier = newMembers;
  }

  const consenterIds = [...reach].filter((id) => !borrowerSet.has(id)).sort();
  const remainingPools = pools.filter((p) => !consumedPoolIds.has(p.id));
  const extraComponents = partitionPoolsIntoComponents(remainingPools);

  return {
    borrowerIds: [...borrowerSet],
    waves,
    consenterIds,
    extraComponents,
    options: generateLoanOptions(data, borrowerIds),
  };
}
