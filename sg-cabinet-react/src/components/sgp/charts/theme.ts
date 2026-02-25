export type SgpChartTheme = {
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
    grid: pick(css, '--sgp-chart-grid', 'rgba(0,0,0,.08)'),
    axis: pick(css, '--sgp-chart-axis', 'rgba(0,0,0,.55)'),
  };
}
