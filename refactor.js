const fs = require('fs');

let tsx = fs.readFileSync('frontend/src/pages/InspectorApp.tsx', 'utf-8');

// 1. Change <div className="mobile-view"> to <div className="inspector-layout">
tsx = tsx.replace(/<div className="mobile-view">/g, '<div className="inspector-layout">');

// 2. Rewrite the header to be a corporate header
const oldHeaderRegex = /<header className="header-actions"[\s\S]*?<\/header>/;
const newHeader = `
        <header className="inspector-header">
          <div className="corp-header-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="corp-avatar">
                <LayoutGrid size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Inspector Claro</div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{inspectorName}</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>ID: {inspectorId}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {activeTab !== 'menu' && (
              <button onClick={() => setActiveTab('menu')} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <LayoutGrid size={16} /> Menú Principal
              </button>
            )}
            <button onClick={handleLogout} className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2' }}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </header>
        <main className="inspector-main">
`;
tsx = tsx.replace(oldHeaderRegex, newHeader);

// 3. Remove bottom-nav completely (since we added Menú Principal to header)
tsx = tsx.replace(/<nav className="bottom-nav">[\s\S]*?<\/nav>/, '');
// And close </main> at the end instead of the padding div
tsx = tsx.replace(/<div style={{ height: '160px', width: '100%', flexShrink: 0 }}><\/div>/, '</main>');

// 4. Change menu buttons to be corp-cards instead of mobile-cards
// The menu buttons look like this:
// <button
//   className="mobile-card"
//   style={{ 
//     display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
//     padding: '1.5rem 1rem', gap: '1rem', border: '1px solid var(--glass-border)',
//     background: 'var(--glass-bg)', borderRadius: '24px', transition: 'all 0.3s ease',
//     minHeight: '140px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
//   }}
// ...
// We can use a simpler regex or manual string manipulation to clean this up.

const updateMenuButtons = (code) => {
  // It's easier to just match all `<button className="mobile-card"` in the menu area
  // Wait, the menu area is under `{activeTab === 'menu' && (`
  
  return code.replace(/<button[\s\S]*?className="mobile-card"[\s\S]*?style={{[\s\S]*?}}[\s\S]*?onClick=\{\(\) => setActiveTab\('([^']+)'\)\}>([\s\S]*?)<\/button>/g, (match, tabId, innerHtml) => {
    
    // innerHtml contains something like:
    // <div>
    //   <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '...', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', marginBottom: '0.75rem', boxShadow: '0 4px 10px rgba(x,x,x,0.2)' }}>
    //     <Icon size={24} color="#fff" />
    //   </div>
    //   <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', textAlign: 'center', marginBottom: '0.25rem' }}>Title</div>
    //   <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', opacity: 0.8 }}>Subtitle</div>
    // </div>
    
    // We will extract the icon tag, title and subtitle text.
    let iconMatch = innerHtml.match(/<([A-Z][a-zA-Z0-9]+)\s+size=\{24\}/);
    let iconTag = iconMatch ? iconMatch[0] + ' color="var(--primary-color)" />' : '<LayoutGrid size={24} color="var(--primary-color)" />';
    
    let titleMatch = innerHtml.match(/fontWeight: 600[\s\S]*?>([^<]+)<\/div>/);
    let title = titleMatch ? titleMatch[1] : 'Menú';

    let subtitleMatch = innerHtml.match(/opacity: 0\.8[\s\S]*?>([^<]+)<\/div>/);
    let subtitle = subtitleMatch ? subtitleMatch[1] : '';

    return `
            <button 
              className="corp-card"
              onClick={() => setActiveTab('${tabId}')}
            >
              <div className="corp-icon-box">
                ${iconTag}
              </div>
              <div className="corp-title">${title}</div>
              <div className="corp-subtitle">${subtitle}</div>
            </button>
    `;
  });
};

tsx = updateMenuButtons(tsx);

// 5. Change ticket grids to have proper gap and layout (they already do, we just changed them)
// We will also change `mobile-card` to `corp-ticket-card` for the tickets inside pendientes, completadas, mis_tickets, repetidas, razones.
// Let's replace `<div className="mobile-card"` with `<div className="corp-ticket-card"` ONLY for the ones that have onClick={() => ... }
tsx = tsx.replace(/<div\s+className="mobile-card"\s+onClick=\{/g, '<div className="corp-ticket-card" onClick={');

fs.writeFileSync('frontend/src/pages/InspectorApp.tsx', tsx);
console.log('InspectorApp.tsx updated');
