fetch(chrome.runtime.getURL("config.json"))
    .then((response) => {
        if (!response.ok) {
            throw new Error(`Failed to load config.json: ${response.statusText}`);
        }
        return response.json();
    })
    .then((config) => {
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
        });

        const docClient = new AWS.DynamoDB.DocumentClient();

        function recordEvent(eventType) {
            const currentPage = window.location.href;
        
            const params = {
                TableName: "search_log",
                Item: {
                    timestamp: new Date().toISOString(),
                    eventType: eventType,
                    pageAddress: currentPage,
                },
            };
        
            docClient.put(params, (err, data) => {
                if (err) {
                    console.error(`Error saving ${eventType} event:`, JSON.stringify(err, null, 2));
                } else {
                    console.log(`${eventType} event recorded:`, JSON.stringify(data, null, 2));
                }
            });
        }
        
        window.addEventListener("load", function () {
            recordEvent("page_load");
        });
        
        window.addEventListener("beforeunload", function () {
            recordEvent("page_unload");
        });
        
        let scrollTimeout = null;
        window.addEventListener("scroll", function () {
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            // Trigger only once every second during scrolling
            scrollTimeout = setTimeout(() => {
                recordEvent("scroll");
            }, 1000); 
        });

        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "recordCustomEvent") {
                // Example custom event to record
                recordEvent("custom_event");
                sendResponse({ success: true });
            }
        });        
    })
    .catch((err) => console.error("Error loading config.json or configuring AWS:", err));