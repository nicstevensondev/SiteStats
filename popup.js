// Fetch config.json before initializing AWS
fetch(chrome.runtime.getURL("config.json"))
    .then(response => response.json())
    .then(config => {
        // ✅ AWS Configuration
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
            dynamoDbCrc32: false, // ✅ Fix CRC32 error
        });

        const docClient = new AWS.DynamoDB.DocumentClient();

        // Function to fetch the latest 10 events
        async function fetchRecentEvents() {
            try {
                const params = {
                    TableName: "search_log",
                    ConsistentRead: true,
                };

                const data = await docClient.scan(params).promise(); // Fetch all items
                const sortedItems = data.Items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                return sortedItems.slice(0, 10);
            } catch (err) {
                console.error("Error fetching recent events:", err);
                throw err;
            }
        }

        // Event listener for button click
        document.getElementById("fetch-events").addEventListener("click", async () => {
            const resultElement = document.getElementById("result");
            resultElement.textContent = "Loading...";

            try {
                const events = await fetchRecentEvents();
                resultElement.innerHTML = "<h3>Recent Events</h3><ul>" +
                    events.map(event => `<li>${event.timestamp} - ${event.eventType} - ${event.pageAddress}</li>`).join("") +
                    "</ul>";
            } catch {
                resultElement.textContent = "Error fetching data.";
            }
        });

    })
    .catch(err => console.error("Error loading config.json:", err));

