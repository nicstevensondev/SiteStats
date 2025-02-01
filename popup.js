// Fetch config.json before initializing AWS
fetch(chrome.runtime.getURL("config.json"))
    .then(response => response.json())
    .then(config => {
        // AWS Configuration
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
            dynamoDbCrc32: false, // Fix CRC32 error
        });

        const docClient = new AWS.DynamoDB.DocumentClient();

        async function fetchEvents() {
            try {
                const params = {
                    TableName: "search_log",
                    ConsistentRead: true,
                };

                const data = await docClient.scan(params).promise();
                return data.Items || [];
            } catch (err) {
                console.error("Error fetching events:", err);
                throw err;
            }
        }

        function getDomain(url) {
            try {
                return new URL(url).hostname.replace("www.", ""); // Extract domain
            } catch {
                return url;
            }
        }

        function getFavicon(domain) {
            return `https://icon.horse/icon/${domain}`; // Icon Horse API
        }

        document.getElementById("fetch-events").addEventListener("click", async () => {
            const resultElement = document.getElementById("result");
            const eventListElement = document.getElementById("event-list");

            resultElement.textContent = "Loading...";

            try {
                const events = await fetchEvents();
                if (!events.length) {
                    resultElement.textContent = "No data found.";
                    return;
                }

                // Count frequency of each website
                const domainCounts = {};
                let totalVisits = 0;
                
                events.forEach(event => {
                    const domain = getDomain(event.pageAddress);
                    domainCounts[domain] = (domainCounts[domain] || 0) + 1;
                    totalVisits++;
                });

                // Sort domains by visit count
                const sortedDomains = Object.entries(domainCounts)
                    .sort((a, b) => b[1] - a[1]);

                // Get top 5 sites and group others
                const topSites = sortedDomains.slice(0, 5);
                const otherCount = sortedDomains.slice(5).reduce((sum, [, count]) => sum + count, 0);

                resultElement.textContent = "";
                eventListElement.innerHTML = "";

                topSites.forEach(([domain, count]) => {
                    const percentage = ((count / totalVisits) * 100).toFixed(1);
                    
                    const listItem = document.createElement("li");
                    listItem.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <img src="${getFavicon(domain)}" class="favicon" alt="Icon">
                            ${domain} - <strong>${count}</strong> visits
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${percentage}%;"></div>
                        </div>
                    `;
                    eventListElement.appendChild(listItem);
                });

                // Add "Other" category
                if (otherCount > 0) {
                    let otherPercentage = ((otherCount / totalVisits) * 100).toFixed(1);
                    
                    // ✅ Ensure minimum width visibility
                    if (otherPercentage < 2) {
                        otherPercentage = 2; // Set a minimum width percentage
                    }

                    const otherItem = document.createElement("li");
                    otherItem.classList.add("other");
                    otherItem.innerHTML = `
                        <span>Other - <strong>${otherCount}</strong> visits</span>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${otherPercentage}%; background-color: #d9534f;"></div>
                        </div>
                    `;
                    eventListElement.appendChild(otherItem);
                }

            } catch (error) {
                resultElement.textContent = "Error fetching data.";
                console.error("Error fetching top sites:", error);
            }
        });

    })
    .catch(err => console.error("Error loading config.json:", err));
