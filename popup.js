document.addEventListener("DOMContentLoaded", () => {
  chrome.runtime.sendMessage({ action: "getData" }, function (response) {
    const tbody = document.getElementById("dataBody");
    response.forEach((item) => {
      const row = tbody.insertRow();
      const col1 = row.insertCell(0);
      const col2 = row.insertCell(1);
      const col3 = row.insertCell(2);
      const col4 = row.insertCell(3);
      // const responseCell = row.insertCell(4);

      col1.textContent = item.timestamp;
      col2.textContent = item.schemas;
      col3.textContent = item.items.length ;
      col4.textContent = item.items[0].query;
      // cal4.textContent = item.url;
      // payloadCell.textContent = JSON.stringify(item.payload);
      // responseCell.textContent = JSON.stringify(item.response);
    });
  });

  // Clear Button Event Listener
  const clearButton = document.getElementById("clearButton");
  clearButton.addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "clearData" }, function () {
      const tbody = document.getElementById("dataBody");
      tbody.innerHTML = "";
    });
  });
});
