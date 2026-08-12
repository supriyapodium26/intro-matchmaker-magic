const display =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

/** ISO2 code -> readable country name, e.g. "NG" -> "Nigeria". */
export function countryName(code: string) {
  if (code.length !== 2) return code;
  try {
    return display?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}
