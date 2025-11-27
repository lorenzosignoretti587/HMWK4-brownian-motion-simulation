// brownian_script.js

let brownianPathChartInstance;
let finalDistributionChartInstance;

// === 1. BOX-MULLER GENERATOR (N(0, 1)) ===
// Generates a Standard Normal variable Z ~ N(0, 1)
// using the Box-Muller method from two Uniform U(0, 1) variables.
let hasSecondBoxMuller = false;
let secondBoxMullerValue = 0.0;

function generateStandardNormal() {
    // Box-Muller produces two normal values for two uniforms.
    // This handles reusing the second value for efficiency.
    if (hasSecondBoxMuller) {
        hasSecondBoxMuller = false;
        return secondBoxMullerValue;
    }

    let u1, u2, R, theta;

    // Generate two non-zero Uniform U(0, 1) variables (polar form)
    do { u1 = Math.random(); } while (u1 === 0); 
    u2 = Math.random(); 

    // Box-Muller Transformation
    R = Math.sqrt(-2.0 * Math.log(u1)); 
    theta = 2.0 * Math.PI * u2; 

    // Z1 = R * cos(theta)
    const z1 = R * Math.cos(theta);
    
    // Z2 = R * sin(theta) (Save the second value for the next call)
    secondBoxMullerValue = R * Math.sin(theta);
    hasSecondBoxMuller = true;

    return z1;
}

// === 2. BROWNIAN MOTION SIMULATION ===
function simulateBrownianMotion(T, n) {
    const dt = T / n; 
    const sqrt_dt = Math.sqrt(dt);

    let path_values = [];
    let current_value = 0; // The process starts at B_0 = 0
    

    for (let i = 0; i < n; i++) {
        // Generate the standard normal increment N(0, 1)
        const Z = generateStandardNormal(); 
        
        // Calculate the Brownian Motion jump (increment): dB_t = sqrt(dt) * Z
        const jump = sqrt_dt * Z;
        
        current_value += jump;
        
        path_values.push(current_value);
    }
    
    return { 
        path_values: path_values,
        final_value: current_value 
    };
}


// === 3. NORMAL DENSITY FUNCTION (PDF) ===
// Calculates the PDF of N(mu, sigma^2) for comparing the final distribution
function normalPDF(x, mu, sigma) {
    const sigmaSq = sigma * sigma;
    const invSqrt2PiSigmaSq = 1 / Math.sqrt(2 * Math.PI * sigmaSq);
    return invSqrt2PiSigmaSq * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
}


// === 4. MAIN FUNCTION ===
function runSimulation() {
    const T = parseFloat(document.getElementById('T').value);             
    const n = parseInt(document.getElementById('n').value);               
    const m_runs = parseInt(document.getElementById('runs').value);       

    if (isNaN(T) || isNaN(n) || isNaN(m_runs) || n < 100 || m_runs < 100) {
        alert("Please enter valid parameters. T must be > 0, n and m must be large enough.");
        return;
    }

    // 1. Run the simulation for a single path
    const single_run_data = simulateBrownianMotion(T, n);
    
    // 2. Run the simulation m times (for the Final Distribution)
    let final_values = [];
    let min_val = Infinity;
    let max_val = -Infinity;

    for (let i = 0; i < m_runs; i++) {
        const result = simulateBrownianMotion(T, n);
        const final_x = result.final_value;
        final_values.push(final_x);
        if (final_x < min_val) min_val = final_x;
        if (final_x > max_val) max_val = final_x;
    }
    
    // --- Rendering ---
    renderBrownianPath(T, n, single_run_data.path_values);
    renderFinalDistribution(T, m_runs, final_values, min_val, max_val);
}


// === 5. CHART RENDERING ===

// Chart 1: Brownian Motion Path
function renderBrownianPath(T, n, path_values) {
    const ctx = document.getElementById('brownianPathChart').getContext('2d');
    if (brownianPathChartInstance) {
        brownianPathChartInstance.destroy();
    }
    
    const labels = Array.from({length: n}, (_, i) => ((i + 1) * T / n).toFixed(4));

    brownianPathChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Brownian Path B(t)',
                data: path_values,
                borderColor: 'rgba(0, 119, 181, 1)', // Blue
                backgroundColor: 'rgba(0, 119, 181, 0.2)',
                borderWidth: 2,
                fill: false,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Padding for the axes
            layout: { padding: { left: 10, right: 10, top: 5, bottom: 50 } }, 
            plugins: {
                title: { display: true, text: `Brownian Path over Time T=${T} (n=${n} Steps)` }
            },
            scales: {
                x: {
                    padding: 10,
                    title: { display: true, text: 'Time (t)' },
                    ticks: {
                        // Display ticks only every 10%
                        callback: function(val, index) {
                            return index % (Math.ceil(n / 10)) === 0 ? this.getLabelForValue(val) : '';
                        },
                        maxRotation: 0, minRotation: 0
                    }
                },
                y: {
                    title: { display: true, text: 'Position B(t)' }
                }
            }
        }
    });
}

// Chart 2: Final Distribution
function renderFinalDistribution(T, m_runs, final_values, min_val, max_val) {
    const ctx = document.getElementById('finalDistributionChart').getContext('2d');
    if (finalDistributionChartInstance) {
        finalDistributionChartInstance.destroy();
    }

    const mu = 0;
    const sigma = Math.sqrt(T); // Standard deviation is sqrt(T)
    const bins = 20; // Number of bins for the histogram
    const range = max_val - min_val;
    const binWidth = range / bins;

    let histogram = new Array(bins).fill(0);
    
    // Build the observed histogram
    final_values.forEach(val => {
        let binIndex = Math.floor((val - min_val) / binWidth);
        if (binIndex >= bins) binIndex = bins - 1; 
        if (binIndex < 0) binIndex = 0; 
        histogram[binIndex]++;
    });

    let labels = [];
    let observed_densities = []; // Observed density (relative frequency divided by bin width)
    let theoretical_densities = []; // Theoretical density (PDF)

    // Prepare data for visualization
    for (let i = 0; i < bins; i++) {
        const binCenter = min_val + (i + 0.5) * binWidth;
        labels.push(binCenter.toFixed(2));
        
        // Observed Density: (Relative frequency / Bin width)
        const observed_frequency = histogram[i] / m_runs;
        observed_densities.push(observed_frequency / binWidth); 
        
        // Theoretical density (at the bin center)
        theoretical_densities.push(normalPDF(binCenter, mu, sigma));
    }

    finalDistributionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Observed Density',
                    data: observed_densities,
                    backgroundColor: 'rgba(75, 192, 192, 0.7)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    type: 'bar',
                    yAxisID: 'y'
                },
                {
                    label: `Theoretical N(0, T=${T}) PDF`,
                    data: theoretical_densities,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0)',
                    borderWidth: 3,
                    type: 'line',
                    pointRadius: 3,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Padding for the axes
            layout: { padding: { left: 10, right: 10, top: 5, bottom: 50 } }, 
            plugins: {
                title: { display: true, text: `Final Position B(T) Distribution (T=${T})` }
            },
            scales: {
                x: { 
                    padding: 10,
                    title: { display: true, text: 'Final Position B(T)' },
                    ticks: { maxRotation: 0, minRotation: 0 } 
                },
                y: { 
                    title: { display: true, text: 'Probability Density' },
                    beginAtZero: true
                }
            }
        }
    });
}