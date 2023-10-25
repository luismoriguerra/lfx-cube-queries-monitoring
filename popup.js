document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({action: "getData"}, function(response) {
    const tbody = document.getElementById('dataBody');
    response.forEach(item => {
      const row = tbody.insertRow();
      const timestampCell = row.insertCell(0);
      const urlCell = row.insertCell(1);
      const payloadCell = row.insertCell(2);
      const responseCell = row.insertCell(3);

      timestampCell.textContent = item.timestamp;
      urlCell.textContent = item.url;
      payloadCell.textContent = JSON.stringify(item.payload);
      responseCell.textContent = JSON.stringify(item.response);
    });
  });
  
  // Clear Button Event Listener
  const clearButton = document.getElementById('clearButton');
  clearButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({action: "clearData"}, function() {
      const tbody = document.getElementById('dataBody');
      tbody.innerHTML = '';
    });
  });
});
