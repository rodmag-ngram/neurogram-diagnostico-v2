// home.js — lógica exclusiva da landing page (/)

function $(id) { return document.getElementById(id); }

function initWelcomeRadar() {
  const ctx = $('welcome-radar');
  if (!ctx) return;
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Seg.','Proc.','Inter.','Intel.'],
      datasets: [{
        data: [82, 75, 91, 58],
        backgroundColor: 'rgba(162,201,110,.15)',
        borderColor: '#A2C96E',
        borderWidth: 1.5,
        pointRadius: 2,
        pointBackgroundColor: ['#A2C96E','#10B981','#8B5CF6','#F59E0B']
      }]
    },
    options: {
      responsive: false,
      animation: false,
      scales: {
        r: {
          beginAtZero: true, min: 0, max: 100,
          ticks: { display: false },
          grid: { color: 'rgba(255,255,255,.08)' },
          pointLabels: { display: false }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initWelcomeRadar();
  track('home_viewed');
});
