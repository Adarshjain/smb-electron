import { useCallback, useState } from 'react';
import type { MetalType } from '../../tables';
import { errorToast, getDocCharges, getInterest, getRate } from '@/lib/myUtils';
import { DECIMAL_PRECISION } from '@/constants/loanForm';

export interface LoanCalculationOptions {
  loanAmount?: number;
  customInterestRate?: number;
  metalType?: MetalType;
}

export interface LoanCalculationResult {
  interestRate: number;
  firstMonthInterest: number;
  docCharges: number;
  total: number;
}

export interface BillingItem {
  gross_weight: string;
  ignore_weight: string;
  net_weight: string;
  quantity: number;
}

export function useLoanCalculations() {
  const [isCalculating, setIsCalculating] = useState(false);

  /**
   * Calculates loan amounts including interest, doc charges, and total
   * Returns null if calculation fails
   */
  const calculateLoanAmounts = useCallback(
    async (
      currentLoanAmount: number,
      currentMetalType: MetalType,
      options: LoanCalculationOptions = {}
    ): Promise<LoanCalculationResult | null> => {
      try {
        setIsCalculating(true);

        const {
          loanAmount: newLoanAmount,
          customInterestRate,
          metalType: newMetalType,
        } = options;

        const loanAmount = newLoanAmount ?? currentLoanAmount;
        const metalType = newMetalType ?? currentMetalType;

        const rateConfig = await getRate(loanAmount, metalType);
        if (!rateConfig) {
          errorToast(
            'No interest rate configuration found for this amount and metal type'
          );
          return null;
        }

        const interestRate = customInterestRate ?? rateConfig.rate;

        let docCharges = getDocCharges(loanAmount, rateConfig);
        const fmi = getInterest(loanAmount, interestRate);

        // Round the total to avoid decimal cents
        const decimal = (loanAmount - fmi - docCharges) % 1;
        if (decimal < 0.5) {
          docCharges += decimal;
        } else {
          docCharges -= 1 - decimal;
        }

        const total = loanAmount - fmi - docCharges;

        return {
          interestRate: interestRate,
          firstMonthInterest: fmi,
          docCharges: docCharges,
          total: total,
        };
      } catch (error) {
        errorToast(error);
        return null;
      } finally {
        setIsCalculating(false);
      }
    },
    []
  );

  /**
   * Calculates the net weight for a billing item
   */
  const calculateNetWeight = useCallback((item: BillingItem): string => {
    const grossWeight = parseFloat(item.gross_weight || '0');
    const ignoreWeight = parseFloat(item.ignore_weight || '0');
    const netWeight = Math.max(0, grossWeight - ignoreWeight);
    return netWeight.toFixed(DECIMAL_PRECISION);
  }, []);

  /**
   * Calculates total net weight across all billing items
   */
  const calculateTotalNetWeight = useCallback(
    (items: BillingItem[]): string => {
      const total = items.reduce((sum, item) => {
        const netWeight = parseFloat(calculateNetWeight(item) || '0');
        return sum + netWeight;
      }, 0);
      return total.toFixed(DECIMAL_PRECISION);
    },
    [calculateNetWeight]
  );

  /**
   * Calculates total gross weight across all billing items
   */
  const calculateTotalGrossWeight = useCallback(
    (items: BillingItem[]): string => {
      const total = items.reduce((sum, item) => {
        const grossWeight = parseFloat(item.gross_weight || '0');
        return sum + grossWeight;
      }, 0);
      return total.toFixed(DECIMAL_PRECISION);
    },
    []
  );

  /**
   * Recalculates total when doc charges change manually
   */
  const recalculateTotalFromDocCharges = useCallback(
    (
      loanAmount: string,
      firstMonthInterest: string,
      docCharges: number
    ): string => {
      const loan = parseFloat(loanAmount || '0');
      const fmi = parseFloat(firstMonthInterest || '0');
      const total = loan - fmi - docCharges;
      return total.toFixed(DECIMAL_PRECISION);
    },
    []
  );

  return {
    calculateLoanAmounts,
    calculateNetWeight,
    calculateTotalNetWeight,
    calculateTotalGrossWeight,
    recalculateTotalFromDocCharges,
    isCalculating,
  };
}
