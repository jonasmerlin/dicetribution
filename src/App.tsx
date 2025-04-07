/**
 * Component to display how a custom modifier affects the probability of meeting a target.
 */
function ModifierImpactDisplay({
  distribution,
  targetValue,
  modifier,
}: {
  distribution: ReturnType<typeof calculateDiceDistribution>;
  targetValue: number;
  modifier: number;
}) {
  if (distribution.totalCombinations === 0) {
    return null;
  }

  const { impact, newTarget } = calculateModifierImpact(
    distribution,
    targetValue,
    modifier,
  );
  const sums = Array.from(distribution.combinations.keys()).sort(
    (a, b) => a - b,
  );
  const minSum = sums[0];
  const maxSum = sums[sums.length - 1];

  // Check if the new target is at the edge of the possible range
  const atEdge = newTarget === minSum || newTarget === maxSum;
  const baseProbs = calculateCumulativeProbabilities(distribution, targetValue);

  // Format percentage with +/- sign
  const formatPercentage = (value: number) => {
    const sign = value > 0 ? "+" : "";
    return `${sign}${(value * 100).toFixed(1)}%`;
  };

  // The sign of the modifier for display purposes
  const modifierSign = modifier >= 0 ? "+" : "";
  const modifierColor = modifier >= 0 ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <h3 className="text-sm font-medium text-gray-700 mb-3">
        Impact of Modifier
      </h3>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 p-4 rounded-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className={`font-medium text-lg ${modifierColor}`}>
              {modifierSign}
              {modifier}
            </span>
            <span className="ml-2 text-gray-700">to Roll</span>
          </div>

          {atEdge && (
            <span className="text-xs px-2 py-1 bg-gray-200 rounded-full text-gray-600">
              {newTarget === minSum ? "At Minimum" : "At Maximum"}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`p-3 rounded-md ${atEdge ? "bg-gray-100" : "bg-white shadow-sm"}`}
          >
            <p className="text-xs uppercase text-gray-500 mb-1">
              Roll ≥ {targetValue}
            </p>
            <p
              className={`text-xl font-light ${
                atEdge
                  ? "text-gray-400"
                  : impact.atLeast > 0
                    ? "text-emerald-600"
                    : impact.atLeast < 0
                      ? "text-rose-600"
                      : "text-gray-500"
              }`}
            >
              {atEdge && impact.atLeast === 0
                ? "No Change"
                : formatPercentage(impact.atLeast)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {atEdge && impact.atLeast === 0
                ? `Already at ${newTarget === minSum ? "minimum" : "maximum"}`
                : `New: ${((baseProbs.atLeast + impact.atLeast) * 100).toFixed(1)}%`}
            </p>
          </div>

          <div
            className={`p-3 rounded-md ${atEdge ? "bg-gray-100" : "bg-white shadow-sm"}`}
          >
            <p className="text-xs uppercase text-gray-500 mb-1">
              Roll = {targetValue}
            </p>
            <p
              className={`text-xl font-light ${
                impact.exactly === baseProbs.exactly
                  ? "text-gray-500"
                  : impact.exactly > baseProbs.exactly
                    ? "text-emerald-600"
                    : "text-rose-600"
              }`}
            >
              {formatPercentage(impact.exactly - baseProbs.exactly)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              New: {(impact.exactly * 100).toFixed(1)}%
            </p>
          </div>

          <div
            className={`p-3 rounded-md ${atEdge ? "bg-gray-100" : "bg-white shadow-sm"}`}
          >
            <p className="text-xs uppercase text-gray-500 mb-1">
              Effective Target
            </p>
            <p className="text-xl font-light text-indigo-600">
              {targetValue - modifier}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              (Target {targetValue} {modifierSign} Modifier {Math.abs(modifier)}
              )
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} /**
 * Calculates cumulative probabilities - the chance of rolling at least or at most a certain value.
 *
 * @param distribution The dice distribution data
 * @param target The target number to calculate probabilities for
 * @returns Object containing probabilities for rolling above, below, or exactly the target
 */
function calculateCumulativeProbabilities(
  distribution: ReturnType<typeof calculateDiceDistribution>,
  target: number,
) {
  if (distribution.totalCombinations === 0) {
    return { atLeast: 0, atMost: 0, exactly: 0 };
  }

  const sums = Array.from(distribution.combinations.keys()).sort(
    (a, b) => a - b,
  );

  let exactlyCount = distribution.combinations.get(target) || 0;
  let atLeastCount = 0;
  let atMostCount = 0;

  // Calculate cumulative counts
  for (const sum of sums) {
    const count = distribution.combinations.get(sum) || 0;
    if (sum >= target) atLeastCount += count;
    if (sum <= target) atMostCount += count;
  }

  // Convert to probabilities
  return {
    atLeast: atLeastCount / distribution.totalCombinations,
    atMost: atMostCount / distribution.totalCombinations,
    exactly: exactlyCount / distribution.totalCombinations,
  };
}
import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/**
 * Calculates the probability distribution for dice rolls.
 *
 * This function takes an array of dice (represented by their number of sides)
 * and calculates the complete distribution of possible sums. For each possible
 * sum, it determines how many combinations produce that sum and the probability
 * of rolling that sum.
 *
 * The implementation uses a dynamic programming approach, building the distribution
 * one die at a time. For each new die added, we calculate all possible outcomes
 * by considering how the new die's values affect our existing distribution.
 * This avoids the exponential complexity of generating every possible combination.
 *
 * @param dice An array of integers where each value represents the number of sides on a die
 * @returns An object containing the distribution data
 */
function calculateDiceDistribution(dice: number[]): {
  combinations: Map<number, number>;
  probabilities: Map<number, number>;
  totalCombinations: number;
} {
  // Handle empty input case
  if (dice.length === 0) {
    return {
      combinations: new Map(),
      probabilities: new Map(),
      totalCombinations: 0,
    };
  }

  // Initialize distribution with the first die
  // For a single die with n sides, each face (1 to n) appears exactly once
  let distributionMap = new Map<number, number>();
  for (let face = 1; face <= dice[0]; face++) {
    distributionMap.set(face, 1);
  }

  // Build the distribution by adding one die at a time
  // This is much more efficient than generating all combinations directly
  for (let dieIndex = 1; dieIndex < dice.length; dieIndex++) {
    const sides = dice[dieIndex];
    const newDistribution = new Map<number, number>();

    // For each existing sum in our current distribution...
    for (const [currentSum, currentCount] of distributionMap.entries()) {
      // ...add each possible value of the new die
      for (let face = 1; face <= sides; face++) {
        const newSum = currentSum + face;
        // Update the count for this sum by adding the count from the previous distribution
        newDistribution.set(
          newSum,
          (newDistribution.get(newSum) || 0) + currentCount,
        );
      }
    }

    // Replace the old distribution with the new one
    distributionMap = newDistribution;
  }

  // Calculate the total number of possible combinations
  // This equals the product of the number of sides on each die
  const totalCombinations = dice.reduce((product, sides) => product * sides, 1);

  // Calculate the probability for each sum
  const probabilitiesMap = new Map<number, number>();
  for (const [sum, count] of distributionMap.entries()) {
    probabilitiesMap.set(sum, count / totalCombinations);
  }

  return {
    combinations: distributionMap,
    probabilities: probabilitiesMap,
    totalCombinations,
  };
}

/**
 * Converts the dice distribution to a format usable by Recharts.
 *
 * @param distribution The distribution object from calculateDiceDistribution
 * @returns An array of objects suitable for chart rendering
 */
function distributionToChartData(
  distribution: ReturnType<typeof calculateDiceDistribution>,
  targetValue: number,
): any[] {
  if (distribution.totalCombinations === 0) return [];

  const chartData: any[] = [];
  const sums = Array.from(distribution.combinations.keys()).sort(
    (a, b) => a - b,
  );

  for (const sum of sums) {
    const count = distribution.combinations.get(sum) || 0;
    const probability = distribution.probabilities.get(sum) || 0;
    const percentage = (probability * 100).toFixed(2);

    chartData.push({
      sum,
      count,
      probability: parseFloat(percentage),
      tooltipLabel: `${count}/${distribution.totalCombinations} (${percentage}%)`,
      fill: sum === targetValue ? "#FBBF24" : "#4F46E5",
    });
  }

  return chartData;
}

/**
 * Represents a single die in the UI with controls for its number of sides.
 */
function DieInput({
  index,
  sides,
  onChange,
  onRemove,
}: {
  index: number;
  sides: number;
  onChange: (index: number, sides: number) => void;
  onRemove: (index: number) => void;
}) {
  // Common die types for quick selection
  const commonDice = [4, 6, 8, 10, 12, 20, 100];

  return (
    <div className="flex items-center mb-3 p-3 bg-gray-50 rounded-lg shadow-sm transition-all">
      <div className="mr-2 font-medium text-gray-700">d</div>
      <input
        type="number"
        min="1"
        value={sides}
        onChange={(e) =>
          onChange(index, Math.max(1, parseInt(e.target.value) || 1))
        }
        className="w-16 px-3 py-2 border-0 bg-white rounded-md shadow-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none transition-all"
      />
      <div className="flex space-x-1 ml-3">
        {commonDice.map((d) => (
          <button
            key={d}
            onClick={() => onChange(index, d)}
            className={`px-2 py-1 text-xs rounded-md transition-all ${
              sides === d
                ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm"
                : "bg-white text-gray-700 shadow-sm hover:bg-gray-100"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
      <button
        onClick={() => onRemove(index)}
        className="ml-auto p-2 text-gray-500 hover:text-red-500 rounded-full transition-colors"
        title="Remove die"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Calculates how probabilities change when applying a custom modifier to the dice roll.
 *
 * @param distribution The dice distribution data
 * @param targetValue The target number to calculate probabilities for
 * @param modifier The modifier to apply to the roll
 * @returns Object containing probability shifts for the modifier
 */
function calculateModifierImpact(
  distribution: ReturnType<typeof calculateDiceDistribution>,
  targetValue: number,
  modifier: number,
) {
  if (distribution.totalCombinations === 0) {
    return {
      impact: { atLeast: 0, atMost: 0, exactly: 0 },
      newTarget: targetValue,
    };
  }

  const sums = Array.from(distribution.combinations.keys()).sort(
    (a, b) => a - b,
  );
  const minSum = sums[0];
  const maxSum = sums[sums.length - 1];

  // Base probabilities for the current target
  const baseProbs = calculateCumulativeProbabilities(distribution, targetValue);

  // Calculate probabilities if we had the modifier to the roll
  // A positive modifier to a roll is equivalent to reducing the target by that amount
  const newTarget = Math.max(minSum, Math.min(maxSum, targetValue - modifier));
  const newProbs = calculateCumulativeProbabilities(distribution, newTarget);

  return {
    impact: {
      atLeast: newProbs.atLeast - baseProbs.atLeast,
      atMost: newProbs.atMost - baseProbs.atMost,
      exactly: newProbs.exactly,
    },
    newTarget,
  };
}

/**
 * Table component displaying the detailed distribution data.
 */
function DistributionTable({
  distribution,
  targetValue,
}: {
  distribution: ReturnType<typeof calculateDiceDistribution>;
  targetValue: number;
}) {
  if (distribution.totalCombinations === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        Add dice to see distribution
      </div>
    );
  }

  const sums = Array.from(distribution.combinations.keys()).sort(
    (a, b) => a - b,
  );

  return (
    <div className="overflow-auto mt-6 rounded-lg shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead>
          <tr>
            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sum
            </th>
            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Combinations
            </th>
            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Probability
            </th>
            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cumulative ≤
            </th>
            <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cumulative ≥
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sums.map((sum) => {
            const count = distribution.combinations.get(sum) || 0;
            const probability = distribution.probabilities.get(sum) || 0;
            const percentage = (probability * 100).toFixed(2);

            // Calculate cumulative probabilities for this sum
            const cumulativeLower = sums
              .filter((s) => s <= sum)
              .reduce(
                (acc, s) => acc + (distribution.probabilities.get(s) || 0),
                0,
              );

            const cumulativeHigher = sums
              .filter((s) => s >= sum)
              .reduce(
                (acc, s) => acc + (distribution.probabilities.get(s) || 0),
                0,
              );

            return (
              <tr
                key={sum}
                className={`transition-colors ${sum === targetValue ? "bg-yellow-50" : "hover:bg-gray-50"}`}
              >
                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                  {sum}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {count} / {distribution.totalCombinations}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    <div
                      className="h-2 mr-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                      style={{ width: `${Math.max(percentage * 3, 4)}px` }}
                    ></div>
                    <span className="text-gray-700">{percentage}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-green-600">
                  {(cumulativeLower * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-sm text-indigo-600">
                  {(cumulativeHigher * 100).toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The main dice distribution calculator application.
 *
 * This component provides a user interface for:
 * 1. Adding/removing dice of various types
 * 2. Calculating the probability distribution
 * 3. Visualizing the results as both a table and chart
 *
 * The chart visually shows where the high probability outcomes are,
 * while the table provides exact numerical values.
 */
function DiceDistributionCalculator() {
  // State for the collection of dice
  const [dice, setDice] = useState<number[]>([6, 6]); // Default to 2d6

  // State for the calculated distribution
  const [distribution, setDistribution] = useState<
    ReturnType<typeof calculateDiceDistribution>
  >({
    combinations: new Map(),
    probabilities: new Map(),
    totalCombinations: 0,
  });

  // Chart data derived from the distribution
  const [chartData, setChartData] = useState<any[]>([]);

  // Target value for calculating probabilities of rolling over/under
  const [targetValue, setTargetValue] = useState<number>(7); // Default to 7 for 2d6

  // Custom modifier value
  const [modifier, setModifier] = useState<number>(1); // Default to +1

  // Update distribution whenever dice change
  useEffect(() => {
    const newDistribution = calculateDiceDistribution(dice);
    setDistribution(newDistribution);
    setChartData(distributionToChartData(newDistribution, targetValue));
  }, [dice]);

  // Update chart data when target value changes
  useEffect(() => {
    setChartData(distributionToChartData(distribution, targetValue));
  }, [targetValue, distribution]);

  // Handler for adding a new die
  const addDie = (sides: number = 6) => {
    setDice([...dice, sides]);
  };

  // Handler for removing a die
  const removeDie = (index: number) => {
    setDice(dice.filter((_, i) => i !== index));
  };

  // Handler for changing a die's sides
  const changeDieSides = (index: number, sides: number) => {
    const newDice = [...dice];
    newDice[index] = sides;
    setDice(newDice);
  };

  // Find the most likely outcome(s) for highlighting
  const findMostLikelyOutcomes = () => {
    if (chartData.length === 0) return [];

    const maxProbability = Math.max(...chartData.map((d) => d.probability));
    return chartData
      .filter((d) => d.probability === maxProbability)
      .map((d) => d.sum);
  };

  const mostLikelyOutcomes = findMostLikelyOutcomes();

  // Format the dice collection as a string (e.g., "2d6 + 1d8")
  const formatDiceNotation = () => {
    const diceCounts = new Map<number, number>();
    dice.forEach((sides) => {
      diceCounts.set(sides, (diceCounts.get(sides) || 0) + 1);
    });

    return Array.from(diceCounts.entries())
      .map(([sides, count]) => `${count}d${sides}`)
      .join(" + ");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-light mb-6 text-gray-800 border-b pb-3">
        Dicetribution
      </h1>

      {/* Dice configuration section */}
      <div className="mb-8 p-6 rounded-lg bg-white shadow-sm">
        <h2 className="text-xl font-light mb-4 text-gray-700">
          Dice Configuration
        </h2>
        <div className="mb-4">
          {dice.map((sides, index) => (
            <DieInput
              key={index}
              index={index}
              sides={sides}
              onChange={changeDieSides}
              onRemove={removeDie}
            />
          ))}
        </div>
        <button
          onClick={() => addDie()}
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-md shadow-sm hover:from-indigo-600 hover:to-purple-600 transition-all"
        >
          Add Die
        </button>
      </div>

      {/* Settings section */}
      <div className="mb-8 p-6 rounded-lg bg-white shadow-sm">
        <h2 className="text-xl font-light mb-4 text-gray-700">
          Analysis Settings
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Value:
            </label>
            <input
              type="number"
              min={
                distribution.totalCombinations > 0
                  ? Math.min(...Array.from(distribution.combinations.keys()))
                  : 1
              }
              max={
                distribution.totalCombinations > 0
                  ? Math.max(...Array.from(distribution.combinations.keys()))
                  : 12
              }
              value={targetValue}
              onChange={(e) => setTargetValue(parseInt(e.target.value) || 7)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              The value you need to roll
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Roll Modifier:
            </label>
            <input
              type="number"
              value={modifier}
              onChange={(e) => setModifier(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none"
            />
            <p className="mt-1 text-sm text-gray-500">
              Bonus or penalty added to your roll
            </p>
          </div>
        </div>
      </div>

      {/* Results section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 border-b pb-2">
          Distribution for {formatDiceNotation()}
        </h2>

        {/* Show stats about the distribution */}
        {distribution.totalCombinations > 0 && (
          <div className="mb-6 p-6 bg-white rounded-lg shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Total Combinations
                </h3>
                <p className="text-2xl font-light text-gray-800">
                  {distribution.totalCombinations}
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Most Likely
                </h3>
                <p className="text-2xl font-light text-gray-800">
                  {mostLikelyOutcomes.join(", ")}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    (
                    {(
                      (distribution.probabilities.get(mostLikelyOutcomes[0]) ||
                        0) * 100
                    ).toFixed(1)}
                    %)
                  </span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Range
                </h3>
                <p className="text-2xl font-light text-gray-800">
                  {Math.min(...Array.from(distribution.combinations.keys()))} -{" "}
                  {Math.max(...Array.from(distribution.combinations.keys()))}
                </p>
              </div>
            </div>

            {/* Target value selector for probability analysis */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center mb-4">
                <label className="text-sm font-medium text-gray-700 mr-3">
                  Target value:
                </label>
                <input
                  type="number"
                  min={Math.min(
                    ...Array.from(distribution.combinations.keys()),
                  )}
                  max={Math.max(
                    ...Array.from(distribution.combinations.keys()),
                  )}
                  value={targetValue}
                  onChange={(e) =>
                    setTargetValue(parseInt(e.target.value) || 7)
                  }
                  className="w-20 px-3 py-2 border-0 bg-gray-50 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-300 focus:outline-none transition-all"
                />
              </div>

              {(() => {
                const cumulativeProbs = calculateCumulativeProbabilities(
                  distribution,
                  targetValue,
                );
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-4 rounded-lg shadow-sm">
                      <p className="font-medium text-indigo-700 mb-1 text-center">
                        Roll ≥ {targetValue}
                      </p>
                      <p className="text-center text-3xl font-light text-indigo-800">
                        {(cumulativeProbs.atLeast * 100).toFixed(1)}%
                      </p>
                      <p className="text-center text-xs text-indigo-600 mt-1">
                        {Math.round(
                          cumulativeProbs.atLeast *
                            distribution.totalCombinations,
                        )}{" "}
                        of {distribution.totalCombinations} combinations
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 p-4 rounded-lg shadow-sm">
                      <p className="font-medium text-amber-700 mb-1 text-center">
                        Roll = {targetValue}
                      </p>
                      <p className="text-center text-3xl font-light text-amber-800">
                        {(cumulativeProbs.exactly * 100).toFixed(1)}%
                      </p>
                      <p className="text-center text-xs text-amber-600 mt-1">
                        {distribution.combinations.get(targetValue) || 0} of{" "}
                        {distribution.totalCombinations} combinations
                      </p>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg shadow-sm">
                      <p className="font-medium text-emerald-700 mb-1 text-center">
                        Roll ≤ {targetValue}
                      </p>
                      <p className="text-center text-3xl font-light text-emerald-800">
                        {(cumulativeProbs.atMost * 100).toFixed(1)}%
                      </p>
                      <p className="text-center text-xs text-emerald-600 mt-1">
                        {Math.round(
                          cumulativeProbs.atMost *
                            distribution.totalCombinations,
                        )}{" "}
                        of {distribution.totalCombinations} combinations
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modifier impact analysis */}
            <ModifierImpactDisplay
              distribution={distribution}
              targetValue={targetValue}
              modifier={modifier}
            />
          </div>
        )}

        {/* Chart visualization */}
        {chartData.length > 0 && (
          <div className="mb-8 h-72 bg-white p-4 rounded-lg shadow-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="sum"
                  label={{
                    value: "Sum",
                    position: "insideBottom",
                    offset: -10,
                    fill: "#6B7280",
                  }}
                  tick={{ fill: "#6B7280" }}
                />
                <YAxis
                  label={{
                    value: "Probability (%)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#6B7280",
                  }}
                  tick={{ fill: "#6B7280" }}
                />
                <Tooltip
                  formatter={(value: any, name: string) => [
                    `${value}%`,
                    "Probability",
                  ]}
                  labelFormatter={(label) => `Sum: ${label}`}
                  contentStyle={{
                    borderRadius: "8px",
                    boxShadow:
                      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                    border: "none",
                  }}
                />
                <Bar
                  dataKey="probability"
                  name="Probability"
                  radius={[4, 4, 0, 0]}
                  fill="#4F46E5"
                  fillOpacity={0.8}
                  isAnimationActive={true}
                  animationDuration={500}
                  barSize={20}
                  shape={(props: any) => {
                    const { x, y, width, height, fill } = props;
                    const dataItem = chartData[props.index];
                    const barFill =
                      dataItem.sum === targetValue ? "#FBBF24" : "#4F46E5";

                    return (
                      <rect
                        x={x}
                        y={y}
                        width={width}
                        height={height}
                        fill={barFill}
                        rx={4}
                        ry={4}
                      />
                    );
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Full distribution table */}
        <DistributionTable
          distribution={distribution}
          targetValue={targetValue}
        />
      </div>
    </div>
  );
}

export default DiceDistributionCalculator;
