document.getElementById("fetch-count").addEventListener("click", async () => {
    const resultElement = document.getElementById("result");
    resultElement.textContent = "Fetching count...";

    try {
        // Load config from config.json
        const config = await fetch(chrome.runtime.getURL("config.json")).then((response) => response.json());

        // Configure AWS SDK
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
        });

        const docClient = new AWS.DynamoDB.DocumentClient();

        // Scan the table and count the items
        const params = { TableName: "search_log", Select: "COUNT" };
        docClient.scan(params, (err, data) => {
            if (err) {
                console.error("Error fetching table count:", err);
                resultElement.textContent = "Error fetching table count.";
            } else {
                const count = data.Count || 0;
                console.log("Table count:", count);
                resultElement.textContent = `Table contains ${count} items.`;
            }
        });
    } catch (err) {
        console.error("Error setting up AWS SDK:", err);
        resultElement.textContent = "Error setting up AWS.";
    }
});
