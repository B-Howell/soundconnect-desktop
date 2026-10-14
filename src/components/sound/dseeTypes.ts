/**
 * DSEE type names for the upstream `MDR_DSEE_*` ids (libmdr Headphones.h:
 * UNKNOWN 0, STANDARD 1, HX 2, HX_AI 3, ULTIMATE 4), as upstream's
 * `FormatDseeType` names them in client/I18N/Default.cpp ("DSEE", "DSEE HX",
 * "DSEE HX AI", "DSEE ULTIMATE"); Ultimate in Sony's own casing. An unknown
 * id reads plain "DSEE" rather than upstream's "DSEE Unknown".
 */
const dseeNames: Record<number, string> = {
  1: "DSEE",
  2: "DSEE HX",
  3: "DSEE HX AI",
  4: "DSEE Ultimate",
};

export function dseeTypeName(type: number): string {
  return dseeNames[type] ?? "DSEE";
}
