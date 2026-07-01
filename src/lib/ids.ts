export function createMapId() {
  return `map_gz_${Date.now()}`;
}

export function createRunId() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
    `${now.getHours()}`.padStart(2, "0"),
    `${now.getMinutes()}`.padStart(2, "0"),
    `${now.getSeconds()}`.padStart(2, "0"),
  ];

  return `run_${parts.join("")}_${Math.random().toString(36).slice(2, 6)}`;
}
