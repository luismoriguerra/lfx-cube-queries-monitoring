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
    // Attach debugger to tab to get the response body
    const tabId = details.tabId;
    if (tabId !== chrome.tabs.TAB_ID_NONE) {
      chrome.debugger.attach({ tabId: tabId }, "1.2", () => {
        chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");
      });
    }
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["requestBody"]
);

chrome.debugger.onEvent.addListener((debuggeeId, message, params) => {
  if (
    message === "Network.responseReceived" &&
    params.type === "XHR" &&
    params.response.url.includes("bff")
  ) {
    chrome.debugger.sendCommand(
      debuggeeId,
      "Network.getResponseBody",
      { requestId: params.requestId },
      (responseBody) => {
        for (let data of interceptedData) {
          if (data.url === params.response.url) {
            try {
              const jsonBody = JSON.parse(responseBody.body);
              data.response = jsonBody;
            } catch (e) {
              console.error("Error parsing response body:", e);
            }
          }
        }
      }
    );
  }
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId !== chrome.tabs.TAB_ID_NONE) {
      chrome.debugger.detach({ tabId: tabId });
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
    ); // Sorting by recent timestamp
  }
});
