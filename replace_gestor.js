const fs = require('fs');
const path = require('path');

const replacements = [
  ['Inspector Asignado', 'Gestor Asignado'],
  ['Directorio de Inspectores', 'Directorio de Gestores'],
  ['Añadir Inspector', 'Añadir Gestor'],
  ['Nuevo Inspector', 'Nuevo Gestor'],
  ['Editar Inspector', 'Editar Gestor'],
  ['ID del Inspector', 'ID del Gestor'],
  ['Nombre del Inspector', 'Nombre del Gestor'],
  ['Seleccionar Inspector...', 'Seleccionar Gestor...'],
  ['Elegir Inspector...', 'Elegir Gestor...'],
  ['al inspector', 'al gestor'],
  ['inspector inactivo', 'gestor inactivo'],
  ['Inspector eliminado', 'Gestor eliminado'],
  ['guardar inspector', 'guardar gestor'],
  ['eliminar inspector', 'eliminar gestor'],
  ['<span>Inspector</span>', '<span>Gestor</span>'],
  ['>Inspector</option>', '>Gestor</option>'],
  ['Inspector Claro', 'Gestor Claro'],
  ['No hay inspectores registrados', 'No hay gestores registrados'],
  ['Rendimiento Inspectores', 'Rendimiento Gestores'],
  ['Volverá al inspector', 'Volverá al gestor'],
  ['inspector asignado', 'gestor asignado'],
  ['Inspector asignado', 'Gestor asignado'],
  ['Inspectores asignados', 'Gestores asignados'],
  ['asignado a un inspector', 'asignado a un gestor'],
  ['asignarlo a un inspector', 'asignarlo a un gestor'],
  ["'{insp.rol || 'Inspector'}'", "'{insp.rol === \\'Inspector\\' ? \\'Gestor\\' : insp.rol}'"], // Let's not mess with code logic unless needed. The UI render has: {insp.rol || 'Inspector'}
  ["{insp.rol || 'Inspector'}", "{insp.rol === 'Inspector' ? 'Gestor' : insp.rol}"]
];

const files = [
  'frontend/src/pages/Login.tsx',
  'frontend/src/pages/InspectorApp.tsx',
  'frontend/src/pages/AdminDashboard.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  replacements.forEach(([search, replace]) => {
    content = content.split(search).join(replace);
  });

  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
});
