import { createSignal, onCleanup, onMount } from 'solid-js';
import 'bulma/css/bulma.min.css';
import ApexCharts from 'apexcharts';
import { calculateStatistics, chiSquaredTest, isSampleSizeAdequate } from './diceFairness';

function App() {
  const [diceType, setDiceType] = createSignal(6); // Default dice is a d6
  const [rolls, setRolls] = createSignal([]);
  const [statsResults, setStatsResults] = createSignal([]);
  const [chiSquaredResults, setChiSquaredResults] = createSignal(null);
  const [sampleSizeAdequate, setSampleSizeAdequate] = createSignal(false);
  const [pValues, setPValues] = createSignal([]);
  const [confidenceLevel, setConfidenceLevel] = createSignal(0.95); // Default confidence level is 95%
  let probabilityChart;
  let pValueChart;

  // Function to add a roll
  const addRoll = (rollValue) => {
    const newRolls = [...rolls(), rollValue];
    setRolls(newRolls);

    // Update statistics results
    const stats = calculateStatistics(newRolls, diceType(), confidenceLevel());
    setStatsResults(stats);

    // Check if sample size is adequate
    const sampleAdequate = isSampleSizeAdequate(newRolls, diceType());
    setSampleSizeAdequate(sampleAdequate);

    if (sampleAdequate) {
      // Perform Chi-Squared Test
      const chiResults = chiSquaredTest(newRolls, diceType());
      setChiSquaredResults(chiResults);
      setPValues([...pValues(), { x: newRolls.length, y: chiResults.pValue }]);
    } else {
      setChiSquaredResults(null);
      setPValues([...pValues(), { x: newRolls.length, y: null }]);
    }

    // Update the charts
    updateProbabilityChart(stats);
    updatePValueChart();
  };

  // Function to handle dice type change
  const onDiceTypeChange = (type) => {
    setDiceType(type);
    setRolls([]);
    setStatsResults([]);
    setChiSquaredResults(null);
    setSampleSizeAdequate(false);
    setPValues([]);

    // Destroy and reinitialize charts
    if (probabilityChart) {
      probabilityChart.destroy();
      probabilityChart = null;
    }
    if (pValueChart) {
      pValueChart.destroy();
      pValueChart = null;
    }
    initProbabilityChart();
    initPValueChart();
  };

  // Function to handle confidence level change
  const onConfidenceLevelChange = (level) => {
    setConfidenceLevel(level);

    // Recalculate statistics with the new confidence level
    const stats = calculateStatistics(rolls(), diceType(), level);
    setStatsResults(stats);

    // Update the probability chart
    updateProbabilityChart(stats);
  };

  // Initialize the probability chart
  const initProbabilityChart = () => {
    const options = {
      chart: {
        type: 'rangeBar',
        height: 400,
      },
      series: [
        {
          name: 'Probability',
          data: [],
        },
      ],
      xaxis: {
        categories: [],
      },
      title: {
        text: `Probability with Confidence Intervals (${(confidenceLevel() * 100).toFixed(0)}%)`,
        align: 'center',
      },
      yaxis: {
        min: 0,
        max: 1,
        title: {
          text: 'Probability',
        },
      },
      plotOptions: {
        bar: {
          horizontal: false,
        },
      },
    };

    probabilityChart = new ApexCharts(document.querySelector('#probabilityChart'), options);
    probabilityChart.render();
  };

  // Update the probability chart with new data
  const updateProbabilityChart = (stats) => {
    const categories = stats.map((stat) => `Side ${stat.side}`);
    const data = stats.map((stat) => ({
      x: `Side ${stat.side}`,
      y: [stat.confidenceInterval.lower.toFixed(2), stat.confidenceInterval.upper.toFixed(2)],
      probability: stat.observedProbability,
    }));

    probabilityChart.updateOptions({
      xaxis: {
        categories: categories,
      },
      title: {
        text: `Probability with Confidence Intervals (${(confidenceLevel() * 100).toFixed(0)}%)`,
        align: 'center',
      },
      series: [
        {
          name: 'Confidence Interval',
          data: data,
        },
      ],
      tooltip: {
        y: {
          formatter: function (val, opts) {
            const index = opts.dataPointIndex;
            const prob = stats[index].observedProbability.toFixed(2);
            return `Probability: ${prob}`;
          },
        },
      },
    });
  };

  // Initialize the p-value chart
  const initPValueChart = () => {
    const options = {
      chart: {
        type: 'line',
        height: 350,
      },
      series: [
        {
          name: 'P-Value',
          data: [],
        },
      ],
      xaxis: {
        title: { text: 'Number of Rolls' },
        type: 'numeric',
      },
      yaxis: {
        title: { text: 'P-Value' },
        min: 0,
        max: 1,
      },
      title: {
        text: 'P-Value Over Number of Rolls',
        align: 'center',
      },
    };

    pValueChart = new ApexCharts(document.querySelector('#pValueChart'), options);
    pValueChart.render();
  };

  // Update the p-value chart
  const updatePValueChart = () => {
    pValueChart.updateSeries([
      {
        name: 'P-Value',
        data: pValues().filter((pv) => pv.y !== null).map(pv => pv.y.toFixed(2)),
      },
    ]);
  };

  // Initialize charts on mount
  onMount(() => {
    initProbabilityChart();
    initPValueChart();
  });

  // Clean up charts on unmount
  onCleanup(() => {
    if (probabilityChart) probabilityChart.destroy();
    if (pValueChart) pValueChart.destroy();
  });

  // Function to export data
  const exportData = () => {
    const data = {
      diceType: diceType(),
      confidenceLevel: confidenceLevel(),
      rolls: rolls(),
      statsResults: statsResults(),
      chiSquaredResults: chiSquaredResults(),
    };
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary link to download the file
    const link = document.createElement('a');
    link.href = url;
    link.download = `dice_fairness_data.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="container mt-5">
      <h1 class="title is-3 has-text-centered">Dice Fairness Calculator</h1>

      {/* Dice type selection */}
      <div class="box">
        <label class="label">Select Dice Type:</label>
        <div class="buttons">
          {[4, 6, 8, 10, 12, 20].map((type) => (
            <button class="button is-primary" onClick={() => onDiceTypeChange(type)}>
              D{type}
            </button>
          ))}
        </div>
      </div>

      {/* Confidence level selection */}
      <div class="box">
        <label class="label">Select Confidence Level:</label>
        <div class="buttons">
          {[0.9, 0.95, 0.99].map((level) => (
            <button
              class={`button ${confidenceLevel() === level ? 'is-link' : ''}`}
              onClick={() => onConfidenceLevelChange(level)}
            >
              {(level * 100).toFixed(0)}%
            </button>
          ))}
        </div>
      </div>

      {/* Roll input buttons */}
      <div class="box">
        <h2 class="subtitle is-4">Click to add a roll:</h2>
        <div class="buttons">
          {Array.from({ length: diceType() }, (_, i) => (
            <button
              class="button is-info m-1"
              onClick={() => addRoll(i + 1)}
              key={i}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Probability chart */}
      <div class="box">
        <h2 class="subtitle is-4">Probability with Confidence Intervals</h2>
        <div id="probabilityChart"></div>
      </div>

      {/* Statistical measures table */}
      {statsResults().length > 0 && (
        <div class="box">
          <h2 class="subtitle is-4">Statistical Measures per Side</h2>
          <table class="table is-fullwidth is-striped">
            <thead>
              <tr>
                <th>Side</th>
                <th>Observed Probability</th>
                <th>Expected Probability</th>
                <th>Variance</th>
                <th>Standard Deviation</th>
                <th>Z-Score</th>
                <th>P-Value</th>
              </tr>
            </thead>
            <tbody>
              {statsResults().map((stat) => (
                <tr key={stat.side}>
                  <td>{stat.side}</td>
                  <td>{stat.observedProbability.toFixed(4)}</td>
                  <td>{stat.expectedProbability.toFixed(4)}</td>
                  <td>{stat.variance.toFixed(6)}</td>
                  <td>{stat.standardDeviation.toFixed(4)}</td>
                  <td>{stat.zScore.toFixed(2)}</td>
                  <td>{stat.pValuePerSide.toExponential(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* P-Value over number of rolls chart */}
      <div class="box">
        <h2 class="subtitle is-4">P-Value Over Number of Rolls</h2>
        <div id="pValueChart"></div>
      </div>

      {/* Sample size warning */}
      {!sampleSizeAdequate() && rolls().length > 0 && (
        <div class="notification is-warning">
          The sample size is too small for a reliable Chi-Squared test.
          Please roll the dice more times (at least {diceType() * 5} rolls).
        </div>
      )}

      {/* Chi-squared test results */}
      {sampleSizeAdequate() && (
        <div class="box">
          <h2 class="subtitle is-4">Chi-Squared Test Results</h2>
          {chiSquaredResults() ? (
            <table class="table is-fullwidth is-striped">
              <thead>
                <tr>
                  <th>
                    Chi-Squared Statistic
                    <span
                      class="icon has-tooltip-arrow has-tooltip-multiline has-tooltip-bottom"
                      data-tooltip="A measure of how much the observed counts deviate from the expected counts."
                    >
                      <i class="fas fa-info-circle"></i>
                    </span>
                  </th>
                  <th>Degrees of Freedom</th>
                  <th>
                    P-Value
                    <span
                      class="icon has-tooltip-arrow has-tooltip-multiline has-tooltip-bottom"
                      data-tooltip="The probability of observing a chi-squared statistic as extreme as this, assuming the dice is fair."
                    >
                      <i class="fas fa-info-circle"></i>
                    </span>
                  </th>
                  <th>Conclusion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{chiSquaredResults().chiSquared.toFixed(2)}</td>
                  <td>{chiSquaredResults().degreesOfFreedom}</td>
                  <td>{chiSquaredResults().pValue.toExponential(2)}</td>
                  <td>
                    {chiSquaredResults().pValue < 0.05 ? (
                      <span class="has-text-danger">Dice is biased</span>
                    ) : (
                      <span class="has-text-success">Dice is fair</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p>No rolls yet</p>
          )}
        </div>
      )}

      {/* Export data button */}
      <div class="box">
        <button class="button is-primary" onClick={exportData}>
          Export Data and Results
        </button>
      </div>

      {/* Explanatory text */}
      <div class="content">
        <h3>Understanding the Results</h3>
        <p>
          The <strong>Probability Chart</strong> shows the observed probability for each side of the dice, along with confidence intervals indicating the uncertainty of the estimate. You can select the confidence level to adjust the width of the confidence intervals.
        </p>
        <p>
          The <strong>Statistical Measures Table</strong> provides detailed statistics for each side, including variance, standard deviation, z-score, and p-value.
        </p>
        <p>
          The <strong>Z-Score</strong> indicates how many standard deviations the observed probability is from the expected probability. The <strong>P-Value</strong> for each side tells you the probability of observing such an extreme result if the dice were fair.
        </p>
        <p>
          The <strong>P-Value Over Number of Rolls</strong> chart shows how the statistical significance changes as you add more rolls.
        </p>
        <p>
          For the Chi-Squared test to be valid, the expected frequency for each side should be at least 5.
        </p>
      </div>
    </div>
  );
}

export default App;
