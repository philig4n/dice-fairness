// diceFairness.js

import { jStat } from 'jstat';

// Function to calculate statistics for each side
export function calculateStatistics(rolls, diceType, confidenceLevel = 0.95) {
  if (!rolls.length) {
    return [];
  }

  const totalRolls = rolls.length;
  const observedFrequencies = new Array(diceType).fill(0);

  // Count the frequency of each side being rolled
  rolls.forEach((roll) => {
    if (roll > 0 && roll <= diceType) {
      observedFrequencies[roll - 1]++;
    }
  });

  // Z-score critical value for the selected confidence level
  const zScore = jStat.normal.inv(1 - (1 - confidenceLevel) / 2, 0, 1);

  // Calculate statistics for each side
  const statsResults = observedFrequencies.map((count, index) => {
    const side = index + 1;
    const observedProbability = count / totalRolls;
    const expectedProbability = 1 / diceType;
    const variance = observedProbability * (1 - observedProbability);
    const standardDeviation = Math.sqrt(variance);

    // Calculate standard error
    const standardError = Math.sqrt((observedProbability * (1 - observedProbability)) / totalRolls);

    // Confidence interval
    const marginOfError = zScore * standardError;
    const lowerBound = Math.max(0, observedProbability - marginOfError);
    const upperBound = Math.min(1, observedProbability + marginOfError);

    // Z-score for observed vs expected probability
    const z = (observedProbability - expectedProbability) / Math.sqrt((expectedProbability * (1 - expectedProbability)) / totalRolls);

    // Two-tailed p-value for z-score
    const pValue = 2 * (1 - jStat.normal.cdf(Math.abs(z), 0, 1));

    return {
      side,
      observedProbability,
      expectedProbability,
      variance,
      standardDeviation,
      standardError,
      confidenceInterval: {
        lower: lowerBound,
        upper: upperBound,
      },
      zScore: z,
      pValuePerSide: pValue,
    };
  });

  return statsResults;
}

// Helper function to perform Chi-Squared Goodness-of-Fit Test using jStat
export function chiSquaredTest(rolls, diceType) {
  const totalRolls = rolls.length;
  const expectedFrequency = totalRolls / diceType;

  // Observed frequencies
  const observed = new Array(diceType).fill(0);
  rolls.forEach((roll) => {
    if (roll > 0 && roll <= diceType) {
      observed[roll - 1]++;
    }
  });

  // Expected frequencies
  const expected = new Array(diceType).fill(expectedFrequency);

  // Calculate chi-squared statistic
  let chiSquared = 0;
  for (let i = 0; i < diceType; i++) {
    const obs = observed[i];
    const exp = expected[i];
    chiSquared += ((obs - exp) ** 2) / exp;
  }

  const degreesOfFreedom = diceType - 1;

  // Calculate p-value using jStat's chi-squared CDF function
  const pValue = 1 - jStat.chisquare.cdf(chiSquared, degreesOfFreedom);

  return {
    chiSquared,
    degreesOfFreedom,
    pValue,
  };
}

// Function to check if sample size is adequate for chi-squared test
export function isSampleSizeAdequate(rolls, diceType) {
  if (rolls.length === 0) return false;
  const expectedFrequency = rolls.length / diceType;
  return expectedFrequency >= 5;
}
