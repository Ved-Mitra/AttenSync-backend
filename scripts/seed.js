const payloads = [
  {
    userId: "u1",
    userName: "Aman",
    date: "2026-02-27",
    apps: [
      { packageName: "com.instagram.android", minutes: 120, factor: 1 },
      { packageName: "com.youtube.android", minutes: 60, factor: 1 }
    ]
  },
  {
    userId: "u1",
    userName: "Aman",
    date: "2026-02-28",
    apps: [
      { packageName: "com.instagram.android", minutes: 90, factor: 1 },
      { packageName: "com.youtube.android", minutes: 80, factor: 1 }
    ]
  },
  {
    userId: "u2",
    userName: "Priya",
    date: "2026-02-28",
    apps: [
      { packageName: "com.instagram.android", minutes: 30, factor: 1 }
    ]
  }
];

async function run() {
  for (const payload of payloads) {
    const res = await fetch("http://localhost:8080/v1/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    console.log(json);
  }
}

run().catch(console.error);

