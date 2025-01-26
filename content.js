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

        function recordPageChange() {
            const currentPage = window.location.href;
        
            const params = {
                TableName: "search_log",
                Item: {
                    timestamp: new Date().toISOString(),
                    eventType: "page_change",
                    pageAddress: currentPage,
                },
            };
        
            docClient.put(params, (err, data) => {
                if (err) {
                    console.error("Error saving event:", JSON.stringify(err, null, 2));
                } else {
                    console.log("Event recorded:", JSON.stringify(data, null, 2));
                }
            });
        }
        
        window.addEventListener("load", function () {
            recordPageChange();
        });

    })
    .catch((err) => console.error("Error loading config.json or configuring AWS:", err));