/**
 * Convert back to int[]
 * @param {string} str - The string the int[] encoded as string
 * @return {number[]} the int[] back to numbers, filtered to only valid positive integers
 */
export function convertBackToArray(
  raidLevelNotify: string | undefined,
): number[] {
  if (raidLevelNotify) {
    return raidLevelNotify
      .split(",")
      .map((num) => parseInt(num.trim(), 10))
      .filter((num) => !isNaN(num) && num > 0);
  } else {
    return [];
  }
}

/**
 * Convert number[] to string
 * @param {number[]} arr - The array of numbers to convert
 * @return {string} The numbers joined as a string
 */
export function convertArrayToString(arr: number[]) {
  return arr.join(", ");
}
