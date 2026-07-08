// Orders beneficiaries around the wheel so co-owners of the same shared
// asset end up adjacent wherever possible. Without this, a house whose
// owners are scattered around the circle gets a centroid that collapses
// toward the hub — its badge ends up sitting on top of the estate icon
// instead of near its owners. Someone can belong to more than one asset,
// so a perfect layout isn't always possible; this greedily chains each
// beneficiary onto whichever unplaced beneficiary shares the most assets
// with them, which keeps tightly-connected groups together even when
// memberships overlap.
export function clusterBeneficiaries(beneficiaries, sharedAssets) {
  const ids = beneficiaries.map((b) => b.id);
  if (ids.length === 0) return [];

  const weight = {};
  ids.forEach((id) => {
    weight[id] = {};
  });
  sharedAssets.forEach((asset) => {
    const owners = asset.ownerIds.filter((id) => weight[id]);
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const [a, b] = [owners[i], owners[j]];
        weight[a][b] = (weight[a][b] || 0) + 1;
        weight[b][a] = (weight[b][a] || 0) + 1;
      }
    }
  });

  let start = ids[0];
  let bestDegree = -1;
  ids.forEach((id) => {
    const degree = Object.values(weight[id]).reduce((sum, v) => sum + v, 0);
    if (degree > bestDegree) {
      bestDegree = degree;
      start = id;
    }
  });

  const remaining = new Set(ids);
  const order = [start];
  remaining.delete(start);

  while (remaining.size > 0) {
    const last = order[order.length - 1];
    let best = null;
    let bestScore = -1;
    for (const candidate of remaining) {
      const score = weight[last][candidate] || 0;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (bestScore <= 0) {
      // Nothing shares an asset directly with the last-placed beneficiary —
      // fall back to whoever is most connected to the cluster built so far,
      // rather than jumping to an arbitrary unconnected one.
      let fallbackScore = -1;
      for (const candidate of remaining) {
        let score = 0;
        for (const placed of order) score += weight[placed][candidate] || 0;
        if (score > fallbackScore) {
          fallbackScore = score;
          best = candidate;
        }
      }
    }
    order.push(best);
    remaining.delete(best);
  }

  const byId = Object.fromEntries(beneficiaries.map((b) => [b.id, b]));
  return order.map((id) => byId[id]);
}
