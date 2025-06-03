export function downloadCSV(data, filename = "filtered_chart_data.csv") {
  if (!data || data.length === 0) return;

  const csvContent = [
    Object.keys(data[0]).join(","), // Header row
    ...data.map(row => Object.values(row).join(",")) // Data rows
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
