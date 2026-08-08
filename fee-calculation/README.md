# Fee and Commission Calculation Module

This is a self-contained, high-precision fee and commission calculation module built with TypeScript and Node.js. It features zero dependencies, comprehensive test coverage with Jest, and robust input validation.

---

## Business Logic & Design Choice: Negative Gross Profit

In accordance with our product rules, we do **not** block transactions where the sold price is below the wholesale price (i.e., a sold price below wholesale price is not blocked or rejected).

### Why are negative gross profits allowed to flow through?
1. **Marketer Flexibility and Promotion:** Marketers or sellers may occasionally decide to run loss-leader promotions or liquidate stock where they sell at a loss.
2. **System Accuracy:** Blocking negative gross profits prevents the system from accurately recording true negative balances or losses, which can lead to reporting mismatches and bookkeeping inaccuracies.
3. **Transparent Auditing:** Allowing the negative values to cascade transparently down to the net profit ensures that the platform can correctly calculate negative commissions, debit the marketer's account if necessary, and log the exact transaction economics.

---

## Module exports

### Types and Interfaces

```typescript
export type FeeType = 'none' | 'percentage' | 'fixed' | 'percentage_and_fixed';

export interface FeeConfig {
  name: string;
  type: FeeType;
  percentageValue?: number;
  fixedValue?: number;
}

export interface FeeBreakdown {
  name: string;
  amountDeducted: number;
}

export interface TransactionResult {
  grossProfit: number;
  totalFeesDeducted: number;
  netProfit: number;
  feeBreakdown: FeeBreakdown[];
}
```

### Core Function Signature

```typescript
export function calculateTransaction(
  wholesalePrice: number,
  soldPrice: number,
  applicableFees: FeeConfig[]
): TransactionResult;
```

---

## Worked Numeric Examples

All calculations are rounded to **2 decimal places** at each individual step to avoid floating-point representation bugs (e.g. `19.9999999999`).

### 1. No Fee (`none`)
* **Wholesale Price:** 100.00
* **Sold Price:** 150.00
* **Gross Profit:** 50.00 (150.00 - 100.00)
* **Fee Configuration:**
  ```json
  { "name": "Free tier", "type": "none" }
  ```
* **Calculation:**
  * Deducted: `0.00`
* **Result:**
  * `grossProfit`: 50.00
  * `totalFeesDeducted`: 0.00
  * `netProfit`: 50.00

### 2. Percentage Only (`percentage`)
* **Wholesale Price:** 100.00
* **Sold Price:** 150.00
* **Gross Profit:** 50.00
* **Fee Configuration:**
  ```json
  { "name": "Standard platform fee", "type": "percentage", "percentageValue": 10 }
  ```
* **Calculation:**
  * Deducted: 10% of gross profit (50.00 * 0.10) = `5.00`
* **Result:**
  * `grossProfit`: 50.00
  * `totalFeesDeducted`: 5.00
  * `netProfit`: 45.00

### 3. Fixed Amount Only (`fixed`)
* **Wholesale Price:** 100.00
* **Sold Price:** 150.00
* **Gross Profit:** 50.00
* **Fee Configuration:**
  ```json
  { "name": "Flat payment fee", "type": "fixed", "fixedValue": 12.50 }
  ```
* **Calculation:**
  * Deducted: flat `12.50`
* **Result:**
  * `grossProfit`: 50.00
  * `totalFeesDeducted`: 12.50
  * `netProfit`: 37.50

### 4. Percentage + Fixed Combined (`percentage_and_fixed`)
* **Wholesale Price:** 100.00
* **Sold Price:** 150.00
* **Gross Profit:** 50.00
* **Fee Configuration:**
  ```json
  {
    "name": "Combo processing fee",
    "type": "percentage_and_fixed",
    "percentageValue": 10,
    "fixedValue": 5
  }
  ```
* **Calculation:**
  * Deducted: 10% of gross profit (5.00) + flat (5.00) = `10.00`
* **Result:**
  * `grossProfit`: 50.00
  * `totalFeesDeducted`: 10.00
  * `netProfit`: 40.00

---

## Multiple Simultaneous Fees Example

Multiple fees can be configured and applied to a single transaction simultaneously.

### Input Parameters:
* **Wholesale Price:** `200.00`
* **Sold Price:** `300.00`
* **Gross Profit:** `100.00` (300.00 - 200.00)
* **Applicable Fees (`applicableFees`):**
  ```typescript
  [
    {
      "name": "General Platform Fee",
      "type": "percentage",
      "percentageValue": 8
    },
    {
      "name": "Cash Collection Premium",
      "type": "fixed",
      "fixedValue": 4.50
    },
    {
      "name": "Affiliate Service Commission",
      "type": "percentage_and_fixed",
      "percentageValue": 5,
      "fixedValue": 2.00
    }
  ]
  ```

### Step-by-Step Calculation:
1. **General Platform Fee:** 8% of 100.00 = **8.00**
2. **Cash Collection Premium:** Flat fee = **4.50**
3. **Affiliate Service Commission:** 5% of 100.00 (5.00) + Flat 2.00 = **7.00**

* **Total Fees Deducted:** 8.00 + 4.50 + 7.00 = **19.50**
* **Net Profit:** 100.00 (Gross) - 19.50 (Fees) = **80.50**

### Returned TransactionResult:
```json
{
  "grossProfit": 100.00,
  "totalFeesDeducted": 19.50,
  "netProfit": 80.50,
  "feeBreakdown": [
    { "name": "General Platform Fee", "amountDeducted": 8.00 },
    { "name": "Cash Collection Premium", "amountDeducted": 4.50 },
    { "name": "Affiliate Service Commission", "amountDeducted": 7.00 }
  ]
}
```

---

## Validation & Error Rejections

The library aggressively checks inputs and rejects invalid parameters by throwing standard JS `Error` exceptions:
* **Negative Prices:** Wholesale or sold prices below `0` are rejected immediately.
* **Invalid Fee Types:** Fee types not matching `'none' | 'percentage' | 'fixed' | 'percentage_and_fixed'` throw an error.
* **Negative Fee Values:** Negative percentages (`percentageValue < 0`) or negative flat fees (`fixedValue < 0`) throw an error.
* **Missing values:** For instance, choosing type `'percentage'` without setting a `percentageValue` is blocked.

---

## Development & Usage

### Installing Dependencies
```bash
npm install
```

### Running Tests
```bash
npm test
```

### Building types & JS output
```bash
npm run build
```
