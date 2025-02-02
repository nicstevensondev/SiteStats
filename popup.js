fetch(chrome.runtime.getURL("config.json"))
    .then(response => response.json())
    .then(config => {
        AWS.config.update({
            region: config.region,
            credentials: new AWS.CognitoIdentityCredentials({
                IdentityPoolId: config.identityPoolId,
            }),
            dynamoDbCrc32: false,
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
                return [];
            }
        }

        function getDomain(url) {
            try {
                const hostname = new URL(url).hostname.replace("www.", "");
                return hostname;
            } catch {
                return url;
            }
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

                const domainVisits = {};
                const domainTimestamps = {};

                events.forEach(event => {
                    const domain = getDomain(event.pageAddress);

                    domainVisits[domain] = (domainVisits[domain] || 0) + 1;

                    if (!domainTimestamps[domain]) domainTimestamps[domain] = [];
                    domainTimestamps[domain].push(new Date(event.timestamp).getTime());
                });

                const domainTimeSpent = {};
                for (const domain in domainTimestamps) {
                    const times = domainTimestamps[domain].sort((a, b) => a - b);
                    let totalDuration = 0;

                    for (let i = 0; i < times.length - 1; i++) {
                        let diff = (times[i + 1] - times[i]) / 1000;

                        if (diff < 1800) totalDuration += diff;
                    }

                    if (totalDuration == 0) {
                        totalDuration += 60; // DEFAULT TO 1 MIN
                    }

                    domainTimeSpent[domain] = totalDuration;
                }

                const sortedDomains = Object.keys(domainVisits)
                    .map(domain => ({
                        domain,
                        visits: domainVisits[domain],
                        timeSpent: domainTimeSpent[domain] || 0,
                    }))
                    .sort((a, b) => b.timeSpent - a.timeSpent);

                const totalVisits = sortedDomains.reduce((sum, d) => sum + d.visits, 0);
                const totalTimeSpent = sortedDomains.reduce((sum, d) => sum + d.timeSpent, 0);
                const topDomains = sortedDomains.slice(0, 8);
                const otherCount = totalVisits - topDomains.reduce((sum, d) => sum + d.visits, 0);
                const otherTimeSpent = totalTimeSpent - topDomains.reduce((sum, d) => sum + d.timeSpent, 0);

                resultElement.innerHTML = `
                    <ul>
                        ${topDomains.map(({ domain, visits, timeSpent }) => `
                            <li>
                                <div class="site-info">
                                    <img src="https://icon.horse/icon/${domain}" alt="icon" width="20" />
                                    <span class="domain">${getDomain(domain)}</span>
                                </div>
                                <div class="stats">
                                    <span class="visit-count"><strong>${visits}</strong> interactions</span>
                                    <span class="time-spent">🕒 ${Math.round(timeSpent / 60)} min</span>
                                </div>
                            </li>
                        `).join("")}
            
                        ${otherCount > 0 ? `
                            <li class="other">
                                <div class="site-info">
                                    <img src="icon.png" alt="icon" width="20" />
                                    <span class="domain">other</span>
                                </div>
                                <div class="stats">
                                    <span class="visit-count"><strong>${otherCount}</strong> interactions</span>
                                    <span class="time-spent">🕒 ~${Math.round(otherTimeSpent / 60)} min</span>
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
