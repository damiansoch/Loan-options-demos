export function formatCurrency(value) {
  return "€" + Math.round(value).toLocaleString("en-IE");
}

// Whether a shared asset's value is counted in the loan — a deliberate,
// independent decision (see toggleAsset in useScenario), not something
// derived from which beneficiaries happen to be selected. A jointly-owned
// house might be financed on its own while none of its owners' individual
// shares are in the loan, or the other way around — the two are separate
// choices in real cases, so the UI keeps them separate too.
export function isAssetIncluded(asset, includedAssetIds) {
  return includedAssetIds.has(asset.id);
}

// Shown wherever a shared asset is offered for inclusion — states the
// actual eligibility criterion plainly rather than a vague reassurance.
export const ASSET_ELIGIBILITY_NOTE = "Not a family home, and not currently occupied.";

// Shared assets get their own deep, muted palette (distinct from the vivid
// beneficiary colors) so a glance tells "person" from "property" by hue
// family alone — and cycling through it gives each house in a multi-house
// scenario its own identity instead of every one rendering identically.
const ASSET_PALETTE = ["#78350f", "#155e75", "#7c2d12", "#3f6212", "#581c87"];

export function assetColor(index) {
  return ASSET_PALETTE[index % ASSET_PALETTE.length];
}

export function totalEstateValue(scenario) {
  const shares = scenario.beneficiaries.reduce((sum, b) => sum + b.share, 0);
  const assets = scenario.sharedAssets.reduce((sum, a) => sum + a.value, 0);
  return shares + assets;
}

export function qualifiesAlone(beneficiary, scenario) {
  return Math.round(beneficiary.share * scenario.loanToValue) >= scenario.minLoanAmount;
}

// One consistent, self-explanatory label used everywhere a beneficiary's
// standalone eligibility is shown — states the actual minimum rather than
// a vague "needs combining", so it's clear on sight what the bar is.
export function aloneStatusLabel(beneficiary, scenario) {
  return qualifiesAlone(beneficiary, scenario)
    ? "Qualifies alone"
    : `Below ${formatCurrency(scenario.minLoanAmount)} alone`;
}

// One consistent status + click affordance for every shared-asset toggle
// across all 4 views — states both what it is now and what tapping it does.
export function assetStatusLabel(included) {
  return included ? "✓ Included — tap to exclude" : "Tap to include";
}

// Full names, not "owned by" — nobody owns anything yet at this stage,
// they're entitled to inherit it once probate concludes. One shared phrase
// keeps that legally-accurate wording consistent everywhere an asset's
// co-beneficiaries are listed, instead of each view improvising its own
// (previously inconsistent, and wrong either way) version.
export function assetOwnersLabel(asset, beneficiaries) {
  const names = asset.ownerIds
    .map((id) => beneficiaries.find((b) => b.id === id)?.name)
    .filter(Boolean);
  const joined =
    names.length <= 1
      ? (names[0] ?? "")
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Jointly inherited by ${joined}`;
}

// Now that including a beneficiary's own share and including a shared
// asset are independent choices, a house can end up included while only
// some (or none) of its co-owners also have their own share in the loan —
// this makes that partial combination visible instead of silent.
export function assetParticipationLabel(asset, selectedIds) {
  const total = asset.ownerIds.length;
  const count = asset.ownerIds.filter((id) => selectedIds.has(id)).length;
  return `${count} of ${total} co-owners' own shares also included`;
}

export function ownedAssetIcons(beneficiaryId, scenario, includedAssetIds) {
  return scenario.sharedAssets
    .filter((a) => a.ownerIds.includes(beneficiaryId))
    .map((a) => ({ icon: a.icon, included: includedAssetIds.has(a.id) }));
}

export function computeTotals(scenario, selectedIds, includedAssetIds) {
  const selectedShare = scenario.beneficiaries.reduce(
    (sum, b) => (selectedIds.has(b.id) ? sum + b.share : sum),
    0,
  );
  const includedAssets = scenario.sharedAssets.filter((a) => isAssetIncluded(a, includedAssetIds));
  const assetsValue = includedAssets.reduce((sum, a) => sum + a.value, 0);
  const totalValue = selectedShare + assetsValue;
  const maxAdvance = Math.round(totalValue * scenario.loanToValue);
  const hasAnySelection = selectedIds.size > 0 || includedAssets.length > 0;
  const belowMin = hasAnySelection && maxAdvance < scenario.minLoanAmount;
  const usable = !belowMin && maxAdvance >= scenario.minLoanAmount;
  return { selectedShare, includedAssets, assetsValue, totalValue, maxAdvance, belowMin, usable };
}

export function clampRequested(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const PRESET_MIN_GAP = 20000;

// Rounds a value UP to the nearest "nice" number — 1/2/5/10 × a power of
// ten (the same convention chart axes use for tick spacing), so quick-pick
// amounts read as round figures (€200,000, €500,000, €1,000,000) instead of
// arbitrary ones (€230,000, €295,000) once ranges get large.
function niceStepCeil(value) {
  if (value <= 0) return PRESET_MIN_GAP;
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  let niceFraction;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 5) niceFraction = 5;
  else niceFraction = 10;
  return niceFraction * base;
}

// Picks how many quick-pick chips to show (2-5) and what step to space them
// by, rather than forcing fixed 25/50/75% marks — those collapse into
// near-duplicate values when min and max are close together (e.g.
// €100k/€110k), and into arbitrary-looking ones on large ranges. Backs off
// from 5 points down to 2 until the resulting gap clears €20k, then snaps
// that gap up to a nice round step (€100k, €150k, €200k, …) and places
// interior chips on actual multiples of it — so a big range naturally
// settles on fewer, cleaner chips instead of 5 oddly-precise ones. The two
// endpoints are always the exact min/max — never rounded — so a chip's
// label always matches what clicking it actually sets.
export function computeLoanPresets(min, max) {
  if (min >= max) {
    return [{ label: "Max", value: max }];
  }

  const diff = max - min;
  let count = 5;
  while (count > 2 && diff / (count - 1) < PRESET_MIN_GAP) {
    count -= 1;
  }

  if (count === 2) {
    return [
      { label: "Min", value: min },
      { label: "Max", value: max },
    ];
  }

  const niceStep = niceStepCeil(diff / (count - 1));
  const lowerBound = min + PRESET_MIN_GAP;
  const upperBound = max - PRESET_MIN_GAP;

  const interior = [];
  for (
    let v = Math.ceil(lowerBound / niceStep) * niceStep;
    v <= upperBound && interior.length < 3;
    v += niceStep
  ) {
    interior.push(v);
  }

  const values = [min, ...interior, max];

  return values.map((value, i) => ({
    label: i === 0 ? "Min" : i === values.length - 1 ? "Max" : null,
    value,
  }));
}
