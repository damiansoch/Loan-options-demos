// Shared ring-segment arc math — used by the main Donut view and the mini
// option-preview donuts, so both draw an identical "broken wheel" style
// (flat gaps between segments) from the same source instead of two
// hand-rolled copies drifting apart.
export const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180;
  return {
    x: centerX + radius * Math.sin(angleInRadians),
    y: centerY - radius * Math.cos(angleInRadians),
  };
};

export const describeRingSegment = (startAngle, endAngle, outerRadius, innerRadius) => {
  const outerStart = polarToCartesian(50, 50, outerRadius, startAngle);
  const outerEnd = polarToCartesian(50, 50, outerRadius, endAngle);
  const innerEnd = polarToCartesian(50, 50, innerRadius, endAngle);
  const innerStart = polarToCartesian(50, 50, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? "1" : "0";

  return [
    "M",
    outerStart.x,
    outerStart.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    1,
    outerEnd.x,
    outerEnd.y,
    "L",
    innerEnd.x,
    innerEnd.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    0,
    innerStart.x,
    innerStart.y,
    "Z",
  ].join(" ");
};

// Builds gapped ring segments for an arbitrary list of {id, value, color}
// slices — returns each segment's path plus its angular midpoint, so a
// caller can also place a marker/icon on it.
export function buildRingSegments(slices, { outerRadius, innerRadius, gapDeg }) {
  const grandTotal = slices.reduce((sum, s) => sum + s.value, 0);
  let cursor = 0;
  return slices.map((s) => {
    const startDeg = grandTotal > 0 ? (cursor / grandTotal) * 360 : 0;
    cursor += s.value;
    const endDeg = grandTotal > 0 ? (cursor / grandTotal) * 360 : 360;
    const rawLength = Math.max(endDeg - startDeg, 0);
    const appliedGap = Math.min(gapDeg, Math.max(rawLength * 0.36, 0));
    const segStart = startDeg + appliedGap / 2;
    const segEnd = endDeg - appliedGap / 2;
    return {
      ...s,
      d: describeRingSegment(segStart, segEnd, outerRadius, innerRadius),
      midDeg: (startDeg + endDeg) / 2,
    };
  });
}
