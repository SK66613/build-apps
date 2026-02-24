export type SgpChartTheme = {
  pos: string;
  neg: string;
  neutral: string;
  grid: string;
  axis: string;
};

function pick(css: CSSStyleDeclaration, name: string, fallback: string) {
  const v = css.getPropertyValue(name).trim();
  return v || fallback;
}

export function sgpChartTheme(): SgpChartTheme {
  const css = getComputedStyle(document.documentElement);

  return {
    pos: pick(css, '--sgp-chart-pos', 'rgba(34,197,94,.65)'),
    neg: pick(css, '--sgp-chart-neg', 'rgba(239,68,68,.55)'),
    neutral: pick(css, '--sgp-chart-neutral', 'rgba(0,0,0,.70)'),
    grid: pick(css, '--sgp-chart-grid', 'rgba(0,0,0,.08)'),
    axis: pick(css, '--sgp-chart-axis', 'rgba(0,0,0,.55)'),
  };
}
