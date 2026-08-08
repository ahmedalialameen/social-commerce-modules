/**
 * Supported fee types.
 */
export type FeeType = 'none' | 'percentage' | 'fixed' | 'percentage_and_fixed';

/**
 * Configuration for a single platform fee.
 */
export interface FeeConfig {
  name: string;
  type: FeeType;
  percentageValue?: number;
  fixedValue?: number;
}

/**
 * Detailed breakdown of a fee deducted from a transaction.
 */
export interface FeeBreakdown {
  name: string;
  amountDeducted: number;
}

/**
 * Result of a transaction fee calculation.
 */
export interface TransactionResult {
  grossProfit: number;
  totalFeesDeducted: number;
  netProfit: number;
  feeBreakdown: FeeBreakdown[];
}

/**
 * Helper to round a value to 2 decimal places to avoid floating point artifacts.
 */
function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Validates the inputs for a transaction calculation.
 * Throws an error if any input is invalid.
 */
export function validateInputs(wholesalePrice: number, soldPrice: number, applicableFees: FeeConfig[]): void {
  if (wholesalePrice < 0) {
    throw new Error('Wholesale price cannot be negative.');
  }
  if (soldPrice < 0) {
    throw new Error('Sold price cannot be negative.');
  }

  const validTypes: FeeType[] = ['none', 'percentage', 'fixed', 'percentage_and_fixed'];

  for (const fee of applicableFees) {
    if (!fee.name || typeof fee.name !== 'string') {
      throw new Error('Fee name must be a non-empty string.');
    }
    if (!validTypes.includes(fee.type)) {
      throw new Error(`Invalid fee type: "${fee.type}". Must be one of 'none', 'percentage', 'fixed', 'percentage_and_fixed'.`);
    }
    if (fee.percentageValue !== undefined) {
      if (typeof fee.percentageValue !== 'number' || isNaN(fee.percentageValue) || fee.percentageValue < 0) {
        throw new Error(`Fee "${fee.name}" has an invalid or negative percentage value.`);
      }
    }
    if (fee.fixedValue !== undefined) {
      if (typeof fee.fixedValue !== 'number' || isNaN(fee.fixedValue) || fee.fixedValue < 0) {
        throw new Error(`Fee "${fee.name}" has an invalid or negative fixed value.`);
      }
    }

    // Explicit checks for specific types that require values to be set
    if (fee.type === 'percentage' && fee.percentageValue === undefined) {
      throw new Error(`Fee "${fee.name}" is of type "percentage" but has no percentageValue defined.`);
    }
    if (fee.type === 'fixed' && fee.fixedValue === undefined) {
      throw new Error(`Fee "${fee.name}" is of type "fixed" but has no fixedValue defined.`);
    }
    if (fee.type === 'percentage_and_fixed') {
      if (fee.percentageValue === undefined || fee.fixedValue === undefined) {
        throw new Error(`Fee "${fee.name}" is of type "percentage_and_fixed" but is missing percentageValue or fixedValue.`);
      }
    }
  }
}

/**
 * Core function: Calculates transaction metrics and fees based on wholesale price, sold price, and applicable fees.
 *
 * @param wholesalePrice Price the platform charges for the product
 * @param soldPrice Price the marketer sold the product for
 * @param applicableFees Array of FeeConfig objects
 * @returns TransactionResult with gross profit, total fees, net profit, and fee breakdowns
 */
export function calculateTransaction(
  wholesalePrice: number,
  soldPrice: number,
  applicableFees: FeeConfig[]
): TransactionResult {
  // 1. Validation
  validateInputs(wholesalePrice, soldPrice, applicableFees);

  // 2. Gross profit calculation (sold price - wholesale price)
  const grossProfit = roundToTwoDecimals(soldPrice - wholesalePrice);

  // 3. Process each applicable fee
  const feeBreakdown: FeeBreakdown[] = [];
  let totalFees = 0;

  for (const fee of applicableFees) {
    let amountDeducted = 0;

    switch (fee.type) {
      case 'none':
        amountDeducted = 0;
        break;

      case 'percentage': {
        const percentage = fee.percentageValue ?? 0;
        // Percentage fee is calculated as a percentage of gross profit
        amountDeducted = (grossProfit * percentage) / 100;
        break;
      }

      case 'fixed': {
        amountDeducted = fee.fixedValue ?? 0;
        break;
      }

      case 'percentage_and_fixed': {
        const percentage = fee.percentageValue ?? 0;
        const fixed = fee.fixedValue ?? 0;
        amountDeducted = ((grossProfit * percentage) / 100) + fixed;
        break;
      }

      default:
        // Already handled by validateInputs but safe default
        amountDeducted = 0;
    }

    // Round the individual fee deduction to 2 decimal places to avoid compounding floating-point issues
    const roundedDeduction = roundToTwoDecimals(amountDeducted);
    feeBreakdown.push({
      name: fee.name,
      amountDeducted: roundedDeduction,
    });

    totalFees += roundedDeduction;
  }

  // Round final total fees and compute net profit (gross profit - total fees)
  const finalTotalFees = roundToTwoDecimals(totalFees);
  const netProfit = roundToTwoDecimals(grossProfit - finalTotalFees);

  return {
    grossProfit,
    totalFeesDeducted: finalTotalFees,
    netProfit,
    feeBreakdown,
  };
}
