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
                return data.Items || []; // ✅ Extract only Items
            } catch (err) {
                console.error("Error fetching events:", err);
                return [];
            }
        }

        function getDomain(url) {
            try {
                // Get the domain without .com or any other TLD (e.g., google from google.com)
                const hostname = new URL(url).hostname.replace("www.", "");
                return hostname;
            } catch {
                return url;
            }
        }

        function getFavicon(domain) {
            // Pass the full domain to Icon Horse for fetching the favicon
            return `https://icon.horse/icon/${domain}`; // Icon Horse API
        }

        document.getElementById("fetch-events").addEventListener("click", async () => {
            const resultElement = document.getElementById("result");
            resultElement.textContent = "Loading...";

            try {
                const events = await fetchEvents();
                if (!events.length) {
                    resultElement.textContent = "No data found.";
                    return;
                }

                // ✅ 1. Extract domain names from URLs
                const domainVisits = {};
                const domainTimestamps = {};

                events.forEach(event => {
                    const domain = getDomain(event.pageAddress); // Get domain without TLD

                    // ✅ Count visits
                    domainVisits[domain] = (domainVisits[domain] || 0) + 1;

                    // ✅ Store timestamps for time spent calculations
                    if (!domainTimestamps[domain]) domainTimestamps[domain] = [];
                    domainTimestamps[domain].push(new Date(event.timestamp).getTime());
                });

                // ✅ 2. Compute total time spent per domain
                const domainTimeSpent = {};
                for (const domain in domainTimestamps) {
                    const times = domainTimestamps[domain].sort((a, b) => a - b);
                    let totalDuration = 0;

                    for (let i = 0; i < times.length - 1; i++) {
                        let diff = (times[i + 1] - times[i]) / 1000; // Convert to seconds

                        // ✅ Ignore gaps > 30 minutes (assume session ended)
                        if (diff < 1800) totalDuration += diff;
                    }

                    // ✅ Assume last session lasted ~2 minutes if no follow-up timestamp
                    totalDuration += 120;

                    domainTimeSpent[domain] = totalDuration;
                }

                // ✅ 3. Sort by most time spent (descending order)
                const sortedDomains = Object.keys(domainVisits)
                    .map(domain => ({
                        domain,
                        visits: domainVisits[domain],
                        timeSpent: domainTimeSpent[domain] || 0, // Default to 0 if missing
                    }))
                    .sort((a, b) => b.timeSpent - a.timeSpent); // Sort by time spent

                // ✅ 4. Calculate total visits & total time spent, then filter top 8
                const totalVisits = sortedDomains.reduce((sum, d) => sum + d.visits, 0);
                const totalTimeSpent = sortedDomains.reduce((sum, d) => sum + d.timeSpent, 0);
                const topDomains = sortedDomains.slice(0, 8); // Show Top 8 instead of 5
                const otherCount = totalVisits - topDomains.reduce((sum, d) => sum + d.visits, 0);
                const otherTimeSpent = totalTimeSpent - topDomains.reduce((sum, d) => sum + d.timeSpent, 0);

                console.log("Total time spent: ", totalTimeSpent)

                // ✅ 5. Display results
                resultElement.innerHTML = `
                    <h3>Top Visited Sites</h3>
                    <ul>
                        ${topDomains.map(({ domain, visits, timeSpent }) => `
                            <li>
                                <div class="site-info">
                                    <img src="https://icon.horse/icon/${domain}" alt="icon" width="20" />
                                    <span>${getDomain(domain)} - <strong>${visits}</strong> visits</span> <!-- Only display base domain -->
                                </div>
                                <div class="time-spent">
                                    🕒 ${Math.round(timeSpent / 60)} min
                                </div>
                                <div class="progress-container">
                                    <!-- Progress bar width based on time spent -->
                                    <div class="progress-bar" style="width: ${(timeSpent / totalTimeSpent) * 100}%;"></div>
                                </div>
                            </li>
                        `).join("")}

                        ${otherCount > 0 ? `
                            <li class="other">
                                <span>Other - <strong>${otherCount}</strong> visits</span>
                                <span>🕒 ~${Math.round((otherTimeSpent) / 60)} min</span>
                                <div class="progress-container">
                                    <!-- Progress bar width based on time spent for "Other" -->
                                    <div class="progress-bar" style="width: ${(otherTimeSpent / totalTimeSpent) * 100}%; background-color: #d9534f;"></div>
                                </div>
                            </li>
                        ` : ""}
                    </ul>
                `;
            } catch (error) {
                resultElement.textContent = "Error fetching data.";
                console.error("Error processing data:", error);
            }
        });

    })
    .catch(err => console.error("Error loading config.json:", err));
