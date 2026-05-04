const url = "https://script.google.com/macros/s/AKfycbyigYC_S-q7WFEu6KtaafIP7lMyu_BLafto1GyUtuszofR5ZzVw1cynGFXZ8uqc0BDnlA/exec";

async function test() {
  console.log("1. Creando inspector...");
  let res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ action: "add_inspector", nombre: "Yael", sector: "Oeste" }),
    headers: { "Content-Type": "text/plain;charset=utf-8" }
  });
  console.log(await res.text());

  console.log("2. Obteniendo inspectores...");
  res = await fetch(url + "?type=inspectors");
  console.log(await res.text());

  console.log("3. Auto asignando tickets...");
  res = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ action: "auto_assign" }),
    headers: { "Content-Type": "text/plain;charset=utf-8" }
  });
  console.log(await res.text());
}

test();
