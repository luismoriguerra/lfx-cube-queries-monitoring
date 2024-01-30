let interceptedData = [];
const queriesGroups = {};
const pendingTabs = {};

function detachDebugger(tabId) {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError.message);
    return;
  }
  chrome.debugger.detach({ tabId: tabId });
}

function safeAttachDebugger(tabId, callback) {
  chrome.debugger.detach({ tabId: tabId }, () => {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError.message);
      return;
    }
    chrome.debugger.attach({ tabId: tabId }, "1.0", callback);
  });
}

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
    // console.log("details", details);
    if (details.method === "POST" && details.url.includes("bff")) {
      let jsonData = {};
      if (details.requestBody.raw && details.requestBody.raw[0]) {
        let rawPayload = arrayBufferToString(details.requestBody.raw[0].bytes);
        // console.log("data", rawPayload);
        try {
          jsonData = JSON.parse(rawPayload);
        } catch (e) {
          // Handling possible errors in case the payload is not valid JSON
          console.error("Error parsing JSON:", e);
        }
      }

      // interceptedData.push({
      //   url: JSON.stringify(jsonData.query),
      //   payload: "",
      //   response: "", // We'll fill this in later.
      //   timestamp: new Date().toISOString(), // Adding timestamp
      // });

      const tabId = details.tabId;
      if (tabId !== chrome.tabs.TAB_ID_NONE) {
        pendingTabs[tabId] = true; // Mark the tab as having a pending request
        safeAttachDebugger(tabId, function () {
          chrome.debugger.sendCommand({ tabId: tabId }, "Network.enable");
        });
      }
      //
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
        console.log("data response", {
          responseBody,
          params,
        });
        for (let data of interceptedData) {
          if (data.url === params.response.url) {
            try {
              const jsonBody = JSON.parse(responseBody.body);
              data.response = jsonBody;

              // We've processed the response, safe to detach debugger from this tab
              delete pendingTabs[debuggeeId.tabId];
              if (!pendingTabs[debuggeeId.tabId]) {
                detachDebugger(debuggeeId.tabId);
              }
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
    if (tabId !== chrome.tabs.TAB_ID_NONE && !pendingTabs[tabId]) {
      detachDebugger(tabId);
    }

    if (details.method === "POST" && details.url.includes("bff")) {
      // console.log("onCompleted details", details);
      const findcachekey = details.responseHeaders.find((item) => {
        return item.name === "x-caching-key";
      });
      const value = findcachekey ? findcachekey.value : "";
      // console.log("findcachekey", value);
      // remove cubequery::
      const cubeQueryUsingDyntStr = value.replace("cubequery::", "");
      let cubeQueryJSON = JSON.parse(cubeQueryUsingDyntStr);

      if (Array.isArray(cubeQueryJSON) || !!cubeQueryJSON["0"]) {
        cubeQueryJSON = cubeQueryJSON[0] || cubeQueryJSON["0"];
      }

      // sort the keys
      const cubeMeDi = {
        dimensions: cubeQueryJSON.dimensions.sort(),
        measures: cubeQueryJSON.measures.sort(),
      };

      delete cubeQueryJSON.dimensions;
      delete cubeQueryJSON.measures;

      const cubeJSONsorted = {
        ...cubeMeDi,
        ...cubeQueryJSON,
      };

      // console.log("parsedCachekey", cubeJSONsorted);
      const isSnow = cubeQueryUsingDyntStr.toLowerCase().includes("snow");
      const extractFromOrder = (order) => {
        if (Array.isArray(order)) {
          return order.flatMap((o) => (o[0] ? [o[0]] : [])) || [];
        } else if (typeof order === "object") {
          return Object.keys(order) || [];
        }
        return [];
      };
      const extractSchemaName = (member) => {
        const parts = member.split(".");
        return parts.length > 1 ? parts[0] : null;
      };
      function getCubeSchemaNames(outerQuery) {
        let query = outerQuery;

        if (!query) {
          return [];
        }

        if (!Array.isArray(query)) {
          query = [query];
        }

        const schemaNames = query
          .flatMap((q) => [
            ...(q.measures || []),
            ...(q.dimensions || []),
            ...(q.segments || []),
            ...(q.timeDimensions
              ? q.timeDimensions.map((t) => t.dimension)
              : []),
            ...(q.filters ? q.filters.map((f) => f.member || f.dimension) : []),
            ...extractFromOrder(q.order),
          ])
          .map(extractSchemaName)
          .filter((name) => !!name);

        return Array.from(new Set(schemaNames)).sort();
      }

      if (true) {
        const queryItem = {
          isSnow,
          schemas: getCubeSchemaNames(cubeQueryJSON),
          url: JSON.stringify(cubeJSONsorted),
          query: cubeQueryUsingDyntStr,
          timestamp: new Date().toISOString(), // Adding timestamp
        };
        let key = queryItem.schemas.join(",");

        if (!key) {
          key = JSON.stringify(cubeJSONsorted);
        }

        if (!queriesGroups[key]) {
          queriesGroups[key] = {
            schemas: key,
            timestamp: new Date().toISOString(),
            items: [],
          };
        }
        queriesGroups[key].items.push(queryItem);
      }
    }
  },
  { urls: ["<all_urls>"], types: ["xmlhttprequest"] },
  ["responseHeaders"]
);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getData") {
    interceptedData = Object.values(queriesGroups);
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
