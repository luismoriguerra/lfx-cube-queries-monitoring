document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ action: "getData" }, (data) => {
    const tbody = document.getElementById("dataBody");
    data.forEach((item) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${item.url}</td>
          <td>${JSON.stringify(item.payload)}</td>
          <td>${item.response}</td>
        `;
      tbody.appendChild(tr);
    });
  });
});
