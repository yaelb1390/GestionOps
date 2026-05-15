const fs = require('fs');

let tsx = fs.readFileSync('frontend/src/pages/InspectorApp.tsx', 'utf-8');

// 1. Add showExitConfirm state
const stateHookStr = `const [activeTab, setActiveTab] = useState('menu');`;
const newLogic = `
  const [activeTab, setActiveTab] = useState('menu');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // MANEJO DE BOTON "ATRÁS" EN CELULARES Y CONFIRMACION DE SALIDA
  useEffect(() => {
    // Establecer la base del historial para poder interceptar la salida
    window.history.replaceState({ isRoot: true }, '');
    window.history.pushState({ tab: 'menu' }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Forzar cierre de cualquier modal/formulario abierto
      setIsFormActive(false);
      setSelectedTicket(null);
      setSelectedCalidadTicket(null);
      setSelectedOrden(null);
      setSelectedRazon(null);
      setShowManualInput(false);

      if (event.state && event.state.isRoot) {
        // El usuario intentó salir desde el menú principal
        // Lo atrapamos devolviéndolo al menú y mostramos la confirmación
        window.history.pushState({ tab: 'menu' }, '');
        setActiveTab('menu');
        setShowExitConfirm(true);
      } else if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('menu');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
`;

// We need to replace the PREVIOUS useEffect logic that we injected.
// The previous one looked like:
/*
  // MANEJO DE BOTON "ATRÁS" EN CELULARES
  useEffect(() => {
    window.history.replaceState({ tab: 'menu' }, '');

    const handlePopState = (event: PopStateEvent) => {
      // Forzar cierre de cualquier modal/formulario abierto
      setIsFormActive(false);
      setSelectedTicket(null);
      setSelectedCalidadTicket(null);
      setSelectedOrden(null);
      setSelectedRazon(null);
      setShowManualInput(false);

      if (event.state && event.state.tab) {
        setActiveTab(event.state.tab);
      } else {
        setActiveTab('menu');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
*/

// Let's use string replacement safely
// I will just replace the whole block from "const [activeTab" to "}, []);"
const replaceRegex = /const \[activeTab, setActiveTab\] = useState\('menu'\);[\s\S]*?\}, \[\]\);/;

tsx = tsx.replace(replaceRegex, newLogic.trim());

// 2. Add the exit confirmation modal JSX
// Find where we render `<div className="inspector-layout">` and put the modal right after it
const layoutRegex = /<div className="inspector-layout">/;
const modalJSX = `<div className="inspector-layout">
      {showExitConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '1rem'
        }}>
          <div style={{
            background: 'var(--surface-color)', padding: '2rem', borderRadius: '12px',
            textAlign: 'center', maxWidth: '320px', width: '100%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', background: '#fee2e2',
              color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 1rem auto'
            }}>
              <LogOut size={28} />
            </div>
            <h3 style={{ marginBottom: '0.5rem', color: 'var(--text-main)', fontSize: '1.25rem' }}>¿Salir de la aplicación?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Estás a punto de salir del panel de inspección.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                className="btn-secondary" 
                style={{ flex: 1, padding: '0.75rem' }} 
                onClick={() => setShowExitConfirm(false)}
              >
                Cancelar
              </button>
              <button 
                className="btn-primary" 
                style={{ flex: 1, padding: '0.75rem', background: '#ef4444', borderColor: '#ef4444' }} 
                onClick={() => {
                  setShowExitConfirm(false);
                  window.history.go(-2);
                }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}
`;

tsx = tsx.replace(layoutRegex, modalJSX);

fs.writeFileSync('frontend/src/pages/InspectorApp.tsx', tsx);
console.log('Done handling exit confirmation modal');
