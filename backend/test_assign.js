const url = "https://script.google.com/macros/s/AKfycbw5ZVODZMur-NiBUHcw73txQtOt7FjhVif2burD_Ys8tMFCuBLvmfpT5yQDqEHQgK8O2Q/exec";

async function testAssign() {
  const payload = {
    action: "assign_ticket",
    id: 1, // Let's try to assign ticket 1
    tech_id: "999999",
    tech_name: "Test Inspector"
  };

  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "text/plain;charset=utf-8" }
  });

  const text = await response.text();
  console.log("Response:", text);
}

testAssign();
