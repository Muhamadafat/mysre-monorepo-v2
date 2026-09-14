/**
 * Utility function to convert a string to Proper Case (Capitalize first letter of each word).
 *
 * @param str - The input string to be formatted.
 * @returns The formatted string in Proper Case.
 */
export const toProperCase = (str: string): string => {
  if (!str) return '';
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  );
};
