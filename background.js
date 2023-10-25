const interceptedData = [];

function arrayBufferToString(buffer) {
  let byteArray = new Uint8Array(buffer);
  let str = "",
    byte;
  for (let i = 0; i < byteArray.byteLength; i++) {
    byte = byteArray[i];
    str += String.fromCharCode(byte);
  }
  return str;
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === "POST" && details.url.includes("bff")) {
      let jsonData = {};
      if (details.requestBody.raw && details.requestBody.raw[0]) {
        let rawPayload = arrayBufferToString(details.requestBody.raw[0].bytes);
        try {
          jsonData = JSON.parse(rawPayload);
        } catch (e) {
          // Handling possible errors in case the payload is not valid JSON
          console.error("Error parsing JSON:", e);
        }
      }

      interceptedData.push({
        url: JSON.stringify(jsonData.query),
        payload: '',
        response: "", // We'll fill this in later.
        timestamp: new Date().toISOString(), // Adding timestamp
      });
    }
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === "POST" && details.url.includes("bff")) {
      for (let data of interceptedData) {
        if (data.url === details.url) {
          data.response = details.statusCode + " " + details.statusText;
        }
      }
    }
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] }
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getData") {
    sendResponse(
      interceptedData.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      )
    );
  } else if (message.action === "clearData") {
    interceptedData.length = 0; // Clearing the data array
    sendResponse({ status: "Cleared" });
  }
});
