const fs = require('fs');

let tsx = fs.readFileSync('frontend/src/pages/InspectorApp.tsx', 'utf-8');

// 1. Add handleTabChange inside InspectorApp component
// The state declarations look like:
// const [activeTab, setActiveTab] = useState('menu');
// const [tickets, setTickets] = useState<any[]>([]);

const stateHookStr = `const [activeTab, setActiveTab] = useState('menu');`;
const newLogic = `
  const [activeTab, setActiveTab] = useState('menu');

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

  const handleTabChange = (newTab: string) => {
    if (newTab !== activeTab) {
      window.history.pushState({ tab: newTab }, '');
      setActiveTab(newTab as any);
    }
  };

  const handleTicketOpen = (setter: Function, item: any) => {
    window.history.pushState({ tab: activeTab, modalOpen: true }, '');
    setter(item);
  };
`;

tsx = tsx.replace(stateHookStr, newLogic);

// 2. Replace setActiveTab('xyz') with handleTabChange('xyz')
// EXCEPT inside the useEffect we just added!
// Since we used handleTabChange, we can replace all `setActiveTab(` with `handleTabChange(`
// wait, we have `setActiveTab(event.state.tab)` and `setActiveTab('menu')` inside the useEffect itself...
// We will replace `setActiveTab('xyz')` with `handleTabChange('xyz')` only for the UI buttons.

tsx = tsx.replace(/onClick=\{\(\) => setActiveTab\('([a-zA-Z_]+)'\)\}/g, "onClick={() => handleTabChange('$1')}");

// Also in the header button:
// <button onClick={() => setActiveTab('menu')}
tsx = tsx.replace(/<button onClick=\{\(\) => setActiveTab\('menu'\)\}/, "<button onClick={() => handleTabChange('menu')}");

// 3. For opening tickets, so the back button closes the ticket instead of exiting the app:
// We replace: onClick={() => setSelectedTicket(t)} with onClick={() => handleTicketOpen(setSelectedTicket, t)}
tsx = tsx.replace(/onClick=\{\(\) => setSelectedTicket\(([^)]+)\)\}/g, "onClick={() => handleTicketOpen(setSelectedTicket, $1)}");
tsx = tsx.replace(/onClick=\{\(\) => setSelectedCalidadTicket\(([^)]+)\)\}/g, "onClick={() => handleTicketOpen(setSelectedCalidadTicket, $1)}");
tsx = tsx.replace(/onClick=\{\(\) => setSelectedOrden\(([^)]+)\)\}/g, "onClick={() => handleTicketOpen(setSelectedOrden, $1)}");
tsx = tsx.replace(/onClick=\{\(\) => setSelectedRazon\(([^)]+)\)\}/g, "onClick={() => handleTicketOpen(setSelectedRazon, $1)}");


fs.writeFileSync('frontend/src/pages/InspectorApp.tsx', tsx);
console.log('Done handling back button');
