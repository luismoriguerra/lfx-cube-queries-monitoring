const interceptedData = [];

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.method === "POST") {
      const requestBody = details.requestBody;
      interceptedData.push({
        url: details.url,
        payload: requestBody,
        response: "", // We'll fill this in later.
      });
    }
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === "POST") {
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
    sendResponse(interceptedData);
  }
});
