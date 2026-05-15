const fs = require('fs');

const appendCss = `
/* --- CORPORATE INSPECTOR LAYOUT --- */
.inspector-layout {
  min-height: 100vh;
  background-color: var(--bg-color);
  display: flex;
  flex-direction: column;
}

.inspector-header {
  background: var(--surface-color);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.inspector-main {
  flex: 1;
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.corp-card {
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 8px; /* Corporate sharp edges */
  padding: 1.5rem;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  text-align: left;
  align-items: flex-start;
}

.corp-card:hover {
  box-shadow: 0 6px 16px rgba(0,0,0,0.06);
  border-color: #cbd5e1;
  transform: translateY(-2px);
}

.corp-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.25rem;
  background: #f8fafc;
  color: var(--primary-color);
  border: 1px solid #e2e8f0;
}

.corp-title {
  font-weight: 600;
  color: var(--text-main);
  font-size: 1.05rem;
  margin-bottom: 0.25rem;
}

.corp-subtitle {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.corp-header-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.corp-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .inspector-header {
    padding: 1rem;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
  .corp-header-info {
    justify-content: space-between;
  }
  .inspector-main {
    padding: 1rem;
    padding-bottom: 6rem;
  }
}
`;

fs.appendFileSync('frontend/src/index.css', appendCss);
console.log('CSS appended successfully');
