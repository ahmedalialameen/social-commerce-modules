import { calculateTransaction, FeeConfig, FeeType } from '../src/index';

describe('Fee/Commission Calculation Module', () => {

  // 1. Each of the four fee modes individually
  describe('Individual Fee Modes', () => {
    const wholesale = 100;
    const sold = 150; // Gross Profit = 50

    it('should calculate correctly for mode "none"', () => {
      const fee: FeeConfig = {
        name: 'No Fee Service',
        type: 'none',
      };
      const result = calculateTransaction(wholesale, sold, [fee]);

      expect(result.grossProfit).toBe(50);
      expect(result.totalFeesDeducted).toBe(0);
      expect(result.netProfit).toBe(50);
      expect(result.feeBreakdown).toEqual([
        { name: 'No Fee Service', amountDeducted: 0 }
      ]);
    });

    it('should calculate correctly for mode "percentage"', () => {
      const fee: FeeConfig = {
        name: 'Platform Service (10%)',
        type: 'percentage',
        percentageValue: 10,
      };
      const result = calculateTransaction(wholesale, sold, [fee]);

      expect(result.grossProfit).toBe(50);
      expect(result.totalFeesDeducted).toBe(5);
      expect(result.netProfit).toBe(45);
      expect(result.feeBreakdown).toEqual([
        { name: 'Platform Service (10%)', amountDeducted: 5 }
      ]);
    });

    it('should calculate correctly for mode "fixed"', () => {
      const fee: FeeConfig = {
        name: 'Flat Fee Service',
        type: 'fixed',
        fixedValue: 12.50,
      };
      const result = calculateTransaction(wholesale, sold, [fee]);

      expect(result.grossProfit).toBe(50);
      expect(result.totalFeesDeducted).toBe(12.50);
      expect(result.netProfit).toBe(37.50);
      expect(result.feeBreakdown).toEqual([
        { name: 'Flat Fee Service', amountDeducted: 12.50 }
      ]);
    });

    it('should calculate correctly for mode "percentage_and_fixed"', () => {
      const fee: FeeConfig = {
        name: 'Combo Fee Service',
        type: 'percentage_and_fixed',
        percentageValue: 10,
        fixedValue: 5,
      };
      const result = calculateTransaction(wholesale, sold, [fee]);

      // 10% of 50 is 5. Combined with flat 5 is 10.
      expect(result.grossProfit).toBe(50);
      expect(result.totalFeesDeducted).toBe(10);
      expect(result.netProfit).toBe(40);
      expect(result.feeBreakdown).toEqual([
        { name: 'Combo Fee Service', amountDeducted: 10 }
      ]);
    });
  });

  // 2. Multiple simultaneous fees
  describe('Multiple Simultaneous Fees', () => {
    it('should correctly sum and apply multiple distinct fee configurations', () => {
      const wholesale = 200;
      const sold = 300; // Gross Profit = 100
      const fees: FeeConfig[] = [
        {
          name: 'General Platform Fee',
          type: 'percentage',
          percentageValue: 8, // 8% of 100 = 8
        },
        {
          name: 'Cash Collection Premium',
          type: 'fixed',
          fixedValue: 4.50, // Flat 4.50
        },
        {
          name: 'Affiliate Service Commission',
          type: 'percentage_and_fixed',
          percentageValue: 5, // 5% of 100 = 5
          fixedValue: 2, // Flat 2
        }
      ];

      const result = calculateTransaction(wholesale, sold, fees);

      expect(result.grossProfit).toBe(100);
      expect(result.feeBreakdown).toEqual([
        { name: 'General Platform Fee', amountDeducted: 8 },
        { name: 'Cash Collection Premium', amountDeducted: 4.50 },
        { name: 'Affiliate Service Commission', amountDeducted: 7 },
      ]);
      expect(result.totalFeesDeducted).toBe(19.50); // 8 + 4.50 + 7
      expect(result.netProfit).toBe(80.50); // 100 - 19.50
    });
  });

  // 3. Zero fees
  describe('Zero Fees', () => {
    it('should handle empty fee list correctly', () => {
      const result = calculateTransaction(100, 150, []);
      expect(result.grossProfit).toBe(50);
      expect(result.totalFeesDeducted).toBe(0);
      expect(result.netProfit).toBe(50);
      expect(result.feeBreakdown).toEqual([]);
    });
  });

  // 4. Sold price equal to wholesale price (zero gross profit)
  describe('Zero Gross Profit', () => {
    it('should flow through correctly when sold price equals wholesale price', () => {
      const fees: FeeConfig[] = [
        {
          name: 'Platform Commission (15%)',
          type: 'percentage',
          percentageValue: 15, // 15% of 0 = 0
        },
        {
          name: 'Gateway Flat Fee',
          type: 'fixed',
          fixedValue: 2.50, // flat 2.50
        }
      ];

      const result = calculateTransaction(100, 100, fees);

      expect(result.grossProfit).toBe(0);
      expect(result.feeBreakdown).toEqual([
        { name: 'Platform Commission (15%)', amountDeducted: 0 },
        { name: 'Gateway Flat Fee', amountDeducted: 2.50 },
      ]);
      expect(result.totalFeesDeducted).toBe(2.50);
      expect(result.netProfit).toBe(-2.50); // 0 - 2.50
    });
  });

  // 5. Sold price below wholesale price (negative gross profit, flows through)
  describe('Negative Gross Profit Flow-Through', () => {
    it('should calculate and flow negative gross profit through correctly without throwing errors', () => {
      const fees: FeeConfig[] = [
        {
          name: 'Platform Service Fee (10%)',
          type: 'percentage',
          percentageValue: 10, // 10% of -50 = -5
        },
        {
          name: 'Flat Handling Fee',
          type: 'fixed',
          fixedValue: 5, // Flat 5
        }
      ];

      const result = calculateTransaction(150, 100, fees); // Sold price 100 < Wholesale price 150

      expect(result.grossProfit).toBe(-50);
      expect(result.feeBreakdown).toEqual([
        { name: 'Platform Service Fee (10%)', amountDeducted: -5 },
        { name: 'Flat Handling Fee', amountDeducted: 5 },
      ]);
      expect(result.totalFeesDeducted).toBe(0); // -5 + 5 = 0
      expect(result.netProfit).toBe(-50); // -50 - 0 = -50
    });
  });

  // 6. Rounding behavior with repeating decimals
  describe('Rounding Behavior', () => {
    it('should round repeating decimals and floating point anomalies to exactly 2 decimal places', () => {
      const wholesale = 10;
      const sold = 10.3333333333; // Gross profit = 0.3333333333 -> rounds to 0.33

      const fees: FeeConfig[] = [
        {
          name: 'Fractional Percentage Fee',
          type: 'percentage',
          percentageValue: 33.333333333, // 33.333333333% of 0.33 is 0.109999999 -> rounds to 0.11
        },
        {
          name: 'Fractional Fixed Fee',
          type: 'fixed',
          fixedValue: 0.11111111, // rounds to 0.11
        }
      ];

      const result = calculateTransaction(wholesale, sold, fees);

      expect(result.grossProfit).toBe(0.33); // Rounded (10.3333333333 - 10)
      expect(result.feeBreakdown).toEqual([
        { name: 'Fractional Percentage Fee', amountDeducted: 0.11 }, // (0.33 * 33.333333333) / 100 = 0.10999999999 -> rounds to 0.11
        { name: 'Fractional Fixed Fee', amountDeducted: 0.11 }, // 0.11111111 -> rounds to 0.11
      ]);
      expect(result.totalFeesDeducted).toBe(0.22);
      expect(result.netProfit).toBe(0.11); // 0.33 - 0.22 = 0.11
    });

    it('should prevent JS floating-point issues (like 0.1 + 0.2 = 0.30000000000000004) from leaking', () => {
      const wholesale = 0.1;
      const sold = 0.3; // Gross Profit = 0.2

      const fees: FeeConfig[] = [
        {
          name: 'Fee A',
          type: 'fixed',
          fixedValue: 0.1,
        },
        {
          name: 'Fee B',
          type: 'fixed',
          fixedValue: 0.2,
        }
      ];

      const result = calculateTransaction(wholesale, sold, fees);

      expect(result.grossProfit).toBe(0.2);
      expect(result.totalFeesDeducted).toBe(0.3);
      expect(result.netProfit).toBe(-0.1);
    });
  });

  // 7. Rejection of invalid inputs
  describe('Input Validation Failures', () => {
    it('should reject a negative wholesale price', () => {
      expect(() => {
        calculateTransaction(-50, 100, []);
      }).toThrow('Wholesale price cannot be negative.');
    });

    it('should reject a negative sold price', () => {
      expect(() => {
        calculateTransaction(100, -10, []);
      }).toThrow('Sold price cannot be negative.');
    });

    it('should reject invalid fee type strings', () => {
      expect(() => {
        const invalidFee = {
          name: 'Suspicious Fee',
          type: 'some_unsupported_mode' as unknown as FeeType,
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Invalid fee type: "some_unsupported_mode".');
    });

    it('should reject a negative percentage value', () => {
      expect(() => {
        const invalidFee: FeeConfig = {
          name: 'Negative Percentage Fee',
          type: 'percentage',
          percentageValue: -5,
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee "Negative Percentage Fee" has an invalid or negative percentage value.');
    });

    it('should reject a negative fixed value', () => {
      expect(() => {
        const invalidFee: FeeConfig = {
          name: 'Negative Flat Fee',
          type: 'fixed',
          fixedValue: -1.5,
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee "Negative Flat Fee" has an invalid or negative fixed value.');
    });

    it('should reject missing values for specific fee types', () => {
      expect(() => {
        const invalidFee: FeeConfig = {
          name: 'Lacking Percentage',
          type: 'percentage',
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee "Lacking Percentage" is of type "percentage" but has no percentageValue defined.');

      expect(() => {
        const invalidFee: FeeConfig = {
          name: 'Lacking Fixed',
          type: 'fixed',
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee "Lacking Fixed" is of type "fixed" but has no fixedValue defined.');

      expect(() => {
        const invalidFee: FeeConfig = {
          name: 'Lacking Combo Percentage',
          type: 'percentage_and_fixed',
          fixedValue: 10,
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee "Lacking Combo Percentage" is of type "percentage_and_fixed" but is missing percentageValue or fixedValue.');
    });

    it('should reject invalid non-string fee names', () => {
      expect(() => {
        const invalidFee = {
          name: '',
          type: 'none' as FeeType,
        };
        calculateTransaction(100, 150, [invalidFee]);
      }).toThrow('Fee name must be a non-empty string.');
    });
  });
});
